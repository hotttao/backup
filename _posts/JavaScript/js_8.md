---
title: 8 JavaScript BOM
date: 2020-08-11
categories:
    - 前端
tags:
	- JavaScript
---
JavaScript 浏览器对象模型 BOM。
<!-- more -->

## 1. BOM 概述
BOM提供了很多对象，用于访问浏览器的功能，这些功能与任何网页内容无关。其主要包含如下几个对象:
1. window: 表示浏览器的一个实例
    - 既是通过JavaScript访问浏览器窗口的一个接口，又是ECMAScript规定的Global对象
    - 所有全局变量和函数都作为 window 对象的属性和方法存在
2. location: 提供了与当前加载的文档相关的信息
3. navigator: 提供了客户端浏览器的相关信息
4. history: 保存着用户上网的历史记录

## 1. windows 对象
### 1.1 window 对象的常用属性和方法

|属性/方法|作用|示例|
|:---|:---|:---|
|encodeURI(uri)|url 编码，只能编译空格等简单字符||
|decodeURI(uri)|encodeURI 对应的解码方法||
|encodeURIComponent(uri)|url 编码，可编译所有特殊字符||
|decodeURIComponent(uri)|encodeURIComponent 对应的解码方法||
||||
|alter(message)|警告对话框，通常使用alert()生成的“警告”||
|comfirm(message)|确认对话框，向用户确认消息，返回 true/false||
|prompt(message, default)|提示对话框，返回用户输入的文本或者 null||
|setTimeout(func, time)|定时器，超时调用||
|setInterval(func, span)|定时器，间歇调用||


```js
// 1. 设置超时调用
var timeID = setTimeout(function(){
    console.log("hello, world")
}, 5000);

// 取消超时调用
clearTimeout(timeID)

// 2. 间歇调用及取消
var num = 0;
var max = 10;

var intervalId = null;

function increaNum(){
    num ++;
    if (num == max){
        clearInterval(intervalId);
    }
}
intervalId = setInterval(increaNum, 1000);

// 3. 使用超时调用模拟间歇调用
function increaNum2(){
    num ++;
    if (num < max){
        setTimeout(increaNum2, 1000)
    }
}
setTimeout(increaNum2, 1000)
```

注意对于可能会被重复启动的定时器(比如通过页面按钮启动的定时器，应该先清除定时器，再重新开启定时器)

## 2. location 对象
location 提供了与当前加载的文档相关的信息。location 是一个特殊对象，window.location和document.location引用的是 同一个 location 对象。

### 2.1 location 对象的属性和方法
|属性/方法|作用|示例|
|:---|:---|:---|
|hash|锚部分|#contents|
|host|域名:端口号|www.baidu.com:80|
|hostname|域名|www.baidu.com|
|href|完整 URL|https://www.baidu.com|
|pathname|URI 路径|/news/|
|port|端口号|80|
|protocol|协议|https:|
|search|查询字符串|?q=javascript|
|assign(rul)|可回退跳转，相当于 location.href=url||
|replace(url)|不可回退跳转||
|reload()|重载网页||

```js
// 1. 获取查询字符串
function getQueryArgs(){
    var qs = location.search.length > 0 ? location.search.substring(1): ""
    var args = {};
    var items = qs.length ? qs.split("&") : [];
    var item=null, name = null, value = null;

    for (i=0; i<items.length;i++){
        item = items[i].split("=");
        name = decodeURIComponent(item[0]);
        value = decodeURIComponent(item[1]);
        if (name.length){
            args[name] = value;
        }
    }
    return args
}

// 2. 重载页面
location.reload() // 可能从缓存中重载页面
location.reload(true) // 从服务器重载页面
```

## 3. navigator
navigator 提供了客户端浏览器的相关信息。

### 3.1 navigator 对象的属性和方法

|属性/方法|作用|示例|
|:---|:---|:---|
|plugins|当前浏览器安装的插件||

## 4. history 
history 浏览器历史浏览记录对象，保存着用户上网的历史记录

### 4.1 history 对象的属性和方法
|属性/方法|作用|示例|
|:---|:---|:---|
|go(num)|在历史记录中跳转，num 表示前进(正数)和后退(负数)次数||
