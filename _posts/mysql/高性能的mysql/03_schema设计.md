---
title: 3 Schema 设计
date: 2019-10-03
categories:
    - 存储
tags:
    - 高性能的MySQL
---

mysql 的 Schema 设计

<!-- more -->

## 1. 前言
上一节我们简述了 MySQL 中的数据类型，本节我们来说一说 MySQL 的 Schema 设计，包括以下内容:
1. MySQL 特有的 Schema 设计问题，这是由 MySQL 特定的实现机制导致的
2. Schema 设计的范式和反范式
3. 为提升读性能，而常采用的技巧，缓存表和汇总表

最后我们会简单说一下加快 ALTER TABLE 操作速度的方法。下面大部分内容摘自：《高性能MySQL》 — 〔美〕施瓦茨 (Baron Schwartz)  〔美〕扎伊采夫 (Peter Zaitsev)  〔美〕特卡琴科 (Vadim Tkachenko)
在豆瓣阅读书店查看：https://read.douban.com/ebook/35648568/

## 2. MySQL schema设计中的陷阱
有一些问题是由MySQL的实现机制导致的，我们需要避免下面只会在 MySQL 中发生的特定问题:
1. 太多的列
  - MySQL的存储引擎，需要在服务器层和存储引擎层之间通过行缓冲格式拷贝数据，然后在服务器层将缓冲内容解码成各个列
  - 从行缓冲中将编码过的列转换成行数据结构的代价依赖于列的数量
  - 如果计划使用数千个字段，必须意识到服务器的性能运行特征会有一些不同。
2. 太多的关联
  - MySQL限制了每个关联操作最多只能有61张表
  - 事实上在许多关联少于61张表的情况下，解析和优化查询的代价也会成为MySQL的问题
  - 经验法则，单个查询最好在12个表以内做关联
3. NULL 的使用:
  - 避免使用NULL的好处，但是也不能走极端
  - 在一些场景中，使用NULL可能会比某个神奇常数更好，以避免引入Bug
  - 伪造的全0值可能导致很多问题（可以配置MySQL的SQL_MODE来禁止不可能的日期）
  - MySQL会在索引中存储NULL值，而Oracle则不会

## 2. 范式和反范式
范式和反范式反映的是 MySQL 数据冗余程度。在范式化的数据库中，每个事实数据会出现并且只出现一次。相反，在反范式化的数据库中，信息是冗余的，可能会存储在多个地方。范式和反范式有他们各自的有缺点。

### 2.1 范式的优缺点
范式，特别适用于写密集的场景，原因在于:
- 当数据较好地范式化时，就只有很少或者没有重复数据，所以只需要修改更少的数据
- 很少有多余的数据意味着检索列表数据时更少需要DISTINCT或者GROUP BY语句

范式化的缺点是通常需要关联。这不但代价昂贵，也可能使一些索引策略无效。例如，范式化可能将列存放在不同的表中，而这些列如果在一个表中本可以属于同一个索引。

### 2.2 反范式的优点和缺点
反范式化的schema因为所有数据都在一张表中，所以有下面这些优点:
1. 可以很好地避免关联
2. 当数据比内存大时这可能比关联要快得多，因为这样避免了随机I/O
3. 单独的表也能使用更有效的索引策略。

### 2.3 混用范式化和反范式化
范式化和反范式化的schema各有优劣，在实际应用中经常需要混用，可能使用部分范式化的schema、缓存表，以及其他技巧。最常见的反范式化数据的方法是复制或者缓存，在不同的表中存储相同的特定列。在MySQL 5.0和更新版本中，可以使用触发器更新缓存值，这使得实现这样的方案变得更简单。另一个从父表冗余一些数据到子表的理由是排序的需要。


## 3. 缓存表和汇总表
为了提升读查询的速度，经常会需要建一些额外索引，增加冗余列，甚至是创建缓存表和汇总表。下面这方面技巧的专用术语:
- 缓存表: 来表示存储那些可以比较简单地从schema其他表获取（但是每次获取的速度比较慢）数据的表
- 汇总表: 用来保存使用GROUP BY语句聚合数据的表
- 物化视图: 实际上是预先计算并且存储在磁盘上的表，可以通过各种各样的策略刷新和更新
- 计数器表: 专用来计数的表

下面我们来一一介绍这些使用技巧。

