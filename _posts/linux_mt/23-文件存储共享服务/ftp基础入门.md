---
title: 20.1 ftp基础入门
date: 2018-09-10
categories:
    - 运维
tags:
    - 文件共享服务
---

ftp基础入门

![linux-mt](/images/linux_mt/linux_mt1.jpg)
<!-- more -->

计算机上的磁盘设备有 SATA，SAS；IDE，SCSI；USB 等各种接口。以 SCSI 而言，SCSI 接口可以分线，一个接口可连接多个设备，我们的操作系统想要往磁盘上写数据时，需要标识哪块磁盘哪个位置。因此 SCSI 不仅代表一种硬盘，也代表了一种操作系统如和向磁盘读写数据的协议，而且与网络协议类似，这种协议是分层的。SCSI 协议结构如下图所示

![scsi](/images/linux_mt/scsi.png)

因为协议是分层，所以如果将最底下的物理层替换为光纤，并通过 TCP/IP 协议进行网络传输，我们的磁盘设备就可以被互联网上的其他访问，从而达到共享存储的目的。对于 SCSI 大家不用太关心，只需要知道数据传输的协议都是分层的，我们可以通过替换底层的传输协议达到共享存储的目的，具体怎么实现大家无需关心。

类似于磁盘这种直接附加在总线上的的设备通常被称为 DAS(Direct Attached Storage)，DAS 输出给操作系统的接口是块(block),块可以被分区格式化。按照附加到操作系统的方式，我们将存储设备分成以下几个类别:
1. DAS: Direct Attached Storage
    - 接口类型：输出给操作系统的接口是"块"
    - 设备：SATA，SAS；IDE，SCSI；USB；
2. NAS: Network Attached Storage
    - 接口类型: 输出给操作系统的接口是"文件"
    - 依据传输数据的协议可以分为
      - CIFS: samba
      - NFS: Network File System
    - 说明: 这种方式就是我们可以把别人共享出来的文件系统直接挂载使用
3. SAN：Storage Area Network 存储区域网络
    - 接口类型："block"
    - 协议：iSCSI(IP-SAN), FCSAN, FCoE, ...
    - 说明: 这种方式的实现方式就是类似与我们上述所说的，将 SCSI 协议底层的物理协议替换成 TCP/IP，让磁盘设备能够通过网络向其他主机输出块接口。而为了能够进行网络传输，原来的 SCSI 磁盘将被替换为一个主机，该主机负责向外输出存储。

ftp 不能视为为一种存储，因为其基本调用接口是不能在文件系统层级进行的，只能使用专门的客户端与其交互。ftp 是应用层协议实现的共享存储。本节我们就来依次介绍这几种服务:
1. vsftpd
2. NFS
3. samba

需要注意的是，如果不是当网管上述几个服务用到的很少，所以我们只需要达到基本应用即可。


## 1. ftp 简介
ftp 全称为 file transfer protocol，文件传输协议。ftp 诞生与互联网的早期，目标是完成文件传输，所以其传输数据的方式比较奇葩，本节我们就来对 ftp 做一个简单介绍。

### 1.1 ftp 传输过程
![ftp](/images/linux_mt/ftp_protocol.jpg)

如上图所示，ftp 的连接分为两类
1. 命令连接：传输命令
2. 数据连接：传输数据

当需要传输数据时，客户端向 ftp 服务端的 21 端口发起连接请求建立连接，此连接主要用来传输客户端的命令。然后命令的操作不能在当前连接上传输，必需新建一条连接进行数据传输。

数据连接的创建有两种模式(从服务端的角度看)
1. 主动模式(PORT)：Server端向客户端发起连接请求，请求的端口为命令连接使用的端口向后的第一个可用端口发起连接请求
2. 被动模式(PASV): Server端打开一个随机端口，并通过命令连接告知客户端，并等待客户端连接

数据传输完成后，数据连接即断开，下此传输时在重新建立连接。

### 1.2 ftp 数据传输格式
ftp 不会使用 MIME 对数据进行编码，ftp 会自动根据要传输的数据是文本格式还是二进制格式来选择传输机制。

