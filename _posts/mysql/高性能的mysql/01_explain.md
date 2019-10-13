---
title: 1 MYSQL EXPLAIN
date: 2019-10-08
categories:
    - 存储
tags:
    - mysql
---

你以为很懂，其实一点也不懂的 mysql。

<!-- more -->


## 1. mysql 开篇
说来惭愧，相比于入程序员这行的时间，对 mysql 的了解太少了。接下来的两个月里，希望借助于 [高性能的MySQL](https://github.com/ept/ddia-references) 一书和林晓斌老师的专栏 [MySQL实战45讲](https://time.geekbang.org/column/intro/100020801) 来系统的学习 MySQL。


在我们正式学习其他内容之前，我想先介绍一下如何调用“EXPLAIN”来获取关于查询执行计划的信息，以及如何解释输出。这将能帮助我们了解 mysql 在执行 sql 背后的每一步。我们将分成以下 4 个部分来介绍 EXPLAIN 的相关内容:
1. EXPLAIN 的三种用法
2. EXPLAIN 的数据
3. EXPLAIN 的缺陷
4. MySQL5.6 对EXPLAIN 的改进

## 2. EXPLAIN
### 2.1 EXPLAIN 用法
EXPLAIN 有三种用法:
1. `EXPLAIN SELECT ...`:
  - 显示出执行计划中的每一部分和执行的次序
  - 在查询中每个表在输出中只有一行,如果查询是两个表的联接，那么输出中将有两行
  - 别名表单算为一个表，“表”的意义在这里相当广，可以是一个子查询，一个UNION结果，等等
  - 输出中的行以MySQL实际执行的查询部分的顺序出现，而这个顺序不总是与其在原始SQL中的相一致，因为 MySQL查询优化器会优化 SQL 的执行顺序。
2. `EXPLAIN EXTENDED SELECT ...`:
  - 看起来和正常的EXPLAIN的行为一样，但它会告诉服务器“逆向编译”执行计划为一个SELECT语句
  - 可以通过紧接其后运行SHOW WARNINGS看到这个生成的语句。这个语句直接来自执行计划，而不是原SQL语句，到这点上已经变成一个数据结构。
3. `EXPLAIN PARTITIONS`:
  - 会显示查询将访问的分区，如果查询是基于分区表的话

下面是使用`EXPLAIN EXTENDED`的一个示例:

```sql
explain extended select * from floatTest \G
*************************** 1. row ***************************
           id: 1
  select_type: SIMPLE
        table: floatTest
         type: ALL
possible_keys: NULL
          key: NULL
      key_len: NULL
          ref: NULL
         rows: 2
     filtered: 100.00
        Extra:


show warnings \G
*************************** 1. row ***************************
  Level: Note
   Code: 1003
Message: select `enlightent_daily`.`floatTest`.`dd` AS `dd` from `enlightent_daily`.`floatTest`
```

需要注意的时，认为执行 EXPLAIN 时MySQL不会执行查询是错误。事实上，如果查询在FROM子句中包括子查询，那么MySQL实际上会执行子查询，将其结果放在一个临时表中，然后完成外层查询优化。

MySQL 必须在可以完成外层查询优化之前处理所有类似的子查询，这对于EXPLAIN来说是必须要做的。这意味着如果语句包含开销较大的子查询或使用临时表算法的视图，实际上会给服务器带来大量工作。这个限制将在 MySQL5.6 之后取消。


### 2.2 EXPLAIN 中的列
要想明白 EXPLAIN 的输出，首先我们要明白EXPLAIN 中的列的含义，其次是每个列可能的取值范围，以及每个值代表的含义。下面 EXPLAIN 输出的每一列的含义:

列名 | 含义
:---|:---
id|标识SELECT所属的行，内层的SELECT语句一般会顺序编号，对应于其在原始语句中的位置
select_type|表示对应行是简单还是复杂查询，如果复杂查询对应的是哪种复杂查询
table|对应行正在访问的表名
type|访问类型,即MySQL决定如何查找表中的行
possible_keys|显示了查询可以使用哪些索引
key|MySQL 决定采用哪个索引来优化对该表的访问，可以是不出现在 possible_keys 的索引
key_len|MySQL在索引里使用的字节数，可以用这个值来算出具体是哪些列
ref|显示了在key列记录的索引中查找值所用的列或常量
rows|MySQL估计为了找到所需的行而要读取的行数。这个数字是内嵌循环关联计划里的循环数目
filter|它显示的是针对表里符合某个条件（WHERE子句或联接条件）的记录数的百分比所做的一个悲观估算
Extra|不适合在其他列显示的额外信息



#### id
id 标识的是**SELECT**出现的顺序(不是表出现的顺序)。MySQL将SELECT查询分为简单和复杂类型，复杂类型可分成三大类：简单子查询、所谓的派生表（在FROM子句中的子查询），以及UNION查询。FROM子句中的子查询和联合给id列增加了更多复杂性。


#### select_type
select_type 表示查询的类型，有如下几种取值:
1. SIMPLE: 意味着查询不包括子查询和UNION
2. PRIMARY: 如果查询有任何复杂的子部分，则最外层部分标记为 PRIMARY,其他部分标记为下面几种类型
3. SUBQUERY: 表示在SELECT列表中的子查询中的SELECT（换句话说，不在FROM子句中）
4. DERIVED: 表示包含在FROM子句的子查询中的SELECT
5. UNION: UNION中的第二个和随后的SELECT被标记为UNION，SUBQUERY和UNION还可以被标记为DEPENDENT和UNCACHEABLE
6. UNION RESULT: 表示用来从UNION的匿名临时表检索结果的SELECT
7. DEPENDENT: 意味着SELECT依赖于外层查询中发现的数据
8. UNCACHEABLE: 意味着SELECT中的某些特性阻止结果被缓存于一个Item_cache中

#### table
table 对应行正在访问的表名，可以在这一列中从上往下观察MySQL的关联优化器为查询选择的关联顺序。当FROM子句中有子查询或有UNION时，table列会变得复杂得多:
1. 当在FROM子句中有子查询时，table列是<derivedN>的形式，其中N是子查询的id
2. 当有UNION时，UNION RESULT的table列包含一个参与UNION的id列表

下面是一个复杂SELECT的示例
```sql

    1  EXPLAIN
    2  SELECT actor_id,
    3  (SELECT 1 FROM sakila.film_actor WHERE film_actor.actor_id =
    4  der_1.actor_id LIMIT 1)
    5  FROM (
    6  SELECT actor_id
    7  FROM sakila.actor LIMIT 5
    8  ) AS der_1
    9  UNION ALL
    10 SELECT film_id,
    11 (SELECT @var1 FROM sakila.rental LIMIT 1)
    12 FROM (
    13 SELECT film_id,
    14 (SELECT 1 FROM sakila.store LIMIT 1)
    15 FROM sakila.film LIMIT 5
    16 ) AS der_2;
```

![EXPLAIIN 示例](/images/mysql/explain_select.jpg)

#### type
type 表示 MySQL 决定如何查找表中的行，从最差到最优有如下几种取值:
1. ALL:
  - 全表扫描，通常意味着MySQL必须扫描整张表，从头到尾，去找到需要的行
  - 有例外，如在查询里使用了LIMIT，或者在Extra列中显示“Using distinct/not exists”
2. index:
  - 这个跟全表扫描一样，只是MySQL扫描表时按索引次序进行而不是行，主要优点是避免了排序
  - 缺点是要承担按索引次序读取整个表的开销。这通常意味着若是按随机次序访问行，开销将会非常大
  - 如果在Extra列中看到“Using index”，说明MySQL正在使用覆盖索引，它只扫描索引的数据，而不是按索引次序的每一行
3. range：
  - 范围扫描就是一个有限制的索引扫描，比全索引扫描好一些，因为它用不着遍历全部索引
  - 当MySQL使用索引去查找一系列值时，例如IN()和OR列表，也会显示为范围扫描。然而，这两者其实是相当不同的访问类型，在性能上有重要的差异
4. ref:
  - 一种索引访问（有时也叫做索引查找），它返回所有匹配某个单个值的行
  - 只有当使用非唯一性索引或者唯一性索引的非唯一性前缀时才会发生
  - ref_or_null 是ref之上的一个变体，它意味着MySQL必须在初次查找的结果里进行第二次查找以找出NULL条目
5. eq_ref
  - 一种索引访问，MySQL知道最多只返回一条符合条件的记录
  - 在MySQL使用主键或者唯一性索引查找时发生
6. const, system
  - 当MySQL能对查询的某部分进行优化并将其转换成一个常量时，就会使用这些访问类型
  - 例如，如果你通过将某一行的主键放入WHERE子句里的方式来选取此行的主键，MySQL 就能把这个查询转换为一个常量。然后就可以高效地将表从联接执行中移除。
7. NULL
  - 这种访问方式意味着MySQL能在优化阶段分解查询语句，在执行阶段甚至用不着再访问表或者索引
  - 例如，从一个索引列里选取最小值可以通过单独查找索引来完成，不需要在执行时访问表。

#### possible_keys
possible_keys 显示了查询可以使用哪些索引,这个列表是在优化过程的早期，基于查询访问的列和使用的比较操作符创建的

#### key_len
MySQL在索引里使用的字节数， 它并不总显示一个索引真正使用了多少。例如，如果对一个前缀模式匹配执行LIKE查询，它会显示列的完全宽度正在被使用。

#### rows
rows 显示的行数不是MySQL认为它最终要从表里读取出来的行数，而是MySQL为了找到符合查询的每一点上标准的那些行而必须读取的行的平均数。根据表的统计信息和索引的选用情况，这个估算可能很不精确。在MySQL 5.0及更早的版本里，它也反映不出LIMIT子句。同时很多优化手段，例如关联缓冲区和缓存，无法影响到行数的显示。


#### filtered
MySQL 5.1里新加进去的，在使用EXPLAIN EXTENDED时出现。如果你把rows列和这个百分比相乘，就能看到MySQL估算它将和查询计划里前一个表关联的行数。


#### Extra
Extra 是额外的提示信息，常见的最重要的值如下：
1. Using index: MySQL将使用覆盖索引，以避免访问表
2. Using where:
  - MySQL服务器将在存储引擎检索行后再进行过滤
  - 不是所有带WHERE子句的查询都会显示“Using where”，因为在索引列上的 where在存储引擎就可以过滤
  - 有时“Using where”的出现就是一个暗示：查询可受益于不同的索引。
3. Using temporary: MySQL在对查询结果排序时会使用一个临时表。
4. Using filesort:
  - 这意味着MySQL会对结果使用一个外部索引排序，而不是按索引次序从表里读取行
  - MySQL有两种文件排序算法，两种方式都可以在内存或磁盘上完成。EXPLAIN不会告诉你MySQL将使用哪一种文件排序，也不会告诉你排序会在内存里还是磁盘上完成。
5. Range checked for each record (index map: N):
  - 意味着没有好用的索引，新的索引将在联接的每一行上重新估算
  - N是显示在possible_keys列中索引的位图，并且是冗余的

### 3. EXPLAIN 缺陷
EXPLAIN只是个近似结果，存在以下缺陷:
1. EXPLAIN根本不会告诉你触发器、存储过程或UDF会如何影响查询。
2. 它并不支持存储过程，尽管可以手动抽取查询并单独地对其进行EXPLAIN操作。
3. 它并不会告诉你MySQL在查询执行中所做的特定优化。
4. 它并不会显示关于查询的执行计划的所有信息
5. 它并不区分具有相同名字的事物。例如，它对内存排序和临时文件都使用“filesort”，并且对于磁盘上和内存中的临时表都显示“Using temporary”。
6. 可能会误导
7. MySQL EXPLAIN只能解释SELECT查询，并不会对存储程序调用和INSERT、UPDATE、DELETE或其他语句做解释。你可以重写某些非SELECT查询以利用EXPLAIN；MySQL5.6 之后将允许解释非 SELECT 操作

## 4. MySQL 5.6 对 EXPLAIN 的改进
MySQL 5.6中将包括一些对EXPLAIN的重要改进：
1. 能对类似UPDATE、INSERT等的查询进行解释。
2. 允许匿名的临时表尽可能晚地被具体化，而不总是在优化和执行使用到此临时表的部分查询时创建并填充它们。这将允许MySQL可以直接解释带子查询的查询语句，而不需要先实际地执行子查询

这些改进可以帮助我们更好的查看MySQL的执行计划，最后使用 Percona Toolkit包含的 **pt-visual-explain** 工具可以以树形格式查看查询计划，更加直观容易理解。
