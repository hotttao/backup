---
title: 5 CSS 布局-网格
date: 2020-09-05
categories:
    - 前端
tags:
	- HTML&CSS
---

本篇是 CSS 布局的第三篇，今天我们来介绍 CSS3 提供的最新布局技术-网格。我们将按照网格的创建，和网格的使用两个部分来介绍 CSS 网格的使用。
<!-- more -->

## 1. 网格的创建
CSS网格是一个用于web的二维布局系统。利用网格，你可以把内容按照行与列的格式进行排版。
一个网格通常具有许多的列（column）与行（row），以及行与行、列与列之间的间隙，这个间隙一般被称为沟槽（gutter）。

![网格](/images/html_css/grid.png)

因此一个基本的网格设置需要如下 CSS 属性:

|配置项|CSS 属性|作用|
|:---|:---|:---|
|网格样式|display:grid|将父容器设置为一个网格|
|列|grid-template-columns|显示设置列数和列宽|
|行|grid-template-rows|显示设置行数和行宽|
|间隙|grid-column-gap|设置列间隙|
|间隙|grid-row-gap|设置行间隙|
|间隙|grid-gap|同时设置行列间隙|
|隐式网格|grid-auto-rows|设置隐式网格的行宽|
|隐式网格|grid-auto-columns|设置隐式网格的列宽|

我们将以下面这个例子为基础演示如何使用 CSS 创建网格进行排版:

```html
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>CSS Grid starting point</title>
    <style>
        body {
            width: 90%;
            max-width: 900px;
            margin: 2em auto;
            font: .9em/1.2 Arial, Helvetica, sans-serif;
        }

        .container > div {
            border-radius: 5px;
            padding: 10px;
            background-color: rgb(207,232,220);
            border: 2px solid rgb(79,185,227);
        }
    </style>
</head>

<body>
    <h1>Simple grid example</h1>

    <div class="container">
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
        <div>Five</div>
        <div>Six</div>
        <div>Seven</div>
    </div>

</body>

</html>
```

### 1.1 创建网格容器
首先，将容器的display属性设置为grid来定义一个网络，前面我们介绍 display 属性的时候说过，dsiplay: grid 属于元素的内部显示类型，用来控制其**子元素**的布局。因此要创建网格，我们首先要为排版的内容创建一个容器，将父容器改为网格布局后，他的直接子项会变为网格项。

```html
<style>
    .container {
        display: grid;
    }
</style>
```

### 1.2 定义列数和列宽
display: grid的声明默认只创建了一个只有一列的网格，我们需要继续为网格定义列数和列宽。

```html
<style>
    .container {
        display: grid;
        /* grid-template-columns: 200px 200px 200px  */
        /* grid-template-columns: 20% 30% 50%  */
        grid-template-columns: 1fr 2fr 1fr; 
        /* grid-template-columns: repeat(3, 1fr); */
        /* grid-template-columns: repeat(3, 1fr, 2fr); */
    }
</style>
```

列宽的定义有三种:
1. 长度
2. 百分比
3. fr 单位

fr 是一个比例单位，用于划分可用空间(除去固定宽度后的可用空间，fr 和 长度可混用)。可以使用repeat 函数可以重复构建具有某些宽度配置的某些列。

### 1.3 定义网格间隙
使用 grid-column-gap 属性来定义列间隙；使用 grid-row-gap 来定义行间隙；使用 grid-gap 可以同时设定两者。

```html
<style>
    .container {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        grid-gap: 20px; 
    }
</style>
```

### 1.4 隐式网格
1. 显式网格: 是使用 grid-template-columns 或 grid-template-rows 属性显示设置行列数的网格
2. 隐式网格: 行列数根据内容自动调整的网格。简单来说，隐式网格就是为了放显式网格放不下的元素，浏览器根据已经定义的显式网格自动生成的网格部分。

通过 grid-auto-rows 和 grid-auto-columns 属性可以设置隐式网格的宽度，它们的默认参数是 auto，即行列宽自动根据内容调整。

## 2. 网格属性值设置的函数
CSS3 为网格的属性值设置提供了很多有用的函数，方便我们灵活的设置自适应的网页。下面我们来详细看看这些函数的用法，包括:
1. minmax
2. repeat

### 2.1 minmax 
minmax(min, max):
- 作用: 为一个行/列的尺寸设置了取值范围
- 参数:
    - min: 最小尺寸
    - max: 最大尺寸，可以为关键词 auto 标识根据内容自动调整
- 示例: 比如设定为 minmax(100px, auto)，那么尺寸就至少为100像素，并且如果内容尺寸大于100像素则会根据内容自动调整。

```html
<style>
    .container {
        display: grid;
        grid-template-columns: repeat(1, 1 60% 3);
        grid-auto-rows: minmax(100px, auto);
        grid-gap: 20px;
    }
</style>
```

### 2.2 repeat 
repeat 函数可以重复构建具有某些宽度配置的某些列。某些情况下，我们需要让网格自动创建很多列来填满整个容器。实现方式如下所示:

```html
<style>
    .container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        repeat(4, [col-start] 250px [col-end])
        grid-gap: 20px;
    }
</style>
```
在这个示例中:
1. repeat 函数中的一个关键字 auto-fill 来替代确定的重复次数。
2. 第二个参数，我们使用 minmax 函数来设定一个行/列的最小值，以及最大值1fr。


## 3. 网格的使用
### 3.1 使用网格索引
在定义完了网格之后，我们要把元素放入网格中，网格的分割线构成我们索引网格位置的索引。从左往右，开始索引为 1。一个定义了 12 个列的网格分割线编号如下:

![网格分割线](/images/html_css/learn-grids-inspector.png)

通过以下属性来指定使用的网格从那条线开始到哪条线结束。

1. grid-column-start
2. grid-column-end
3. grid-column: 缩写，grid-column-start / grid-column-end
4. grid-row-start
5. grid-row-end
6. grid-row: 缩写 grid-row-start / grid-row-end

```html
<style>
    header {
        /* 分割线 1-3 框定的第 1,2两列 */
        grid-column: 1 / 3;
        grid-row: 1;
    }

    article {
        /* 单个值直接标识第几列 */
        grid-column: 2;
        grid-row: 2;
    }
</style>
```

### 3.2 使用命名网格
另一种往网格放元素的方式是用grid-template-areas属性，并对网格区域进行命名并使用。

```html
<style>
    .container {
        display: grid;
        grid-template-areas: 
            "header header"
            "sidebar content"
            "footer footer";
        grid-template-columns: 1fr 3fr;
        grid-gap: 20px;
    }

    header {
        grid-area: header;
    }

    article {
        grid-area: content;
    }

</style>
```

grid-template-areas属性的使用规则如下：
1. 你需要填满网格的每个格子
2. 对于某个横跨多个格子的元素，重复写上那个元素grid-area属性定义的区域名字
3. 所有名字只能出现在一个连续的区域，不能在不同的位置出现
4. 一个连续的区域必须是一个矩形
5. 使用.符号，让一个格子留空