### 1.3 ftp 的认证机制
Linux 上有一个提供认证的共享服务 PAM(Pluggable Authenticate Module),PAM 是一个认证框架包括各种库，是高度模块化的，我们 ftp 就是调用 PAM 的服务提供认证功能的。

```
$ rpm -ql pam
/etc/pam.d
/etc/pam.d/config-util
/etc/pam.d/fingerprint-auth
/etc/pam.d/other
/etc/pam.d/password-auth
/etc/pam.d/postlogin
/etc/pam.d/smartcard-auth
/etc/pam.d/system-auth
/etc/security

# pam 的模块目录,每一个模块可以实现一种认证功能
/usr/lib64/security  
/usr/lib64/security/pam_access.so
/usr/lib64/security/pam_chroot.so
............

# 所有调用 pam 进行认证的服务如何进行认证，由此目录下的配置文件配置
/etc/pam.d     
/etc/pam.d/config-util
/etc/pam.d/fingerprint-auth
/etc/pam.d/other
/etc/pam.d/password-auth
/etc/pam.d/postlogin
......
```

### 1.4 协议实现
ftp 是 C/S 架构的服务，其服务端与客户端的常见实现有
1. Server 端：
	- Windows: Serv-U, IIS, Filezilla
	- 开源：wuftpd, proftpd, pureftpd, vsftpd(Very Secure FTP daemon), ...
2. Client 端：
	- Windows：ftp, Filezilla, CuteFTP, FlashFXP, ...
	- 开源：lftp, ftp, Filezilla, gftp, ...

## 2. vsftpd 简介
vsftpd 全称是非常安全的 ftp 服务，功能有限但是非常安全，是 Linux 上最常用的 ftp 服务的实现。

```
rpm -ql vsftpd
$ rpm -ql vsftpd
/etc/logrotate.d/vsftpd
/etc/pam.d/vsftpd                      # pam 认证配置文件
/etc/vsftpd                            # 配置文件目录
/etc/vsftpd/ftpusers
/etc/vsftpd/user_list
/etc/vsftpd/vsftpd.conf                # 配置文件
/etc/vsftpd/vsftpd_conf_migrate.sh
/usr/lib/systemd/system-generators/vsftpd-generator
/usr/lib/systemd/system/vsftpd.service  # 作为独立服务
/usr/lib/systemd/system/vsftpd.target   # 作为托管服务
/usr/lib/systemd/system/vsftpd@.service
/usr/sbin/vsftpd
```

### 2.1 路经映射
ftp 也是通过 URL 进行资源定位的 `SCHEME://username:password@HOST:PORT/PATH/TO/FILE`。每个用户的URL的`/`映射到当前用户的家目录。yum 安装 vsftpd 时默认会创建 ftp 用户，vsftpd 以 ftp 用户的身份启动进程，默认用户即为ftp用户。匿名访问 ftp 服务时，匿名用户将自动映射为 ftp 用户。匿名用户又可称为 `anonymous`。所以匿名用户的`/` 为 ftp 用户的家目录 `/var/ftp/`。

```
$ grep "^ftp" /etc/passwd
ftp:x:14:50:FTP User:/var/ftp:/sbin/nologin

$ systemctl start vsftpd.service

# 默认就是匿名用户登陆
$ lftp 192.168.1.106
lftp 192.168.1.106:~> ls
drwxr-xr-x    2 0        0               6 Aug 03  2017 pub

# 使用 ftp 匿名登陆
$ lftp -u ftp 192.168.1.106
口令:
lftp ftp@192.168.1.106:~> ls            
drwxr-xr-x    2 0        0               6 Aug 03  2017 pub

# 使用 anonymous 匿名登陆
$ lftp -u anonymous 192.168.1.106
口令:
lftp anonymous@192.168.1.106:~> ls      
drwxr-xr-x    2 0        0               6 Aug 03  2017 pub
```

### 2.3 ftp 用户的权限
一个用户通过文件共享服务访问文件系统上的文件的生效权限为此用户在共享服务上拥有的共享权限与其在本地文件系统上拥有的权限的交集。
