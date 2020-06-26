---
title: 23 join
date: 2020-03-23
categories:
    - 存储
tags:
	  - 极客时间
	  - MySQL实战45讲
---

join 语句是怎么执行的
<!-- more -->

## 1. 实验环境
```bash
CREATE TABLE `t2` (  `id` int(11) NOT NULL,  `a` int(11) DEFAULT NULL,  `b` int(11) DEFAULT NULL,  PRIMARY KEY (`id`),  KEY `a` (`a`)) ENGINE=InnoDB;

drop procedure idata;delimiter ;;create procedure idata()begin  declare i int;  set i=1;  while(i<=1000)do    insert into t2 values(i, i, i);    set i=i+1;  end while;end;;delimiter ;call idata();

create table t1 like t2;insert into t1 (select * from t2 where id<=100)
```

这两个表都有一个主键索引 id 和一个索引 a，字段 b 上无索引。存储过程 idata() 往表 t2 里插入了 1000 行数据，在表 t1 里插入的是 100 行数据。

如果直接使用 join 语句，MySQL 优化器可能会选择表 t1 或 t2 作为驱动表，为了便于分析执行过程中的性能问题，我们改用 `straight_join` 让 MySQL 使用固定的连接方式执行查询，这样优化器只会按照我们指定的方式去 join。


## 2. join 的合并算法
依据是否能使用被驱动表索引，join 合并算法分为:
1. Index Nested-Loop Join(NLJ): 可以使用被驱动表的索引
2. Simple Nested-Loop Join: 不能使用被驱动表的索引，执行过程与 Index Nested-Loop Join 类似，MySQL 并没有使用
3. Block Nested-Loop Join(BNL): 不能使用被驱动表的索引，会将全表扫描转换为内存比较

### 2.1 Index Nested-Loop Join
```bash 
select * from t1 straight_join t2 on (t1.a=t2.a);
```

![NLJ](/images/mysql/MySQL45讲/NLJ.jpg)

驱动表走全表扫描，而被驱动表是走树搜索。

假设被驱动表的行数是 M。每次在被驱动表查一行数据，要先搜索索引 a，再搜索主键索引。每次搜索一棵树近似复杂度是以 2 为底的 M 的对数，记为 `log2M`，所以在被驱动表上查一行的时间复杂度是 `2*log2M`。假设驱动表的行数是 N，执行过程就要扫描驱动表 N 行，然后对于每一行，到被驱动表上匹配一次。因此整个执行过程，近似复杂度是 `N + N*2*log2M`。


### 2.2 Simple Nested-Loop Join
驱动表是走全表扫描，被驱动表也是全表扫描，因此近似时间复杂度是`N + N*M`

### 2.3 Block Nested-Loop Join
```bash 
select * from t1 straight_join t2 on (t1.a=t2.b);
```

![BNL](/images/mysql/MySQL45讲/BNL.jpg)

这个算法的执行过程是这样的:
1. 把表 t1 的数据读入线程内存 join_buffer 中，由于我们这个语句中写的是 `select *`，因此是把整个表 t1 放入了内存；
2. 扫描表 t2，把表 t2 中的每一行取出来，跟 join_buffer 中的数据做对比，满足 join 条件的，作为结果集的一部分返回。

假设小表的行数是 N，大表的行数是 M，那么在这个算法里：两个表都做一次全表扫描，所以总的扫描行数是 M+N；内存中的判断次数是 `M*N`。因此近似时间复杂度是`N + N*M`

因此，从时间复杂度上来说，Simple Nested-Loop Join 与 Block Nested-Loop Join 是一样的。但是，Block Nested-Loop Join 算法的`M*N`次判断是内存操作，速度上会快很多，性能也更好。

#### join_buffer_size 
`join_buffer` 的大小是由参数 `join_buffer_size` 设定的，默认值是 256k。如果放不下表 t1 的所有数据话，就会分段存在，并执行上面的过程。

