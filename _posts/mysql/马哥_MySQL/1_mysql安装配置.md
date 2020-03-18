---
title: 1 MYSQL 安装配置
date: 2020-03-01
categories:
    - 存储
tags:
    - mysql运维
---

mariadb 安装配置

<!-- more -->


## 1. mariadb 简介
自从 mysql 被 Oracle 收购之后，由于担心版权问题，mysql 的创始人就新建了另一开源分支 mariadb，在 Centos6 中默认安装的是 mysql，而在 Centos7 中默认安装的已经是  mariadb。mariadb 跟 mysql 底层的基础特性是类似的，但是高级特性有很大不同，彼此支持的高级功能也不相同。除了 mariadb，mysql还有很多二次发行版本，比如`Percona`，`AllSQL`(阿里的mysql 发行版)以及，`TIDB`

mysql 与 mariadb 的官网分别是：
- www.mysql.com
- MariaDB: www.mariadb.org

### 1.1 mariadb 特性
mariadb 有两个比较重要的特性，一个是它是一个单进程多线程程序，另一个是支持插件式存储引擎，即存储管理器有多种实现版本，彼此间的功能和特性可能略有区别；用户可根据需要灵活选择。存储引擎也称为“表类型”。常见的存储引擎就是
1. `MyISAM`:不支持事务和表级锁，奔溃后不保证安全恢复；
2. `InnoDB`: 支持事务，行级锁，外键和热备份；

`MyISAM` 在 mariadb 中被扩展为 `Aria`，支持安全恢复, `InnoDB` 在 Mariadb 中的开源实现为 `XtraDB`。在 mysql 的客户端中输入 `show engines` 即可查看 mariadb 支持的所有存储引擎。

```
MariaDB [(none)]> show engines;
+--------------------+---------+----------------------------------------------------------------------------+--------------+------+------------+
| Engine             | Support | Comment                                                                    | Transactions | XA   | Savepoints |
+--------------------+---------+----------------------------------------------------------------------------+--------------+------+------------+
| CSV                | YES     | CSV storage engine                                                         | NO           | NO   | NO         |
| MRG_MYISAM         | YES     | Collection of identical MyISAM tables                                      | NO           | NO   | NO         |
| MEMORY             | YES     | Hash based, stored in memory, useful for temporary tables                  | NO           | NO   | NO         |
| BLACKHOLE          | YES     | /dev/null storage engine (anything you write to it disappears)             | NO           | NO   | NO         |
| MyISAM             | YES     | MyISAM storage engine                                                      | NO           | NO   | NO         |
| InnoDB             | DEFAULT | Percona-XtraDB, Supports transactions, row-level locking, and foreign keys | YES          | YES  | YES        |
| ARCHIVE            | YES     | Archive storage engine                                                     | NO           | NO   | NO         |
| FEDERATED          | YES     | FederatedX pluggable storage engine                                        | YES          | NO   | YES        |
| PERFORMANCE_SCHEMA | YES     | Performance Schema                                                         | NO           | NO   | NO         |
| Aria               | YES     | Crash-safe tables with MyISAM heritage                                     | NO           | NO   | NO         |
+--------------------+---------+----------------------------------------------------------------------------+--------------+------+------------+
```

### 1.2 MariaDB程序的组成
mariadb 是 C/S 架构的服务，其命令分为服务器端和客户端两个部分
- C：Client
    - mysql：CLI交互式客户端程序；
    - mysqldump：备份工具；
    - mysqladmin：管理工具；
    - mysqlbinlog： 
    - ...
- S：Server
    - mysqld：默认的 mariadb 启动的守护进程
    - mysqld_safe：mariadb 线程安全版本，通常在线上环境安装的是此服务而不是 mysqld；
    - mysqld_multi：用于在单主机上运行多 mariadb 实例的服务

msyql 服务器可监听在两种套接字上
1. IPV4/6 的 tcp 的 3306 端口上，支持远程通信
2. Unix Sock，监听在 socket 文件上，仅支持本地通信，套接子文件通常位于 `/var/lib/mysql/mysql.sock`或 `/tmp/mysql.sock` 由配置文件指定。

```
ll /var/lib/mysql/mysql.sock
srwxrwxrwx. 1 mysql mysql 0 8月  21 11:10 /var/lib/mysql/mysql.sock
```

## 2. MariaDB 安装
与其他软件一样，Mariadb 常见的安装方式有如下三种:
1. rpm包；由OS的发行商提供，或从程序官方直接下载
2. 源码包编译安装: 编译安装，除非需要定制功能，否则一般不推荐编译安装
3. 通用二进制格式的程序包: 展开至特定路径，并经过简单配置后即可使用，这种方式便于部署，无需解决环境依赖