### 3.1 汇总表
以网站为例，假设需要计算之前24小时内发送的消息数，我们可以每小时生成一张汇总表，并使用下面的 SQL 进行计算:
```SQL

CREATE TABLE msg_per_hr (
   hr DATETIME NOT NULL,
   cnt INT UNSIGNED NOT NULL,
   PRIMARY KEY(hr)
);


mysql> SELECT SUM(cnt) FROM msg_per_hr
    -> WHERE hr BETWEEN
    ->   CONCAT(LEFT(NOW(), 14), '00:00') - INTERVAL 23 HOUR
    ->   AND CONCAT(LEFT(NOW(), 14), '00:00') - INTERVAL 1 HOUR;
mysql> SELECT COUNT(*) FROM message
    -> WHERE posted >= NOW() - INTERVAL 24 HOUR
    ->   AND posted < CONCAT(LEFT(NOW(), 14), '00:00') - INTERVAL 23 HOUR;
mysql> SELECT COUNT(*) FROM message
    -> WHERE posted >= CONCAT(LEFT(NOW(), 14), '00:00');
```

### 3.2 缓存表
缓存表的一个有用的技巧是对缓存表使用不同的存储引擎例如，如果主表使用InnoDB，用MyISAM作为缓存表的引擎将会得到更小的索引占用空间，并且可以做全文搜索。有时甚至可以把整个表导出MySQL，插入到专门的搜索系统中获得更高的搜索效率。

在使用缓存表和汇总表时，必须决定是实时维护数据还是定期重建。哪个更好依赖于应用程序，但是定期重建并不只是节省资源，也可以保持表不会有很多碎片，以及有完全顺序组织的索引（这会更加高效）。

当重建汇总表和缓存表时，通常需要保证数据在操作时依然可用。这就需要通过使用“影子表”来实现，下面是影子表的使用技巧:

```SQL
mysql> DROP TABLE IF EXISTS my_summary_new, my_summary_old;
mysql> CREATE TABLE my_summary_new LIKE my_summary;
-- populate my_summary_new as desired
mysql> RENAME TABLE my_summary TO my_summary_old, my_summary_new TO my_summary;

```


