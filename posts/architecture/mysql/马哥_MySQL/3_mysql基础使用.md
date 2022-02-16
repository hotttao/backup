---
title: 3 MARIADB 基础使用
date: 2019-10-08
categories:
    - 存储
tags:
    - 马哥 MySQL 运维
---

mariadb 基础使用

<!-- more -->

## 1.Mariadb 架构图

## 2. Mariadb 存储引擎
```bash
# 查看支持的所有存储引擎
> show engines

# 显示表状态信息
> use mysql
> show table status where engine="Aria" 

# 显示 Innodb 引擎的状态信息
> show engine innodb status \G

# 显示 myisam 引擎的状态信息
> show engine aria status;
```

### 2.1 Innodb 存储引擎
特性:
1. 适用于处理大量短事务，但不适用于处理长事务
2. 基于 MVCC 并发访问控制，支持四种隔离级别
3. 使用聚集索引，支持自适应 hash 索引，左前缀索引
4. 锁粒度: 行锁，间隙锁
5. 支持热备份

#### Innodb 表空间(tablespace)
```bash
ll /data/
总用量 122920
-rw-rw----. 1 mysql mysql    24576 3月  10 00:31 aria_log.00000001
-rw-rw----. 1 mysql mysql       52 3月  10 00:17 aria_log_control
-rw-rw----. 1 mysql mysql      888 3月  10 00:17 ib_buffer_pool
-rw-rw----. 1 mysql mysql 12582912 3月  10 00:17 ibdata1
-rw-rw----. 1 mysql mysql 50331648 3月  10 00:27 ib_logfile0   # 事务日志，通常以组的形式出现
-rw-rw----. 1 mysql mysql 50331648 3月  10 00:14 ib_logfile1   # 事务日志
-rw-rw----. 1 mysql mysql 12582912 3月  10 00:27 ibtmp1
-rw-rw----. 1 mysql mysql        6 3月  10 00:27 localhost.pid
-rw-rw----. 1 mysql mysql        0 3月  10 00:27 multi-master.info
drwx------. 2 mysql mysql     4096 3月  10 00:15 mysql
drwx------. 2 mysql mysql       20 3月  10 00:15 performance_schema
drwx------. 2 mysql mysql       20 3月  10 00:15 test

 ll /data/test/
总用量 120
-rw-rw----. 1 mysql mysql     65 3月  10 00:15 db.opt
-rw-rw----. 1 mysql mysql   1822 3月  10 00:54 test.frm
-rw-rw----. 1 mysql mysql 114688 3月  10 00:54 test.ibd
```

Innodb 的数据存储在表空间文件中，依据 innodb_file_per_table 是否启用分为两种不同的保存方式。

innodb_file_per_table=off
- 位置: 所有数据库的所有存储引擎为Innodb的表使用同一个表空间文件
  - datadir/ibdata[N]: 共用的表空间文件，用于保存所有Innodb表的数据和索引
  - 数据库目录/db_name.frm: 表结构定义保存在各个数据库目录下
- 特性: 不支持单表导入等高级特性

innodb_file_per_table=on
- 位置: 每表使用单独的表空间文件，位于各个数据库目录下
  - db_name.ibd: 表单独的表空间文件，用于存储单独表的数据和索引
  - db_name.frm: 用于存储表结构定义


### 2.2 Aria(MyISAM)
```bash
ll
总用量 140
-rw-rw----. 1 mysql mysql     65 3月  10 00:15 db.opt
-rw-rw----. 1 mysql mysql   1820 3月  10 01:35 t1.frm
-rw-rw----. 1 mysql mysql   8192 3月  10 01:35 t1.MAD
-rw-rw----. 1 mysql mysql   8192 3月  10 01:35 t1.MAI
```

存储: 每表有三个文件，保存在对应的数据库目录中
- db_name.frm: 表结构定义文件
- db_name.MAD: 数据文件
- db_name.MAI: 索引文件 


## 3.Mariadb 锁策略
Mariadb 的锁分为
1. Sever 级别锁: 又称为显示锁，可在 SQL 语句中自行决定是否加锁
2. 存储引擎级别锁: 存储引擎为了实现并发访问控制而自行施加的锁

### 3.1 显示锁的使用
```bash
# 锁定单表
LOCK TABLE tb_name [READ|WRITER]
UNLOCK TABLES 

# 锁定所有数据库所有表
FLUSH TABLES WITH [READ|WRITER] LOCK
UNLOCK TABLES

# 行锁
SELECT CLUASE FOR UPDATE             
SELECT CLUASE LOCK IN SHARE MODE     
```

