---
title: hexo github blog
date: 2017-09-03 11:58:00
categories:
    - 运维
tags:
    - hexo
---
![hexo blog](/images/blog_init/hexo.jpg)
使用 githup pages 和 hexo搭建 blog，本文不是完整教程，只是整个流程概览和常用命令备忘

<!-- more -->

## 1. github blog 搭建
1. 安装node.js

  `node -v`

2. 安装 hexo

  `npm install hexo-cli -g`

3. 注册 github 帐号

  新建xxx.github.io仓库，xxx 为帐号名称

4. 初始化 hexo blog

  ```
  hexo init blog
  cd blog
  npm install
  ```

5. 配置 hexo github

  - 安装 hexo-deployer-git  
    `npm install hexo-deployer-git --save`  

  - 在网站的_config.yml中配置deploy
    ```
    deploy:type: git
      repo: <repository url>
      branch: [branch]
    ```

6. 提交git
  ```
  hexo d -g
  hexo d
  ```

## 2. hexo 常用命令
命令 | 作用
:---|:---
hexo init dir_name|创建博客目录
hexo clean|....
hexo g(generate)|生成静态文件
hexo s(server)|启动本地web服务，用于博客的预览
hexo d(deploy)|部署播客到远端
hexo d -g |生成部署
hexo s -g |生成预览
hexo new "name"|新建文章
hexo new page "name"|新建页面


## Quick Start
[Hexo Home](https://hexo.io/)
[documentation](https://hexo.io/docs/)  
[troubleshooting](https://hexo.io/docs/troubleshooting.html)
[Hexo GitHub](https://github.com/hexojs/hexo/issues).

### Create a new post

``` bash
$ hexo new "My New Post"
```

More info: [Writing](https://hexo.io/docs/writing.html)

### Run server

``` bash
$ hexo server
```

More info: [Server](https://hexo.io/docs/server.html)

### Generate static files

``` bash
$ hexo generate
```

More info: [Generating](https://hexo.io/docs/generating.html)

### Deploy to remote sites

``` bash
$ hexo deploy
```

More info: [Deployment](https://hexo.io/docs/deployment.html)