### 3.3 物化视图(额外学习)
。MySQL并不原生支持物化视图。可以使用开源工具[Flexviews](http://code.google.com/p/flexviews/) 在 MySQL中实现物化视图。

对比传统的维护汇总表和缓存表的方法，Flexviews通过提取对源表的更改，可以增量地重新计算物化视图的内容。这意味着不需要通过查询原始数据来更新视图。

### 3.2 计数器表
计数器表可以统计计数，但是计数器表可能会碰到并发问题。

要获得更高的并发更新性能，一种方案是可以将计数器保存在多行中，每次随机选择一行进行更新。像下面这样

```SQL
# 1. 创建如下计数表
mysql> CREATE TABLE hit_counter (
    ->   slot tinyint unsigned not null primary key,
    ->   cnt int unsigned not null
    -> ) ENGINE=InnoDB;

# 2. 预先增加100行数据
# 3. 现在选择一个随机的槽（slot）进行更新
mysql> UPDATE hit_counter SET cnt = cnt + 1 WHERE slot = RAND() * 100;
```

如果像每天开始一个计数器，可以像下面这样:
```SQL
# 1. 创建下表
mysql> CREATE TABLE daily_hit_counter (
    ->   day date not null,
    ->   slot tinyint unsigned not null,
    ->   cnt int unsigned not null,
    ->   primary key(day, slot)
    -> ) ENGINE=InnoDB;

# 2. 使用 ON DUPLICATE 进行更新
mysql> INSERT INTO daily_hit_counter(day, slot, cnt)
    ->   VALUES(CURRENT_DATE, RAND() * 100, 1)
    ->   ON DUPLICATE KEY UPDATE cnt = cnt + 1;

# 3. 希望减少表的行数，避免表变大，可以写一个周期执行的任务，
# 合并所有结果到0号槽，并且删除所有其他的槽：
mysql> UPDATE daily_hit_counter as c
    ->   INNER JOIN (
    ->     SELECT day, SUM(cnt) AS cnt, MIN(slot) AS mslot
    ->     FROM daily_hit_counter
    ->     GROUP BY day
    ->    ) AS x USING(day)
    -> SET c.cnt = IF(c.slot = x.mslot, x.cnt, 0),
    ->    c.slot = IF(c.slot = x.mslot, 0, c.slot);
mysql> DELETE FROM daily_hit_counter WHERE slot <> 0 AND cnt = 0;
```

## 4. 加速ALTER TABLE操作
MySQL的ALTER TABLE操作的性能对大表来说是个大问题。MySQL执行大部分修改表结构操作的方法是用新的结构创建一个空表，从旧表中查出所有数据插入新表，然后删除旧表。这样操作可能需要花费很长时间，如果内存不足而表又很大，而且还有很多索引的情况下尤其如此。

大部分ALTER TABLE操作将导致MySQL服务中断，常见场景中，避免中断的技巧只有两个:
1. 一种是先在一台不提供服务的机器上执行ALTER TABLE操作，然后和提供服务的主库进行切换
2. 另外一种技巧是“影子拷贝”。影子拷贝的技巧是用要求的表结构创建一张和源表无关的新表

一些工具可以帮助完成影子拷贝工作：
1. [Facebook数据库运维团队的“online schema change”工具](https://launchpad.net/mysqlatfacebook)
2. [Shlomi Noach的openark toolkit](http://code.openark.org/)
3. [Percona Toolkit](http://www.percona.com/software/)
4. 如果使用Flexviews，也可以通过其CDC工具执行无锁的表结构变更

一些特殊的 ALTER TABLE 操作则有特殊的优化技巧。

### 4.1 更改列的默认值
默认像下面更改列的默认值会导致表重建:
```SQL
# 1. 所有的MODIFY COLUMN操作都将导致表重建。
mysql> ALTER TABLE sakila.film
    -> MODIFY COLUMN rental_duration TINYINT(3) NOT NULL DEFAULT 5;

mysql> SHOW STATUS显
```

理论上，MySQL可以跳过创建新表的步骤。列的默认值实际上存在表的.frm文件中，所以可以直接修改这个文件而不需要改动表本身。另外一种方法是通过ALTER COLUMN操作来改变列的默认值：

```SQL

mysql> ALTER TABLE sakila.film
    -> ALTER COLUMN rental_duration SET DEFAULT 5;

```
这个语句会直接修改.frm文件而不涉及表数据。所以，这个操作是非常快的。ALTER TABLE允许使用ALTER COLUMN、MODIFY COLUMN和CHANGE COLUMN语句修改列。这三种操作都是不一样的。


### 4.2 只修改.frm文件
下面要演示的技巧是不受官方支持的，也没有文档记录，并且也可能不能正常工作，采用这些技术需要自己承担风险。建议在执行之前首先备份数据！下面这些操作是有可能不需要重建表的：
1. 移除（不是增加）一个列的AUTO_INCREMENT属性。
2. 增加、移除，或更改ENUM和SET常量。如果移除的是已经有行数据用到其值的常量，查询将会返回一个空字串值。

基本的技术是为想要的表结构创建一个新的.frm文件，然后用它替换掉已经存在的那张表的.frm文件，像下面这样：
1. 创建一张有相同结构的空表，并进行所需要的修改（例如增加ENUM常量）。
2. 执行`FLUSH TABLES WITH READ LOCK` 这将会关闭所有正在使用的表，并且禁止任何表被打开
3. 交换.frm文件
4. 执行UNLOCK TABLES来释放第2步的读锁

### 4.3 快速创建MyISAM索引
为了高效地载入数据到MyISAM表中，有一个常用的技巧是先禁用索引、载入数据，然后重新启用索引：

```SQL
mysql> ALTER TABLE test.load_data ENABLE KEYS;
-- load the data
mysql> ALTER TABLE test.load_data ENABLE KEYS;
```

这个技巧能够发挥作用，是因为构建索引的工作被延迟到数据完全载入以后，这个时候已经可以通过排序来构建索引了。这样做会快很多，并且使得索引树的碎片更少、更紧凑。

这个办法对唯一索引无效，因为DISABLE KEYS只对非唯一索引有效。MyISAM会在内存中构造唯一索引，并且为载入的每一行检查唯一性。一旦索引的大小超过了有效内存大小，载入操作就会变得越来越慢。

在现代版本的InnoDB版本中，有一个类似的技巧，这依赖于InnoDB的快速在线索引创建功能。这个技巧是，先删除所有的非唯一索引，然后增加新的列，最后重新创建删除掉的索引。Percona Server可以自动完成这些操作步骤。

也可以使用像前面说的ALTER TABLE的骇客方法来加速这个操作，但需要多做一些工作并且承担一定的风险。这对从备份中载入数据是很有用的，例如，当已经知道所有数据都是有效的并且没有必要做唯一性检查时就可以这么来操作。下面是操作步骤：
1. 用需要的表结构创建一张表，但是不包括索引。
2. 载入数据到表中以构建.MYD文件。
3. 按照需要的结构创建另外一张空表，这次要包含索引。这会创建需要的.frm和.MYI文件。
4. 获取读锁并刷新表。
5. 重命名第二张表的.frm和.MYI文件，让MySQL认为是第一张表的文件。
6. 释放读锁。
7. 使用REPAIR TABLE来重建表的索引。该操作会通过排序来构建所有索引，包括唯一索引。
这个操作步骤对大表来说会快很多。
