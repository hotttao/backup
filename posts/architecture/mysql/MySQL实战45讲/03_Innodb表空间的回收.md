---
title: 3 Innodb 表空间回收
date: 2020-03-03
categories:
    - 存储
tags:
    - 极客时间
    - MySQL实战45讲
---

我的数据库占用空间太大，我把一个最大的表删掉了一半的数据，怎么表文件的大小还是没变？

<!-- more -->

## 1.innodb_file_per_table
一个 InnoDB 表包含两部分，即：表结构定义和数据。在 MySQL 8.0 版本以前，表结构是存在以.frm 为后缀的文件里。而 MySQL 8.0 版本，则已经允许把表结构定义放在系统数据表中了。

表数据既可以存在共享表空间里，也可以是单独的文件。这个行为是由参数 innodb_file_per_table 控制的。

innodb_file_per_table=off
- 位置: 所有数据库的所有存储引擎为Innodb的表使用同一个表空间文件
  - datadir/ibdata[N]: 共用的表空间文件，用于保存所有Innodb表的数据和索引
  - 数据库目录/db_name.frm: 表结构定义保存在各个数据库目录下
- 特性: 不支持单表导入等高级特性

innodb_file_per_table=on
- 位置: 每表使用单独的表空间文件，位于各个数据库目录下
  - db_name.ibd: 表单独的表空间文件，用于存储单独表的数据和索引
  - db_name.frm: 用于存储表结构定义

建议将 innodb_file_table 设置为 ON，因为一个表单独存储为一个文件更容易管理，而且在你不需要这个表的时候，通过 drop table 命令，系统就会直接删除这个文件。而如果是放在共享表空间中，即使表删掉了，空间也是不会回收的。

### 2. 数据的删除流程
InnoDB 里的数据都是用 B+ 树的结构组织的，数据存储在磁盘页中。数据的删除就分成了两种情况:
1. 删除一个记录: InnoDB 引擎只会把记录标记为删除，有符合范围条件的数据插入时，这个记录会被复用
2. 一个数据页内的所有记录都被删除，整个数据页就可以被复用了。

![innodb_b](/images/mysql/MySQL45讲/innodb_b.png)

但是记录跟页的复用是有区别的:
1. 记录的复用，只限于符合范围条件的数据。
2. 页的复用可以复用到任何位置
3. 如果相邻两个数据页利用率都很小，系统会把这两个页上的数据合到其中一个页上，另外一个数据页就被标记为可复用

所以 delete 删除命令只是把记录的位置，或者数据页标记为了“可复用”，但磁盘文件的大小是不会变的。也就是说，通过 delete 命令是不能回收表空间的。可以复用，而没有被使用的空间，看起来就像是“空洞”。

不止是删除数据会造成空洞，插入数据也会。随机的数据插入会导致页分裂，另外，更新索引上的值，可以理解为删除一个旧的值，再插入一个新值。不难理解，这也是会造成空洞的。

经过大量增删改的表，都是可能是存在空洞的。所以，如果能够把这些空洞去掉，就能达到收缩表空间的目的。而重建表，就可以达到这样的目的。重建表就可以达到这样的目的。在重建表的时候，InnoDB 不会把整张表占满，每个页留了 1/16 给后续的更新用。

## 3.重建表回收表空间
可以使用 `alter table A engine=InnoDB` 命令来重建表。这个语句在不同的 MySQL 版本中行为是不同的。

### 3.1 MySQL<5.5
`alter table A engine=InnoDB` 的执行流程如下: 
1. 转存数据: 新建一个与表 A 结构相同的表 B，然后按照主键 ID 递增的顺序，把数据一行一行地从表 A 里读出来再插入到表 B 中
2. 交换表名
3. 删除旧表

![alter_table_lock](/images/mysql/MySQL45讲/alter_table_lock.png)
注意:  
- 临时数据存放在 tmp_table 中，这是一个**临时表，是在 server 层创建的**
- 新版本中等同于执行命令 `alter table t engine=innodb,ALGORITHM=copy;`

新建一个与表 A 结构相同的表 B，然后按照主键 ID 递增的顺序，把数据一行一行地从表 A 里读出来再插入到表 B 中。

花时间最多的步骤是往临时表插入数据的过程，如果在这个过程中，有新的数据要写入到表 A 的话，就会造成数据丢失。因此，在整个 DDL 过程中，表 A 中不能有更新。也就是说，这个 DDL 不是 Online 的。

### 3.2 MySQL>=5.5

![alter_table_online](/images/mysql/MySQL45讲/alter_table_online.png)
注意: 
- 临时数据存放在 tmp_file 中，“tmp_file”里的，这个**临时文件是 InnoDB 在内部创建出来的**
- 等同于命令 `alter table t engine=innodb,ALGORITHM=inplace;`

MySQL 5.6 版本开始引入的 Online DDL，对这个操作流程做了优化。重建表的流程如下：
1. 建立一个**临时文件**，扫描表 A 主键的所有数据页；
2. 用数据页中表 A 的记录生成 B+ 树，存储到临时文件中；
3. 生成临时文件的过程中，将所有对 A 的操作记录在一个**日志文件（row log）**中，对应的是图中 state2 的状态；
4. 临时文件生成后，将日志文件中的操作应用到临时文件，得到一个逻辑数据上与表 A 相同的数据文件，对应的就是图中 state3 的状态；
5. 用临时文件替换表 A 的数据文件。

图 4 的流程中，alter 语句在启动的时候需要获取 MDL 写锁，但是这个写锁在真正拷贝数据之前就退化成读锁了。MDL 读锁不会阻塞增删改操作，同时保护自己，禁止其他线程对这个表同时做 DDL。

由于**日志文件记录和重放操作**这个功能的存在，这个方案在重建表的过程中，允许对表 A 做增删改操作。这也就是 Online DDL 名字的来源。

上述的这些重建方法都会扫描原表数据和构建临时文件。对于很大的表来说，这个操作是很消耗 IO 和 CPU 资源的。因此，如果是线上服务，你要很小心地控制操作时间。如果想要比较安全的操作的话，推荐使用 GitHub 开源的 `gh-ost` 

### 3.3 inplace 和 online
inplace 和 online 并不是一回事，DDL 过程如果是 Online 的，就一定是 inplace 的；反过来未必，也就是说 inplace 的 DDL，有可能不是 Online 的。截止到 MySQL 8.0，添加全文索引（FULLTEXT index）和空间索引 (SPATIAL index) 就属于这种情况。

## 4. 三种重建表的语法
optimize table、analyze table 和 alter table:
1. 从 MySQL 5.6 版本开始，alter table t engine = InnoDB（也就是 recreate）默认的就是`ALGORITHM=inplace` 的过程
2. analyze table t 其实不是重建表，只是对表的索引信息做重新统计，没有修改数据，这个过程中加了 MDL 读锁；
3. optimize table t 等于 recreate+analyze