通常情况下，为了便于自动化安装配置，我们都会以 rpm 包的方式进行安装，Centos7 中安装 mariadb 的命令如下：

```bash
yum install mariadb-server

# 如果修改了mysql 默认保存数据的存储目录 datadir，需要重新执行 mysql_install_db
mysql_install_db --user=mysql --datadir=/data
```

### 2.1 初始化配置
mysql的用户账号由两部分组成：`'USERNAME'@'HOST'`; `HOST`: 用于限制此用户可通过哪些远程主机连接当前的mysql服务.HOST的表示方式，支持使用通配符：
- `%`：匹配任意长度的任意字符；
- `172.16.%.%` == `172.16.0.0/16`
- `_`：匹配任意单个字符；

默认情况下 mysql 登陆时会对客户端的 IP 地址进行反解，这种反解一是浪费时间可能导致阻塞，二是如果反解成功而 mysql 在授权时只授权了 IP 地址而没有授权主机名，依旧无法登陆，所以在配置 mysql 时都要关闭名称反解功能。

```
vim  /etc/my.cnf  # 添加三个选项：
datadir = /mydata/data
innodb_file_per_table = ON
skip_name_resolve = ON
```

### 2.2 mysql 安全初始化
默认安装的情况下 mysql root 帐户是没有密码的，可通过 mysql 提供的安全初始化脚本，快速进行安全初始化。
```
# 查看mysql用户及其密码
mysql
> use mysql;
> select user,host,password from user;

# 运行脚本安全初始化脚本
/user/local/mysql/bin/mysql_secure_installation
```

##  3. Mariadb 配置
### 3.1 配置文件格式

mysql 的配置文件是 ini 风格的配置文件；客户端和服务器端的多个程序可通过一个配置文件进行配置，使用 `[program_name]` 标识配置的程序即可：
- mysqld：配置 mysqld 服务
- mysqld_safe：配置 mysqld_safe 服务
- server：适用于所有服务
- mysql：mysql 命令行客户端配置
- mysqldump：mysqldump 配置
- client：适用于所有客户端

```
vim /etc/my.cnf
[mysqld]
datadir=/var/lib/mysql
socket=/var/lib/mysql/mysql.sock

[mysqld_safe]
log-error=/var/log/mariadb/mariadb.log
pid-file=/var/run/mariadb/mariadb.pid

# include all files from the config directory
!includedir /etc/my.cnf.d
```

### 3.2 配置文件读取次序
mysql 的各类程序启动时都读取不止一个配置文件，配置文件将按照特定的顺序读取，最后读取的为最终生效的配置。可以使用 `my_print_defaults` 查看默认的配置文件查找次序。

```
$ my_print_defaults
Default options are read from the following files in the given order:
/etc/mysql/my.cnf /etc/my.cnf ~/.my.cnf
```

除了默认配置文件，mariadb 还可以通过命令行参数传入配置文件的位置：
- `--default-extra-file=/PATH/TO/CONF_FILE`: 默认的配置文件之外在加一个配置文件
- `--default-file` : 修改默认读取的配置文件

#### 配置文件查找次序        
默认情况下 OS Vendor提供mariadb rpm包安装的服务的配置文件查找次序：  
1. `/etc/mysql/my.cnf`
2. `/etc/my.cnf`
3. `/etc/my.cnf.d/`
4. `--default-extra-file=/PATH/TO/CONF_FILE`: 通过命令行指定的配置文件
5. `~/.my.cnf`: 家目录下的配置文件

通用二进制格式安装的服务程序其配置文件查找次序
2. `/etc/my.cnf`
3. `/etc/my.cnf.d/`
1. `/etc/mysql/my.cnf`
4. `--default-extra-file=/PATH/TO/CONF_FILE`: 通过命令行指定的配置文件
5. `~/.my.cnf`: 家目录下的配置文件

```
# os rpm 包安装的 mariadb 配置文件
ll -d /etc/my*
-rw-r--r--. 1 root root 570 6月   8 2017 /etc/my.cnf
drwxr-xr-x. 2 root root  67 2月  27 09:57 /etc/my.cnf.d

ll /etc/my.cnf.d
总用量 12
-rw-r--r--. 1 root root 295 4月  30 2017 client.cnf
-rw-r--r--. 1 root root 232 4月  30 2017 mysql-clients.cnf
-rw-r--r--. 1 root root 744 4月  30 2017 server.cnf
```

### 3.3 运行时参数修改
```bash
MariaDB [(none)]> help 'show variables'
MariaDB [(none)]> show global variables like 'skip_name_resolve'
MariaDB [(none)]> show variables where variable_name="innodb_version";
```

