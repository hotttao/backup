---
title: 27 MYSQL flush privileges
date: 2020-03-27
categories:
    - 存储
tags:
    - 极客时间
    - MySQL实战45讲
---

grant 之后要不要跟 flush privileges

<!-- more -->

## 1. 用户权限
MySQL 使用 `create user` 来创建用户。

`create user 'ua'@'%' identified by 'pa';` 的执行过程如下:
1. 磁盘上，往 mysql.user 表里插入一行，由于没有指定权限，所以这行数据上所有表示权限的字段的值都是 N；
2. 内存里，往数组 acl_users 里插入一个 acl_user 对象，这个对象的 access 字段值为 0。

在 MySQL 中，用户权限是有不同的范围的。从大到小的顺序依次是:
1. 全局权限
2. db 权限
3. 表权限和列权限

### 1.1 全局权限
全局权限，作用于整个 MySQL 实例，这些权限信息保存在 mysql 库的 user 表里。

```bash
# 1. 赋予 ua 全局权限
grant all privileges on *.* to 'ua'@'%' with grant option;
```

这个 grant 命令做了两个动作：
1. 磁盘上，将 mysql.user 表里，用户’ua’@’%'这一行的所有表示权限的字段的值都修改为‘Y’；
2. 内存里，从数组 acl_users 中找到这个用户对应的对象，将 access 值（权限位）修改为二进制的“全 1”

在这个 grant 命令执行完成后，如果有新的客户端使用用户名 ua 登录成功，MySQL 会为新连接维护一个线程对象，然后从 acl_users 数组里查到这个用户的权限，并将权限值拷贝到这个线程对象中。之后在这个连接中执行的语句，所有关于全局权限的判断，都直接使用线程对象内部保存的权限位。

基于上面的分析我们可以知道：
1. grant 命令对于全局权限，同时更新了磁盘和内存。命令完成后即时生效，接下来新创建的连接会使用新的权限。
2. 对于一个已经存在的连接，它的全局权限不受 grant 命令的影响。

收回全局权限使用下面的 revoke 命令:
```bash
revoke all privileges on *.* from 'ua'@'%';
```

这条 revoke 命令的用法与 grant 类似，做了如下两个动作：
1. 磁盘上，将 mysql.user 表里，用户’ua’@’%'这一行的所有表示权限的字段的值都修改为“N”；
2. 内存里，从数组 acl_users 中找到这个用户对应的对象，将 access 的值修改为 0。

另外  grant 语句赋权时，可能还会看到这样的写法：
```bash
grant super on *.* to 'ua'@'%' identified by 'pa';
```

这条命令加了 identified by ‘密码’， 语句的逻辑里面除了赋权外，还包含了：
1. 如果用户’ua’@’%'不存在，就创建这个用户，密码是 pa；
2. 如果用户 ua 已经存在，就将密码修改成 pa。

这是一种不建议的写法，因为这种写法很容易就会不慎把密码给改了。

### 1.2 db 权限
```bash
# 赋予 ua 数据库 db1 的操作权限
grant all privileges on db1.* to 'ua'@'%' with grant option;
```
基于库的权限记录保存在 mysql.db 表中，在内存里则保存在数组 acl_dbs 中。这条 grant 命令做了如下两个动作：
1. 磁盘上，往 mysql.db 表中插入了一行记录，所有权限位字段设置为“Y”；
2. 内存里，增加一个对象到数组 acl_dbs 中，这个对象的权限位为“全 1”。

每次需要判断一个用户对一个数据库读写权限的时候，都需要遍历一次 acl_dbs 数组，根据 user、host 和 db 找到匹配的对象，然后根据对象的权限位来判断。

也就是说，grant 修改 db 权限的时候，是同时对磁盘和内存生效的。

#### 已存在连接的权限
grant 操作对于已经存在的连接的影响，在全局权限和基于 db 的权限效果是不同的。

![grant_connect](/images/mysql/MySQL45讲/grant_connect.png)

从上面这个操作序列我们可以看到:
1. super 是全局权限，这个权限信息在线程对象中，而 revoke 操作影响不到这个线程对象。
2. acl_dbs 是一个全局数组，所有线程判断 db 权限都用这个数组，这样 revoke 操作马上就会影响到 session B。
3. 代码实现上有一个特别的逻辑，如果当前会话已经处于某一个 db 里面，之前 use 这个库的时候拿到的库权限会保存在会话变量中。session C 在 T2 时刻执行的 use db1，拿到了这个库的权限，在切换出 db1 库之前，session C 对这个库就一直有权限。

### 1.3 表权限和列权限
表权限定义存放在表 mysql.tables_priv 中，列权限定义存放在表 mysql.columns_priv 中。这两类权限，组合起来存放在内存的 hash 结构 column_priv_hash 中。

```bash
create table db1.t1(id int, a int);

grant all privileges on db1.t1 to 'ua'@'%' with grant option;
GRANT SELECT(id), INSERT (id,a) ON mydb.mytbl TO 'ua'@'%' with grant option;
```

跟 db 权限类似，这两个权限每次 grant 的时候都会修改数据表，也会同步修改内存中的 hash 结构。因此，对这两类权限的操作，也会马上影响到已经存在的连接。

## 2. flush privileges
从上面的分析来看，grant 语句都是即时生效的，不需要执行 flush privileges 语句。

flush privileges 命令会清空 acl_users 数组，然后从 mysql.user 表中读取数据重新加载，重新构造一个 acl_users 数组。对于 db 权限、表权限和列权限，MySQL 也做了这样的处理。

也就是说，如果内存的权限数据和磁盘数据表相同的话，不需要执行 flush privileges。而如果我们都是用 grant/revoke 语句来执行的话，内存和数据表本来就是保持同步更新的。

因此，grant 语句会同时修改数据表和内存，判断权限的时候使用的是内存数据。因此，规范地使用 grant 和 revoke 语句，是不需要随后加上 flush privileges 语句的。

### 2.1 需要执行 flush privilege 的场景
显然，当数据表中的权限数据跟内存中的权限数据不一致的时候，flush privileges 语句可以用来重建内存数据，达到一致状态。这种不一致往往是由不规范的操作导致的，比如直接用 DML 语句操作系统权限表。