![BNL_2](/images/mysql/MySQL45讲/BNL_2.png)

假设，驱动表的数据行数是 N，需要分 K 段才能完成算法流程，被驱动表的数据行数是 M， `k=size of N /join_buffer_size`

所以，在这个算法的执行过程中：
1. 扫描行数是 `N+N*M/join_buffer_size`；
2. 内存判断 `N*M` 次。

显然:
1. 使用小表作为驱动表时，扫描行数少
2. join_buffer_size 越大，对被驱动表的全表扫描次数越少

### 2.4 join 使用建议
1. 如果可以使用 Index Nested-Loop Join 算法，也就是说可以用上被驱动表上的索引，其实是没问题的；
2. 如果使用 Block Nested-Loop Join 算法，扫描行数就会过多。尤其是在大表上的 join 操作，这样可能要扫描被驱动表很多次，会占用大量的系统资源。所以这种 join 尽量不要用。判断标准就是Extra 字段里面有没有出现“Block Nested Loop”字样。Explain下，没有用index nested-loop 的全要优化。
3. 总是应该使用小表做驱动表。

#### 小表的定义
在决定哪个表做驱动表的时候，应该是两个表按照各自的条件过滤，过滤完成之后，计算参与 join 的各个字段的总数据量，数据量小的那个表，就是“小表”，应该作为驱动表。(**NLJ 算法是先过滤，再join**)

```bash
# t2 过滤只有 50 行，所以 t2 为小表
select * from t1 straight_join t2 on (t1.b=t2.b) where t2.id<=50;
select * from t2 straight_join t1 on (t1.b=t2.b) where t2.id<=50;

# t1，t2 都是100行，但是 t1 只需要b 字段，t2 需要所有字段，所以 t1 是小表
select t1.b,t2.* from  t1  straight_join t2 on (t1.b=t2.b) where t2.id<=100;
select t1.b,t2.* from  t2  straight_join t1 on (t1.b=t2.b) where t2.id<=100;
```

### 2.5 BNL算法 对缓存的影响
如果一个使用 BNL 算法的 join 语句，多次扫描一个冷表，而且这个语句执行时间超过 1 秒，就会在再次扫描冷表的时候，把冷表的数据页移到 LRU 链表头部。这种情况对应的，是冷表的数据量小于整个 Buffer Pool 的 3/8，能够完全放入 old 区域的情况。如果这个冷表很大，就会出现另外一种情况：业务正常访问的数据页，没有机会进入 young 区域。由于优化机制的存在，一个正常访问的数据页，要进入 young 区域，需要隔 1 秒后再次被访问到。但是，由于我们的 join 语句在循环读磁盘和淘汰内存页，进入 old 区域的数据页，很可能在 1 秒之内就被淘汰了。这样，就会导致这个 MySQL 实例的 Buffer Pool 在这段时间内，young 区域的数据页没有被合理地淘汰。

大表 join 操作虽然对 IO 有影响，但是在语句执行结束后，对 IO 的影响也就结束了。但是，对 Buffer Pool 的影响就是持续性的，需要依靠后续的查询请求慢慢恢复内存命中率。

为了减少这种影响，你可以考虑增大 join_buffer_size 的值，减少对被驱动表的扫描次数。也就是说，BNL 算法对系统的影响主要包括三个方面：
1. 可能会多次扫描被驱动表，占用磁盘 IO 资源；
2. 判断 join 条件需要执行 M*N 次对比（M、N 分别是两张表的行数），如果是大表就会占用非常多的 CPU 资源；
3. 可能会导致 Buffer Pool 的热数据被淘汰，影响内存命中率。

我们执行语句之前，需要通过理论分析和查看 explain 结果的方式，确认是否要使用 BNL 算法。如果确认优化器会使用 BNL 算法，就需要做优化。优化的常见做法是，给被驱动表的 join 字段加上索引，把 BNL 算法转成 BKA 算法。

