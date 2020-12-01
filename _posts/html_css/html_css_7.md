---
title: 7 CSS 精讲
date: 2020-09-06
categories:
    - 前端
tags:
	- HTML&CSS
---

经过一段时间的磨练，基本的 CSS 规则都会了，但还是有一些比较细节的知识未掌握。这一节是 CSS 的知识精讲，主要是记录一些自己未记住的知识点。
<!-- more -->

## 1. CSS 权重
CSS 权重决定了 CSS 有样式的应用优先级(注意CSS样式的应用不取决于书写顺序)。

CSS 权重 = "元素选择器" * 1 + "类选择器" * 10 + "ID选择器" * 100 + "行类样式" * 1000

![网格](/images/html_css/css_height.jpg)


## 2. CSS 字体和文本属性
### 2.1 字体属性包括
1. 字体: 
    - `font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif;`
    - 可以设置多个备选字体
2. 字体大小
    - `font-size: 30px`
    - 像素单位有三个
        - px: 像素单位，绝对单位
        - em: 相对单位，相对于当前所在区域的字体大小
        - rem: 移动端的相对单位
3. 字体颜色
    - `color: red`
    - 颜色表示法有三种:
        - 单词表示法: red
        - rgb 和 rgba 表示法
        - 十六进制表示法
4. 字体样式
    - `font-style: italic`
5. 字体粗细:
    - `font-weight: 400`
    - 取值范围为 100-900,400 表示 normal

### 2.2 文本属性包括:
1. 文本修饰
    - `text-decoration: line-through`
    - 修饰词:
        - underline: 下划线
        - none: 无线
        - line-through: 删除线
2. 文本缩进
    - `text-indent: 2em`
    - 单位建议使用 em
3. 行高: 
    - `line-height: 40px`
    - 设置行高可以使文本在垂直居中
4. 中文字间距:`letter-spacing`
4. 单词字间距: `word-spacing`
6. 文本水平对齐方式: 
    - `text-align: center`
    - center 表示文本水平居中

### 2.3 综合属性
综合属性可以在同一个属性中设置多个属性，比如:

```css
/* 设置: 字体大小 20px，行高为 3 倍字体大小，备选字体 */
font: 20px / 3 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif;;
}
```

## 3. 盒子模型
### 3.1 display
在界面我们介绍盒子模型时说道，元素分为两类:
1. 块级元素
2. 行内元素

漏掉了行内块元素，img 和 input 都属于行内块元素。所有元素所属的元素类型都由其 display 属性决定:
1. display: block 表示块元素
2. display: inline 表示行内元素
3. display: inline-block 表示行内块元素

### 3.2 margin 
margin 在垂直方向上会出现外边距合并，水平方向则不存在。即如果上下两个盒子A和B，A 的下边距为 30px，B 的上边距为100px，最终 AB盒子的上下边距是 100px 而不是 130px。

因此我们在设置一个盒子的外边距时，尽量统一设置一个方向的外边距。

## 4. 清楚默认样式
浏览器会为不同元素设置默认样式，我们在进行 CSS 样式设置时最好先清楚这些默认样式，下面是清楚默认样式的代码示例:

```css
/* http://meyerweb.com/eric/tools/css/reset/ 
   v2.0 | 20110126
   License: none (public domain)
*/

html, body, div, span, applet, object, iframe,
h1, h2, h3, h4, h5, h6, p, blockquote, pre,
a, abbr, acronym, address, big, cite, code,
del, dfn, em, img, ins, kbd, q, s, samp,
small, strike, strong, sub, sup, tt, var,
b, u, i, center,
dl, dt, dd, ol, ul, li,
fieldset, form, label, legend,
table, caption, tbody, tfoot, thead, tr, th, td,
article, aside, canvas, details, embed, 
figure, figcaption, footer, header, hgroup, 
menu, nav, output, ruby, section, summary,
time, mark, audio, video {
	margin: 0;
	padding: 0;
	border: 0;
	font-size: 100%;
	font: inherit;
	vertical-align: baseline;
}
/* HTML5 display-role reset for older browsers */
article, aside, details, figcaption, figure, 
footer, header, hgroup, menu, nav, section {
	display: block;
}
body {
	line-height: 1;
}
ol, ul {
	list-style: none;
}
blockquote, q {
	quotes: none;
}
blockquote:before, blockquote:after,
q:before, q:after {
	content: '';
	content: none;
}
table {
	border-collapse: collapse;
	border-spacing: 0;
}
```

## 5. 浮动元素的破坏性
浮动元素存在以下几个现象:
1. 文字环绕现象
2. 脱离标准文档流
3. 多个浮动元素会相互贴边
4. 浮动元素有收缩现象，默认元素与其父元素同款，但是浮动元素的宽度取决于其内容的宽度

浮动元素因脱离了正常的页面布局刘，因而撑不起父元素的高度，导致父元素高度塌陷问题。

### 5.1 清除浮动
所谓清除浮动就是解决浮动带来的破坏性。清除浮动有多种方法:
1. 固定宽度: 
    - 方法: 为父元素设置固定宽度，宽度应该是其浮动子元素的最大高度
    - 缺点: 这种方法在其子元素高度变化时需要重新设置，不够灵活
2. 内墙法: 
    - 方法: 在最后一个浮动元素的后面，添加一个块级元素，并设置 `clear: both` 清除浮动
    - 缺点: 结构冗余
3. 伪元素清除法:
    - 方法: 类似内墙法，只不过额外添加的块元素是通过伪元素实现的
4. `overflow: hidden`
    - 方法: 为父元素设置`overflow: hidden` 会形成一个 BFC(Block Formatting Context)区域
    - 原理:
        - BFC 区域的一条显示规则就是计算 BFC 的高度时，浮动元素也参与计算
        - 除了 `overflow: visible` 其他 overflow 属性值都能形成 BFC 
```html
<!-- 内墙法 -->

<style>
    /* 2. 内墙法 */
    .top_bar .clear{
        clear: both;
    }

    /* 3. 伪元素清除法 */
    .clearfix::after{
        content: "";
        display: block;
        clear: both;
    }
    .top_bar{
        /* 4. 形成 BFC 区域 */
        overflow: hidden;
        border: 1px solid red;
    }

</style>

<body>
    <div class="top_bar clearfix">
        <div class="a">浮动1</div>
        <div class="b">浮动2</div>
        <div class="clear"></div>
    </div>
    <div class="second"></div>
</body>
```

## 6. BFC
