---
title: 11 SQL 一些常见的错误用法
date: 2020-03-11
categories:
    - 存储
tags:
	  - 极客时间
	  - MySQL实战45讲
---

对索引字段做函数操作，可能会破坏索引值的有序性，因此优化器就决定放弃走树搜索功能。

<!-- more -->

## 试验环境
我们用下面两张表作为我们测试 SQL 用法的试验环境:

```bash
# 交易信息表
mysql> CREATE TABLE `tradelog` (
  `id` int(11) NOT NULL,
  `tradeid` varchar(32) DEFAULT NULL,
  `operator` int(11) DEFAULT NULL,
  `t_modified` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tradeid` (`tradeid`),
  KEY `t_modified` (`t_modified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

# 交易详情表
mysql> CREATE TABLE `trade_detail` (
  `id` int(11) NOT NULL,
  `tradeid` varchar(32) DEFAULT NULL,
  `trade_step` int(11) DEFAULT NULL, /*操作步骤*/
  `step_info` varchar(32) DEFAULT NULL, /*步骤信息*/
  PRIMARY KEY (`id`),
  KEY `tradeid` (`tradeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```


## 1.条件字段函数操作
类似下面的 SQL，对索引字段做了函数操作，可能会破坏索引值的有序性，因此优化器就决定放弃走树搜索功能。

```bash
# t_modified 上存在索引
mysql> select count(*) from tradelog where month(t_modified)=7;
```

要注意的是，优化器并不是要放弃使用这个索引。在这个例子里，放弃了树搜索功能，优化器可以选择遍历主键索引，也可以选择遍历索引 t_modified，优化器对比索引大小后发现，索引 t_modified 更小，遍历这个索引比遍历主键索引来得更快。因此最终还是会选择索引 t_modified。

我们就要把 SQL 语句改成基于字段本身的范围查询。按照下面这个写法，优化器就能按照我们预期的，用上 t_modified 索引的快速定位能力了。

```bash
mysql> select count(*) from tradelog where
    -> (t_modified >= '2016-7-1' and t_modified<'2016-8-1') or
    -> (t_modified >= '2017-7-1' and t_modified<'2017-8-1') or 
    -> (t_modified >= '2018-7-1' and t_modified<'2018-8-1');
```

不过优化器在个问题上确实有“偷懒”行为，即使是对于不改变有序性的函数，也不会考虑使用索引。比如，对于 select * from tradelog where id + 1 = 10000 这个 SQL 语句，这个加 1 操作并不会改变有序性，但是 MySQL 优化器还是不能用 id 索引快速定位到 9999 这一行。所以，需要你在写 SQL 语句的时候，手动改写成 where id = 10000 -1 才可以。

## 2. 隐式类型转换
现在这里就有两个问题：
1. 数据类型转换的规则是什么？
2. 为什么有数据类型转换，就需要走全索引扫描？

### 2.1 类型转换规则
类型装换的规则有一个简单地额判断法方法，看 select “10” > 9 的结果：
1. 如果规则是“将字符串转成数字”，那么就是做数字比较，结果应该是 1；
2. 如果规则是“将数字转成字符串”，那么就是做字符串比较，结果应该是 0。


### 2.2 有类型转换，需要走全表扫描
试验一下便知道在 MySQL 中，字符串和数字做比较的话，是将字符串转换成数字。

```bash
# 示例表同上
mysql> select * from tradelog where tradeid=110717;

# 上面的 SQL 等同于
mysql> select * from tradelog where  CAST(tradid AS signed int) = 110717;
```

也就是说，上面这条语句触发了我们上面说到的规则：对索引字段做函数操作，优化器会放弃走树搜索功能。

## 3. 隐式字符编码转换
如果要查询 id=2 的交易的所有操作步骤信息，SQL 语句可以这么写：
```bash
mysql> select d.* from tradelog l, trade_detail d where d.tradeid=l.tradeid and l.id=2; /*语句Q1*/
```

使用 explain 观察这个 SQL 的执行你就会发现并没有使用 trade_detail tradeid 上的索引，而是作的全表扫描。而原因就是这两个表的字符集不同，一个是 utf8，一个是 utf8mb4。

![encoded](/images/mysql/MySQL45讲/encoded.png)

单独看步骤二，相当于执行 SQL `select * from trade_detail where tradeid=$L2.tradeid.value; `其中，$L2.tradeid.value 的字符集是 utf8mb4。字符集 utf8mb4 是 utf8 的超集，所以当这两个类型的字符串在做比较的时候，MySQL 内部的操作是，先把 utf8 字符串转成 utf8mb4 字符集，再做比较。

因此， 在执行上面这个语句的时候，需要将被驱动数据表里的字段一个个地转换成 utf8mb4，再跟 L2 做比较。也就是说，实际上这个语句等同于下面这个写法：

```bash
select * from trade_detail  where CONVERT(traideid USING utf8mb4)=$L2.tradeid.value; 
```

这就再次触发了我们上面说到的原则：对索引字段做函数操作，优化器会放弃走树搜索功能。到这里，你终于明确了，字符集不同只是条件之一，**连接过程中要求在被驱动表的索引字段上加函数操作**，是直接导致对被驱动表做全表扫描的原因。

如果要对上面的额语句作优化，有两种常见的做法:
1. 比较常见的优化方法是，把 trade_detail 表上的 tradeid 字段的字符集也改成 utf8mb4，这样就没有字符集转换的问题了。
2. 如果能够修改字段的字符集的话，是最好不过了。但如果数据量比较大， 或者业务上暂时不能做这个 DDL 的话，那就只能采用修改 SQL 语句的方法了。

```bash
# 主动把 l.tradeid 转成 utf8，就避免了被驱动表上的字符编码转换
mysql> select d.* from tradelog l , trade_detail d where d.tradeid=CONVERT(l.tradeid USING utf8) and l.id=2; 
```

## 4. 字符串截断
```bash
mysql> CREATE TABLE `table_a` (
  `id` int(11) NOT NULL,
  `b` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `b` (`b`)
) ENGINE=InnoDB;


# 假设现在表里面，有 100 万行数据，其中有 10 万行数据的 b 的值是’1234567890’
mysql> select * from table_a where b='1234567890abcd';
```
mysql 既不会判断字段 b 定义的是 varchar(10)，小于 "1234567890abcd" 长度直接返回空，也不是直接把’1234567890abcd’拿到索引里面去做匹配。而是:
1. **在传给引擎执行的时候，做了字符截断**。因为引擎里面这个行只定义了长度是 10，所以只截了前 10 个字节，就是’1234567890’进去做匹配；
2. 因为是 `select *`， 所以要做 10 万次回表；
3. 但是每次回表以后查出整行，到 server 层一判断，b 的值都不是’1234567890abcd’;
4. 返回结果是空。