## 4.用户与权限
### 4.1 权限类别
Mariadb 的权限分为以下几种类别
1. 库，表级别的权限
	- ALTER, CREATE, DROP
	- CREATE VIEW, SHOW VIEW
	- INDEX
	- GRANT OPTION：能够把自己获得的权限赠经其他用户一个副本；
2. 字段级别: [SELECT, INSERT, UPDATE]\(col1,col2,...\)DELETE
3. 管理类:
	- CREATE TEMPORARY TABLES
	- CREATE USER
	- FILE
	- SUPER
	- SHOW DATABASES
	- RELOAD
	- SHUTDOWN
	- REPLICATION SLAVE
	- REPLICATION CLIENT
	- LOCK TABLES
	- PROCESS
4. 程序类: [CREATE, ALTER, DROP, EXCUTE] * [FUNCTION, PROCEDURE, TRIGGER]
5. 所有权限: ALL PRIVILEGES, ALL
			
### 4.2 权限保存位置
所有的授权都保存在 mariadb 的元数据数据库 mysql 的如下表中:
1. db, 
2. user
3. columns_priv
4. tables_priv
5. procs_priv
6. proxies_priv
7. global_priv

### 4.3 账号管理
```bash
# 创建用户：CREATE USER
CREATE USER 'USERNAME'@'HOST' [IDENTIFIED BY 'password']；

# 查看用户获得的授权：SHOW GRANTS FOR
SHOW GRANTS FOR 'USERNAME'@'HOST'

# 用户重命名：RENAME USER
RENAME USER old_user_name TO new_user_name

# 删除用户
DROP USER 'USERNAME'@'HOST'

# 修改密码：
SET PASSWORD FOR 'bob'@'%.loc.gov' = PASSWORD('newpass');
UPDATE mysql.user SET password=PASSWORD('your_password') WHERE clause;
```

修改密码还可以使用 mysqladmin命令: `mysqladmin password "new_password" -uroot -h -p`

### 4.4 忘记管理员密码
```bash
systemctl stop mariadb

# 1. 为 mariadb 添加 --skip-grant-tables --skip-networking 参数
vim /usr/lib/systemd/system/mariadb.service  # 在 ExecStart 后添加

systemctl start mariadb

# 2. 登录mariadb 并使用 UPDATE 命令修改管理员密码
update mysql.user set password=PASSWORD("1234") where user="root";

# 3. 关闭mysqld进程，移除上述两个选项，重启mysqld; 
```


### 4.5 授权
授权:
- `GRANT priv_type[,...]` 
- `ON [{table|function|procedure}] db.{table|routine}` 
- `TO 'USERNAME'@'HOST'` 
- `[IDENTIFIED BY 'password']`
- `[REQUIRE SSL]`
- `[WITH with_option]`

查看授权:
`SHOW GRANTS [FOR "user"@"host"]`

收回授权:
- `REVOKE priv_type[,...]`
- `ON [{table|function|procedure}] db.{table|routine}`
- `FROM user [, user]` 


## 7.查询缓存
查询缓存：
1. 如何判断是否命中：通过查询语句的哈希值判断：哈希值考虑的因素包括查询本身、要查询的数据库、客户端使用协议版本。查询语句任何字符上的不同，都会导致缓存不能命中；
2. 哪此查询可能不会被缓存: 查询中包含UDF、存储函数、用户自定义变量、临时表、mysql库中系统表、或者包含列级权限的表、有着不确定值的函数`(Now())`; 

### 7.1 查询缓存相关的服务器变量
- `query_cache_min_res_unit`: 查询缓存中内存块的最小分配单位；
	- 较小值会减少浪费，但会导致更频繁的内存分配操作；
	- 较大值会带来浪费，会导致碎片过多；
- `query_cache_limit`：能够缓存的最大查询结果，对于有着较大结果的查询语句，建议在SELECT中使用SQL_NO_CACHE
- `query_cache_size`：查询缓存总共可用的内存空间；单位是字节，必须是1024的整数倍；
- `query_cache_type`:
	- 可选值:
	  - OFF: 不启用，显示指定 SQL_CACHE 也不会缓存
	  - ON: 启用，可以使用 SQL_NO_CACHE 显示指定不缓存查询结果
	  - DEMAND: 按需启用，即可以使用 SQL_CACHE 显示指定缓存查询结果
- `query_cache_wlock_invalidate`：如果某表被其它的连接锁定，是否仍然可以从查询缓存中返回结果；默认值为OFF，表示可以在表被其它连接锁定的场景中继续从缓存返回数据；ON则表示不允许；

### 7.2 查询相关的状态变量
缓存命中率的评估：Qcache_hits/Com_select

