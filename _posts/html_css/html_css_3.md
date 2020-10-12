---
title: 3 CSS 布局
date: 2020-09-03
categories:
    - 前端
tags:
	- HTML&CSS
---

CSS 布局是学习 HTML&CSS 的第一个难点，今天我们来搞定他。
<!-- more -->

# 1. 学习资源
1. [MDN-CSS布局](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Introduction): 非常的详细清晰
2. [B站油管最火CSS布局视频](https://www.bilibili.com/video/BV1X7411m7SH?from=search&seid=6929047692861071784): 看完 MDN 在看
3. [B站小甲鱼](https://www.bilibili.com/video/BV1QW411N762?p=52): 没有一点 HTML 和 CSS 基础的可以先看这个视频

## 2. 块元素与行内元素
HTML 的元素分为两类:
1. 块元素: 占据其父元素整块空间，默认情况下，块级元素会新起一行(与语言默认的阅读顺序有关)。
2. 行内元素: 只能位于块元素内，只会占据内容实际使用空间。

HTML 元素是块元素还是行内元素并不是绝对的。每一个 HTML 元素都有一个默认的 display 属性值，它决定了这个元素应该以怎样的形态还在那时在我们面前。

### 2.1 盒子模型
盒子模型是浏览样式和布局的基本单位，浏览器通过控制每个盒子的样式，盒子与盒子之间的位置关系达到设置样式和布局的目的。标准的盒子模型如下:

![盒子模型](/images/html_css/标准盒模型.png)

块级元素与内联元素的盒子模型表现不同:
1. 块级元素对应的是块级盒子(Block box)
2. 行内元素对应的是内联盒子(Inline box)，与块级盒子相比，内联盒子有如下特性:
    - 盒子不会产生换行
    - width 和 height 属性将不起作用
    - 垂直方向的内边距、外边距以及边框会被应用但是不会把其他处于 inline 状态的盒子推开
    - 水平方向的内边距、外边距以及边框会被应用而且也会把其他处于 inline 状态的盒子推开

### 2.2 display 属性值
display 属性值决定了元素的展现形态，display 有下面这些可选值:

|值|   描述|
|:---|:---|
|none|    此元素不会被显示。|
|block| 此元素将显示为块级元素，此元素前后会带有换行符。|
|inline| 默认。此元素会被显示为内联元素，元素前后没有换行符。|
|inline-block|行内块元素。（CSS2.1 新增的值）|
|list-item| 此元素会作为列表显示。|
|run-in|  此元素会根据上下文作为块级元素或内联元素显示。|
|table| 此元素会作为块级表格来显示（类似 `<table>`），表格前后带有换行符。|
|inline-table| 此元素会作为内联表格来显示（类似 `<table>`），表格前后没有换行符。|
|table-row-group 此元素会作为一个或多个行的分组来显示（类似 `<tbody>`）。|
|table-header-group|  此元素会作为一个或多个行的分组来显示（类似 `<thead>`）。|
|table-footer-group|  此元素会作为一个或多个行的分组来显示（类似 `<tfoot>`）。|
|table-row|此元素会作为一个表格行显示（类似 `<tr>`）。|
|table-column-group|  此元素会作为一个或多个列的分组来显示（类似 `<colgroup>`）。|
|table-column|    此元素会作为一个单元格列显示（类似 `<col>`）|
|table-cell|  此元素会作为一个表格单元格显示（类似 `<td>` 和 `<th>`）|
|table-caption|   此元素会作为一个表格标题显示（类似 `<caption>`）|
|inherit| 规定应该从父元素继承 display 属性的值。|

## 3. CSS 布局概述