## 3. MRR
Multi-Range Read 优化 (MRR)主要目的是尽量使用顺序读盘。原理是这样的，因为大多数的数据都是按照主键递增顺序插入得到的，所以我们可以认为，如果按照主键的递增顺序查询的话，对磁盘的读比较接近顺序读，能够提升读性能。

![MRR](/images/mysql/MySQL45讲/MRR.jpg)

对于语句 `select * from t1 where a>=1 and a<=100;` a 上有索引，语句的执行过程是这样的: 
1. 根据索引 a，定位到满足条件的记录，将 id 值放入 read_rnd_buffer 中 ;
2. 将 read_rnd_buffer 中的 id 进行递增排序；
3. 排序后的 id 数组，依次到主键 id 索引中查记录，并作为结果返回。

这里，`read_rnd_buffer` 的大小是由 `read_rnd_buffer_size` 参数控制的。如果步骤 1 中，read_rnd_buffer 放满了，就会先执行完步骤 2 和 3，然后清空 read_rnd_buffer。之后继续找索引 a 的下个记录，并继续循环。

如果你想要稳定地使用 MRR 优化的话，需要设置`set optimizer_switch="mrr_cost_based=off"`。（官方文档的说法，是现在的优化器策略，判断消耗的时候，会更倾向于不使用 MRR，把 `mrr_cost_based` 设置为 off，就是固定使用 MRR 了。）

MRR 能够提升性能的核心在于，这条查询语句在索引 a 上做的是一个范围查询（也就是说，这是一个多值查询），可以得到足够多的主键 id。这样通过排序以后，再去主键索引查数据，才能体现出“顺序性”的优势。


### 4. Batched Key Access(BKA) 
MySQL 在 5.6 版本后开始引入的 Batched Key Access(BKA) 算法了。这个 BKA 算法，其实就是对 NLJ 算法的优化。BKA 依赖的就是 MRR。

![BKA](/images/mysql/MySQL45讲/BKA.png)

1. NLJ 算法执行的逻辑是：从驱动表 t1，一行行地取出 a 的值，再到被驱动表 t2 去做 join。对于表 t2 来说，每次都是匹配一个值。这时，MRR 的优势就用不上了。
2. 我们可以把表 t1 的数据取出来一部分放入  join_buffer 中，然后应用 MRR 

要使用BKA，在SQL查询前需要设置:
```bash
set optimizer_switch='mrr=on,mrr_cost_based=off,batched_key_access=on';
```
使用 BKA 算法的时候，并不是“先计算两个表 join 的结果，再跟第三个表 join”，而是直接嵌套查询的。

## 5. BNL 算法优化
### 5.1 BNL 转 BKA
一些情况下，我们可以直接在被驱动表上建索引，这时就可以直接转成 BKA 算法了。但是，有时候你确实会碰到一些不适合在被驱动表上建索引的情况。比如下面这个语句：

```bash
# t1 有1000行，t2 过滤后有 2000 行因此小表是 t1
select * from t1 join t2 on (t1.b=t2.b) where t2.b>=1 and t2.b<=2000;
```

表 t2 中插入了 100 万行数据，但是经过 where 条件过滤后，需要参与 join 的只有 2000 行数据。如果这条语句同时是一个低频的 SQL 语句，那么再为这个语句在表 t2 的字段 b 上创建一个索引就很浪费了。

如果使用 BNL 算法来 join 的话，这个语句的执行流程是这样的：
1. 把表 t1 的所有字段取出来，存入 join_buffer 中。这个表只有 1000 行，join_buffer_size 默认值是 256k，可以完全存入。
2. 扫描表 t2，取出每一行数据跟 join_buffer 中的数据进行对比
  - 如果不满足 t1.b=t2.b，则跳过；
  - 如果满足 t1.b=t2.b, 再判断其他条件，也就是是否满足 t2.b 处于`[1,2000]`的条件，如果是，就作为结果集的一部分返回，否则跳过。

