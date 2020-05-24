---
title: 22 常见语句的执行逻辑
date: 2020-03-22
categories:
    - 存储
tags:
	  - 极客时间
	  - MySQL实战45讲
---

count，order by 都是怎么执行的
<!-- more -->

## 1. count
在不同的 MySQL 引擎中，count\(\*\) 有不同的实现方式:
- MyISAM: 把一个表的总行数存在了磁盘上，在没有筛选条件时，count(*) 可以直接返回
- Innodb: 需要把数据一行一行地从引擎里面读出来，然后累积计数。

由于 Innodb 事务是基于 MVCC 的多版本控制机制实现的，每一行记录都要判断自己是否对这个会话可见，因此对于 count\(\*\) 请求来说，InnoDB 只好把数据一行一行地读出依次判断，可见的行才能够用于计算“基于这个查询”的表的总行数。对于 count\(\*\) 遍历主键索引和二级索引得到的结果逻辑上是一致的。MySQL 优化器会找到最小的那棵树来遍历。在保证逻辑正确的前提下，尽量减少扫描的数据量，是数据库系统设计的通用法则之一。

`show table status` 返回的 TABLE_ROWS 用于显示这个表当前有多少行，但它是通过采样计算得来的，很不准。 那怎么才能快速得到记录总数呢？

我们只能自己计数。基本思路：你需要自己找一个地方，把操作记录表的行数存起来。

### 1.1 如何计数
我们把这个计数直接放到 MySQL 数据库里单独的一张计数表 C 中，利用事务，我们可以保证计数更新与数据更新之间的一致性。

把计数放在 Redis 里面，不能够保证计数和 MySQL 表里的数据精确一致的原因，是这两个不同的存储构成的系统，不支持分布式事务，无法拿到精确一致的视图。而把计数值也放在 MySQL 中，就解决了一致性视图的问题。

### 1.2 不同的 count 用法
要想弄明白 ount(\*)、count(主键 id)、count(字段) 和 count(1) 的差别，首先你要弄清楚 count() 的语义。count() 是一个聚合函数，对于返回的结果集，一行行地判断，如果 count 函数的参数不是 NULL，累计值就加 1，否则不加。最后返回累计值。