```bash
> SHOW GLOBAL STATUS LIKE 'Qcache%';
+-------------------------+----------+
| Variable_name           | Value    |
+-------------------------+----------+
| Qcache_free_blocks      | 1        |
| Qcache_free_memory      | 16759688 |   # 分配未使用的缓存块
| Qcache_hits             | 0        |   # 缓存命中次数
| Qcache_inserts          | 0        |   # 已经插入的缓存条目
| Qcache_lowmem_prunes    | 0        |   # 因为内存太小，而被动失效缓存
| Qcache_not_cached       | 0        |
| Qcache_queries_in_cache | 0        |   # 缓存的查询语句数
| Qcache_total_blocks     | 1        |   # 已经分配的缓存块
+-------------------------+----------+

> show global status like "Com_select";
+---------------+-------+
| Variable_name | Value |
+---------------+-------+
| Com_select    | 26    |                 # 查询次数
+---------------+-------+
```

## 8.索引
索引优点：
  	- 索引可以降低服务需要扫描的数据量，减少了IO次数；
	- 索引可以帮助服务器避免排序和使用临时表；
	- 索引可以帮助将随机I/O转为顺序I/O；

高性能索引策略：
	- 独立使用列，尽量避免其参与运算；
	- 左前缀索引：索引构建于字段的左侧的多少个字符，要通过索引选择性来评估
	- 索引选择性：不重复的索引值和数据表的记录总数的比值；
	- 多列索引：AND操作时更适合使用多列索引；
	- 选择合适的索引列次序：将选择性最高放左侧；


```bash
# 查看表的索引
> SHOW INDEX FROM tb_name
```

### 8.1 B+ Tree
B+ Tree索引：
- 特点: 顺序存储，每一个叶子节点到根结点的距离是相同的；左前缀索引，适合查询范围类的数据；
- 适用: 可以使用B-Tree索引的查询类型：全键值、键值范围或键前缀查找；
	- 全值匹配：精确某个值, "Jinjiao King"；
	- 匹配最左前缀：只精确匹配起头部分，"Jin%"
	- 匹配范围值：
	- 精确匹配某一列并范围匹配另一列：
	- 只访问索引的查询
- 不适用:
	- 如果不从最左列开始，索引无效； (Age,Name)
	- 不能跳过索引中的列；(StuID,Name,Age)
	- 如果查询中某个列是为范围查询，那么其右侧的列都无法再使用索引优化查询；(StuID,Name)

### 8.2 Hash 索引
Hash索引：
- 特点: 基于哈希表实现，特别适用于精确匹配索引中的所有列；
- 注意：只有Memory存储引擎支持显式hash索引；
- 适用： 只支持等值比较查询，包括=, IN(), <=>; 
- 不适合: 
	- 存储的非为值的顺序，因此，不适用于顺序查询；
	- 不支持模糊匹配；

### 8.3 EXPLAIN
`EXPLAIN SELECT clause`
- 作用: 获取查询执行计划信息，用来查看查询优化器如何执行查询；
- 输出：
	- id: 当前查询语句中，每个SELECT语句的编号；
	- select_type：
		- 简单查询为SIMPLE
		- 复杂查询：
			- SUBQUERY: 简单子查询；
			- DERIVED: 用于FROM中的子查询；
			- PRIMARY: 联合查询中的第一个查询
			- UNION: 联合查询中的第一个查询之后的其他查询
			- UNION RESULT: 联合查询生成的临时表
			- 注意：UNION查询的分析结果会出现一外额外匿名临时表；
 	- table：SELECT语句关联到的表；
	- type：关联类型，或访问类型，即MySQL决定的如何去查询表中的行的方式；
		- ALL: 全表扫描；
		- index：根据索引的次序进行全表扫描；如果在Extra列出现“Using index”表示了使用覆盖索引，而非全表扫描；
		- range：有范围限制的根据索引实现范围扫描；扫描位置始于索引中的某一点，结束于另一点；
		- ref: 根据索引返回表中匹配某单个值的所有行；
		- eq_ref: 根据索引返回表中匹配某单个值的单一行，仅返回一行；
		- const, system: 与常量比较，直接返回单个行；
	- possible_keys：查询可能会用到的索引；
	- key: 查询中使用了的索引；
	- key_len: 在索引使用的字节数；
	- ref: 在利用key字段所表示的索引完成查询时所有的列或某常量值；
	- rows：MySQL估计为找所有的目标行而需要读取的行数；
	- Extra：额外信息
	    - Using index condition：使用索引进行条件过滤
		- Using index：MySQL将会使用覆盖索引，以避免访问表；
		- Using where：MySQL服务器将在存储引擎检索后，再进行一次过滤；
		- Using temporary：MySQL对结果排序时会使用临时表；
		- Using filesort：对结果使用一个外部索引排序；