运行时参数查看：
- `SHOW GLOBAL VARIABLES [LIKE 'pattern' | WHERE expr] `: 查看全局默认参数
- `SHOW SESSION VARIABLES [LIKE 'pattern' | WHERE expr]`: 查看当前会话的参数

运行时参数修改:
- `SET GLOBAL VARIABLES=` 或者 `SET @@GLOBAL.VARIABLES=`: 修改全局默认参数，仅对修改后新建的会话有效
- `SET SESSION VARIABLES=` 或者 `SET @@SESSION.VARIABLES=`: 修改当前会话参数

### 3.4 查看 mariadb 状态变量
`SHOW [GLOBAL | SESSION] STATUS [LIKE 'pattern' | WHERE expr]`


## 4 mysql 客户端启动命令
`mysql [OPTIONS] [database]`
- 常用选项：
    - `-u, --user=name`：用户名，默认为root；
    - `-h, --host=name`：远程主机（即mysql服务器）地址，默认为localhost;
    - `-p, --password`：USERNAME所表示的用户的密码； 默认为空；
    - `-P, --port`: 指定 mysql 服务监听的端口，默认为 3306
    - `-D, --database`：连接到服务器端之后，设定其处指明的数据库为默认数据库；
    - `-e, --execute='SQL COMMAND;'`：连接至服务器并让其执行此命令后直接返回；
    - `-S, --socket`: 指定本地通信的套接字路经

mysql 客户端内可输入的命令分为两类:
1. 客户段命令: 只在客户端运行的命令，使用 `help` 可获取此类命令的帮助
2. 服务段命令: 通过 mysql 的协议送到服务段运行的命令，所以必须要有命令结束符,默认为 `;`；使用 `help contents` 获取服务器端命令使用帮助。

### 4.1 查看本地命令
mysql> help
- `\u db_name`：设定哪个库为默认数据库
- `\q`：退出
- `\d CHAR`：设定新的语句结束符，默认为 `;`
- `\g`：语句结束标记，默认就相当于 `;` 作用
- `\G`：语句结束标记，结果竖排方式显式
- `\! COMMAND`: 在客户端内运行 shell 命令
- `\. PATH`: 在客户端内执行 sql 脚本(包含 sql 的文本)

```
$ mysql -uroot -p1234

MariaDB [(none)]> help              # help 查看 mysql 的所有命令

List of all MySQL commands:
Note that all text commands must be first on line and end with ';'
?         (\?) Synonym for `help'.
clear     (\c) Clear the current input statement.
connect   (\r) Reconnect to the server. Optional arguments are db and host.
delimiter (\d) Set statement delimiter.
edit      (\e) Edit command with $EDITOR.
ego       (\G) Send command to mysql server, display result vertically.
exit      (\q) Exit mysql. Same as quit.
go        (\g) Send command to mysql server.
help      (\h) Display this help.
nopager   (\n) Disable pager, print to stdout.
notee     (\t) Don't write into outfile.
pager     (\P) Set PAGER [to_pager]. Print the query results via PAGER.
print     (\p) Print current command.
prompt    (\R) Change your mysql prompt.
quit      (\q) Quit mysql.
rehash    (\#) Rebuild completion hash.
source    (\.) Execute an SQL script file. Takes a file name as an argument.
status    (\s) Get status information from the server.
system    (\!) Execute a system shell command.
tee       (\T) Set outfile [to_outfile]. Append everything into given outfile.
use       (\u) Use another database. Takes database name as argument.
charset   (\C) Switch to another charset. Might be needed for processing binlog with multi-byte charsets.
warnings  (\W) Show warnings after every statement.
nowarning (\w) Don't show warnings after every statement.

For server side help, type 'help contents'

# 执行 shell 命令
MariaDB [(none)]> \! ls /var
account  cache	db     games   iso	 lib	lock  mail   nis  preserve  spool   tmp  yp
adm	 crash	empty  gopher  kerberos  local	log   named  opt  run	    target  www
```

### 4.2 查看服务端命令
```bash
MariaDB [(none)]> help contents   # 查看 mysql 命令的组成部分
For more information, type 'help <item>', where <item> is one of the following
categories:
   Account Management
   Administration
   Compound Statements
   Data Definition
   Data Manipulation
.........


MariaDB [(none)]> help 'Account Management'   # 查看特定命令组内的命令
topics:
   CREATE USER
   DROP USER
   GRANT
   RENAME USER
   REVOKE
   SET PASSWORD

MariaDB [(none)]> help 'CREATE USER'   # 查看特定命令使用帮助
Name: 'CREATE USER'
Description:
Syntax:
CREATE USER user_specification
    [, user_specification] ...

user_specification:
    user
    [
        IDENTIFIED BY [PASSWORD] 'password'
      | IDENTIFIED WITH auth_plugin [AS 'auth_string']
    ]
...............
```