对于表 t2 的每一行，判断 join 是否满足的时候，都需要遍历 join_buffer 中的所有行。因此判断等值条件的次数是 `1000*100 万 =10 亿次`，这个判断的工作量很大。

这时候，我们可以考虑使用临时表。使用临时表的大致思路是：
1. 把表 t2 中满足条件的数据放在临时表 tmp_t 中；
2. 为了让 join 使用 BKA 算法，给临时表 tmp_t 的字段 b 加上索引；
3. 让表 t1 和 tmp_t 做 join 操作。

```bash
create temporary table temp_t(id int primary key, a int, b int, index(b))engine=innodb;
insert into temp_t select * from t2 where b>=1 and b<=2000;
select * from t1 join temp_t on (t1.b=temp_t.b);
```
基于临时表的改进方案，对于能够提前过滤出小数据的 join 语句来说，效果还是很好的。总体来看，不论是在原表上加索引，还是用有索引的临时表，我们的思路都是让 join 语句能够用上被驱动表上的索引，来触发 BKA 算法，提升查询性能。

### 5.2 扩展 -hash join
如果 join_buffer 里面维护的不是一个无序数组，而是一个哈希表的话，那么就不是 10 亿次判断，而是 100 万次 hash 查找。这，也正是 MySQL 的优化器和执行器一直被诟病的一个原因：不支持哈希 join。并且，MySQL 官方的 roadmap，也是迟迟没有把这个优化排上议程。

实际上，这个优化思路，我们可以自己实现在业务端。实现流程大致如下：
1. select * from t1;取得表 t1 的全部 1000 行数据，在业务端存入一个 hash 结构，比如 C++ 里的 set、PHP 的数组这样的数据结构。
2. select * from t2 where b>=1 and b<=2000; 获取表 t2 中满足条件的 2000 行数据。
3. 把这 2000 行数据，一行一行地取到业务端，到 hash 结构的数据表中寻找匹配的数据。满足匹配的条件的这行数据，就作为结果集的一行


## 6. 问题
### 6.1 join 的执行顺序
问题:
1. 如果用 left join 的话，左边的表一定是驱动表吗？
2. 如果两个表的 join 包含多个条件的等值匹配，是都要写到 on 里面呢，还是只把一个条件写到 on 里面，其他条件写到 where 部分？

```bash
create table a(f1 int, f2 int, index(f1))engine=innodb;
create table b(f1 int, f2 int)engine=innodb;
insert into a values(1,1),(2,2),(3,3),(4,4),(5,5),(6,6);
insert into b values(3,3),(4,4),(5,5),(6,6),(7,7),(8,8);
```

第二个问题，其实就是下面这两种写法的区别：
```bash
select * from a left join b on(a.f1=b.f1) and (a.f2=b.f2); /*Q1*/
select * from a left join b on(a.f1=b.f1) where (a.f2=b.f2);/*Q2*/
```

在 MySQL 里，NULL 跟任何值执行等值判断和不等值判断的结果，都是 NULL。这里包括， select NULL = NULL 的结果，也是返回 NULL。

因此，语句 Q2 里面 where a.f2=b.f2 就表示“找到这两个表里面，f1、f2 对应同时存在且相同的行。”虽然用的是 left join，但是语义跟 join 是一致的。因此，优化器就把这条语句的 left join 改写成了 join，然后因为表 a 的 f1 上有索引，就把表 b 作为驱动表，这样就可以用上 NLJ 算法。

因此:
1. 这个例子说明，即使我们在 SQL 语句中写成 left join，执行过程还是有可能不是从左到右连接的。也就是说，使用 left join 时，左边的表不一定是驱动表。
2. 如果需要 left join 的语义，就不能把被驱动表的字段放在 where 条件里面做等值判断或不等值判断，必须都写在 on 里面。
3. join 本身表示的就是同时存在并相等，因此join 将判断条件是否全部放在 on 部分就没有区别了

