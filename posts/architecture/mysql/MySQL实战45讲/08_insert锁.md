---
title: 8 insert 语句的锁
date: 2020-03-08
categories:
    - 存储
tags:
    - 极客时间
    - MySQL实战45讲
---

insert select 为什么有这么多锁？

<!-- more -->
本节我们会介绍一些特殊的 insert 语句产生的锁:
1. insert … select 是很常见的在两个表之间拷贝数据的方法。你需要注意，在可重复读隔离级别下，这个语句会给 select 的表里扫描到的记录和间隙加读锁
2. 如果 insert 和 select 的对象是同一个表，则有可能会造成循环写入。这种情况下，我们需要引入用户临时表来做优化。
3. insert 语句如果出现唯一键冲突，会在冲突的唯一值上加共享的 next-key lock(S 锁)。因此，碰到由于唯一键约束导致报错后，要尽快提交或回滚事务，避免加锁时间过长。


## 1. insert … select 语句
```bash
CREATE TABLE `t` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `c` int(11) DEFAULT NULL,
  `d` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `c` (`c`)
) ENGINE=InnoDB;

insert into t values(null, 1,1);
insert into t values(null, 2,2);
insert into t values(null, 3,3);
insert into t values(null, 4,4);

create table t2 like t
```

在可重复读隔离级别下，binlog_format=statement 时, `insert into t2(c,d) select c,d from t;` 需要对表 t 的所有行和间隙加锁。原因还是日志和数据的一致性。

![insert_select](/images/mysql/MySQL45讲/insert_select.png)

如果没有锁的话，就可能出现 session B 的 insert 语句先执行，但是后写入 binlog 的情况。于是，在 binlog_format=statement 的情况下就会出现日志与数据的不一致。

## 2. insert 循环写入

执行 insert … select 的时候，对目标表也不是锁全表，而是只锁住需要访问的资源。假设要往表 t2 中插入一行数据，这一行的 c 值是表 t 中 c 值的最大值加 1。
```bash
insert into t2(c,d)  (select c+1, d from t force index(c) order by c desc limit 1);
```

这个语句的加锁范围，就是表 t 索引 c 上的 (3,4]和 (4,supremum]这两个 next-key lock，以及主键索引上 id=4 这一行。

如果我们是要把这样的一行数据插入到表 t 中的话：
```bash
insert into t(c,d)  (select c+1, d from t force index(c) 
```

使用 explain，查看二进制日志，以及 Innodb_rows_read

![insert_explain](/images/mysql/MySQL45讲/insert_explain.png)
![insert_binlog](/images/mysql/MySQL45讲/insert_binlog.png)
![insert_rows](/images/mysql/MySQL45讲/insert_rows.png)

1. Extra 字段可以看到“Using temporary”字样，表示这个语句用到了临时表
2. 二进制日志显示执行过程中读取了 5 行
3. Innodb_rows_read 的值增加了 4。因为默认临时表是使用 Memory 引擎的，所以这 4 行查的都是表 t

也就是说对上面这条语句对表 t 做了全表扫描。执行过程如下:
1. 创建临时表，表里有两个字段 c 和 d。
2. 按照索引 c 扫描表 t，依次取 c=4、3、2、1，然后回表，读到 c 和 d 的值写入临时表。这时，Rows_examined=4。
3. 由于语义里面有 limit 1，所以只取了临时表的第一行，再插入到表 t 中。这时，Rows_examined 的值加 1，变成了 5

也就是说，这个语句会导致在表 t 上做全表扫描，并且会给索引 c 上的所有间隙都加上共享的 next-key lock。所以，这个语句执行期间，其他事务不能在这个表上插入数据。

为什么需要临时表，原因是这类一边遍历数据，一边更新数据的情况，如果读出来的数据直接写回原表，就可能在遍历过程中，读到刚刚插入的记录，新插入的记录如果参与计算逻辑，就跟语义不符。

由于实现上这个语句没有在子查询中就直接使用 limit 1，从而导致了这个语句的执行需要遍历整个表 t。因此我们可以使用下面的 sql 进行优化

```bash
create temporary table temp_t(c int,d int) engine=memory;
insert into temp_t  (select c+1, d from t force index(c) order by c desc limit 1);
insert into t select * from temp_t;
drop table temp_t;
```

### 3. insert 唯一键冲突
![insert_lock](/images/mysql/MySQL45讲/insert_lock.png)

这个例子也是在可重复读（repeatable read）隔离级别下执行的。可以看到，session B 要执行的 insert 语句进入了锁等待状态。也就是说，session A 执行的 insert 语句，发生唯一键冲突的时候，并不只是简单地报错返回，还在冲突的索引上加了锁。

一个 next-key lock 就是由它右边界的值定义的。这时候，session A 持有索引 c 上的 (5,10]共享 next-key lock（读锁）。

至于为什么要加这个读锁，没有找到合理的解释。从作用上来看，这样做可以避免这一行被别的事务删掉。

### 3.1 唯一键冲突导致的死锁场景
![insert_uniq_lock](/images/mysql/MySQL45讲/insert_uniq_lock.png)

在 session A 执行 rollback 语句回滚的时候，session C 几乎同时发现死锁并返回。这个死锁产生的逻辑是这样的：
1. 在 T1 时刻，启动 session A，并执行 insert 语句，此时在索引 c 的 c=5 上加了记录锁。
2. 在 T2 时刻，session B 要执行相同的 insert 语句，发现了唯一键冲突，加上读锁；同样地，session C 也在索引 c 上，c=5 这一个记录上，加了读锁。
3. T3 时刻，session A 回滚。这时候，session B 和 session C 都试图继续执行插入操作，都要加上写锁。两个 session 都要等待对方的行锁，所以就出现了死锁

![duplicate_key_lock](/images/mysql/MySQL45讲/duplicate_key_lock.jpg)



### 4. insert into … on duplicate key update
![insert_lock](/images/mysql/MySQL45讲/insert_lock.png)
如果将上面的session A 冲突改写成 `insert into t values(11,10,10) on duplicate key update d=100; ` 就会给索引 c 上 (5,10] 加一个排他的 next-key lock（写锁）。

insert into … on duplicate key update 这个语义的逻辑是，插入一行数据，如果碰到唯一键约束，就执行后面的更新语句。注意，如果有多个列违反了唯一性约束，就会按照索引的顺序，修改跟第一个索引冲突的行。

## 5. 小结
insert … select 是很常见的在两个表之间拷贝数据的方法。你需要注意，在可重复读隔离级别下 binlog=statement，这个语句会给 select 的表里扫描到的记录和间隙加读锁。

而如果 insert 和 select 的对象是同一个表，则有可能会造成循环写入。这种情况下，我们需要引入用户临时表来做优化。

insert 语句如果出现唯一键冲突，会在冲突的唯一值上加共享的 next-key lock(S 锁)。因此，碰到由于唯一键约束导致报错后，要尽快提交或回滚事务，避免加锁时间过长。