所以，count\(\*\)、count(主键 id) 和 count(1) 都表示返回满足条件的结果集的总行数；而 count(字段），则表示返回满足条件的数据行里面，参数“字段”不为 NULL 的总个数。

至于分析性能差别的时候，你可以记住这么几个原则：
1. server 层要什么就给什么；
2. InnoDB 只给必要的值；
3. 现在的优化器只优化了 count(\*) 的语义为“取行数”，其他“显而易见”的优化并没有做

性能差别:
- count(主键 id):InnoDB 引擎会遍历整张表，把每一行的 id 值都取出来，返回给 server 层。server 层拿到 id 后，判断是不可能为空的，就按行累加
- count(1): InnoDB 引擎遍历整张表，但不取值。server 层对于返回的每一行，放一个数字“1”进去，判断是不可能为空的，按行累加。count(1) 执行得要比 count(主键 id) 快。因为从引擎返回 id 会涉及到解析数据行，以及拷贝字段值的操作。
-  count(字段):
	- 如果这个“字段”是定义为 not null 的话，一行行地从记录里面读出这个字段，判断不能为 null，按行累加；
	- 如果这个“字段”定义允许为 null，那么执行的时候，判断到有可能是 null，还要把值取出来再判断一下，不是 null 才累加
- count(\*): 并不会把全部字段取出来，而是专门做了优化，不取值。count(\*) 肯定不是 null，按行累加。

按照效率由低到高排序的话，`count(字段) -> count(主键 id) -> count(1)≈count(\*)`，所以我建议你，尽量使用 count(\*)

### 2. order by
order by 如何执行取决于如下几个因素:
1. 是否使用外部排序:
	- MySQL 会给每个线程分配一块内存用于排序，称为 sort_buffer。
	- 排序可能在内存中完成，也可能需要使用外部排序，这取决于排序所需的内存和参数 sort_buffer_size。
	- sort_buffer_size，就是 MySQL 为排序开辟的内存（sort_buffer）的大小
	- 如果要排序的数据量小于 `sort_buffer_size`，排序就在内存中完成。否则就需要磁盘临时文件辅助排序
2. 单行长度是否太大
	- 默认 MySQL 会使用"全字段排序"，即把所需的所有字段都放到 sort_buffer_size 中然后排序
	- 如果查询要返回的字段很多的话，那么 sort_buffer 里面要放的字段数太多，这样内存里能够同时放下的行数很少，要分成很多个临时文件，排序的性能会很差。此时 MySQL 就会采用另一种排序算法 "rowid 排序"
	- `max_length_for_sort_data`，是 MySQL 中专门控制用于排序的行数据的长度的一个参数。单行的长度超过这个值，就会使用 rowid 算法
3. 是否有筛选字段与排序字段的联合索引: 可以利用索引的有序性直接排序，下称"索引直接排序"

因此我们将详细下面这几个问题:
1. 如何判断排序语句是否使用了临时文件
2. 全字段排序过程
3. rowid 排序过程
4. 索引直接排序过程

#### 2.1 是否使用了临时文件
假设有个市民表定义如下，我们希望查询城市是“杭州”的所有人名字，并且按照姓名排序返回前 1000 个人的姓名、年龄。
```bash
CREATE TABLE `t` (
  `id` int(11) NOT NULL,
  `city` varchar(16) NOT NULL,
  `name` varchar(16) NOT NULL,
  `age` int(11) NOT NULL,
  `addr` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `city` (`city`)
) ENGINE=InnoDB;


select city,name,age from t where city='杭州' order by name limit 1000  ;
```

为避免全表扫描，我们需要在 city 字段加上索引。在 city 字段上创建索引之后，我们用 explain 命令来看看这个语句的执行情况。

![sort_explain](/images/mysql/MySQL45讲/sort_explain.png)

Extra 这个字段中的“Using filesort”表示的就是需要排序，但是并没有告诉我们MySQL使用了哪种排序是算法，也没有告诉我们是否使用了临时文件排序。用下面介绍的方法，可以确定一个排序语句是否使用了临时文件。

```bash

/* 打开optimizer_trace，只对本线程有效 */
SET optimizer_trace='enabled=on'; 

/* @a保存Innodb_rows_read的初始值, mairadb 有所区别 */
select VARIABLE_VALUE into @a from  performance_schema.session_status where variable_name = 'Innodb_rows_read';

/* 执行语句 */
select city, name,age from t where city='杭州' order by name limit 1000; 

/* 查看 OPTIMIZER_TRACE 输出 */
SELECT * FROM `information_schema`.`OPTIMIZER_TRACE`\G

/* @b保存Innodb_rows_read的当前值 */
select VARIABLE_VALUE into @b from performance_schema.session_status where variable_name = 'Innodb_rows_read';

/* 计算Innodb_rows_read差值 */
select @b-@a;
```

下面 OPTIMIZER_TRACE 的显示结果(显示的是2.2全字段排序的分析结果)

![optimizer_trace](/images/mysql/MySQL45讲/optimizer_trace.png)
1. number_of_tmp_files: 表示排序过程中使用的临时文件数。大于 0 表示使用了临时文件排序
2. examined_rows: 表示参与排序的行数
3. sort_mode 里面的 packed_additional_fields 的意思是，排序过程对字符串做了“紧凑”处理。即使 name 字段的定义是 varchar(16)，在排序过程中还是要按照实际长度来分配空间的。
4. 最后一个查询语句 select @b-@a 的返回结果是 4000，表示整个执行过程只扫描了 4000 行。

需要注意的是，为了避免对结论造成干扰，我把 internal_tmp_disk_storage_engine 设置成 MyISAM。否则，select @b-@a 的结果会显示为 4001。这是因为查询 OPTIMIZER_TRACE 这个表时，需要用到临时表，而 internal_tmp_disk_storage_engine 的默认值是 InnoDB。如果使用的是 InnoDB 引擎的话，把数据从临时表取出来的时候，会让 Innodb_rows_read 的值加 1。


### 2.2 全字段排序

![sort_full](/images/mysql/MySQL45讲/sort_full.jpg)

如上图，使用全字段排序的过程如下:
1. 初始化 sort_buffer，确定放入 name、city、age 这三个字段；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id；
3. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到 city 的值不满足查询条件为止；
6. 对 sort_buffer 中的数据按照字段 name 做快速排序；
7. 按照排序结果取前 1000 行返回给客户端。

### 2.3 rowid 排序
![sort_rowid](/images/mysql/MySQL45讲/sort_rowid.jpg)

rowid 算法放入 sort_buffer 的字段，只有要排序的列（即 name 字段）和主键 id。
1. 初始化 sort_buffer，确定放入两个字段，即 name 和 id；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id；
3. 到主键 id 索引取出整行，取 name、id 这两个字段，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到不满足 city='杭州’条件为止；
6. 对 sort_buffer 中的数据按照字段 name 进行排序；
7. 遍历排序结果，取前 1000 行，并按照 id 的值回到原表中取出 city、name 和 age 三个字段返回给客户端。

rowid 排序多访问了一次表 t 的主键索引，最后的“结果集”是一个逻辑概念，不需要在服务端再耗费内存存储结果，是直接返回给客户端的。

city、name、age 这三个字段的定义总长度是 36，我们把 max_length_for_sort_data 设置为 16，就可以让 MySQL 使用 rowid 进行排序。


```bash
SET max_length_for_sort_data = 16;

/* 打开optimizer_trace，只对本线程有效 */
SET optimizer_trace='enabled=on'; 

/* @a保存Innodb_rows_read的初始值, mairadb 有所区别 */
select VARIABLE_VALUE into @a from  performance_schema.session_status where variable_name = 'Innodb_rows_read';

/* 执行语句 */
select city, name,age from t where city='杭州' order by name limit 1000; 

/* 查看 OPTIMIZER_TRACE 输出 */
SELECT * FROM `information_schema`.`OPTIMIZER_TRACE`\G

/* @b保存Innodb_rows_read的当前值 */
select VARIABLE_VALUE into @b from performance_schema.session_status where variable_name = 'Innodb_rows_read';

/* 计算Innodb_rows_read差值 */
select @b-@a;
```

重新进行上面的查询分析会看到:

![optimizer_rowid](/images/mysql/MySQL45讲/optimizer_rowid.png)
1. sort_mode 变成了 `<sort_key, rowid>`，表示参与排序的只有 name 和 id 这两个字段。
2. number_of_tmp_files 变成 10 了，是因为这时候参与排序的行数虽然仍然是 4000 行，但是每一行都变小了，因此需要排序的总数据量就变小了，需要的临时文件也相应地变少了


对于 InnoDB 表来说，rowid 排序会要求回表多造成磁盘读，因此不会被优先选择。这也就体现了 MySQL 的一个设计思想：如果内存够，就要多利用内存，尽量减少磁盘访问。


### 2.4 索引直接排序
我们可以在这个市民表上创建一个 city 和 name 的联合索引，这个索引的示意图如下:

```bash
alter table t add index city_user(city, name);
```

![sort_index](/images/mysql/MySQL45讲/sort_index.png)

因为索引是按照city,name 排序的，所以排序过程就变成了:
1. 从索引 (city,name) 找到第一个满足 city='杭州’条件的主键 id；
2. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，作为结果集的一部分直接返回；
3. 从索引 (city,name) 取下一个记录主键 id；
4. 重复步骤 2、3，直到查到第 1000 条记录，或者是不满足 city='杭州’条件时循环结束。

![sort_index](/images/mysql/MySQL45讲/sort_index.jpg)

如果表上有 (city, name, age)，就可以使用覆盖索引，无须进行上述步骤 2 的回表过程，性能上会快很多。当然，这里并不是说要为了每个查询能用上覆盖索引，就要把语句中涉及的字段都建上联合索引，毕竟索引还是有维护代价的。这是一个需要权衡的决定。