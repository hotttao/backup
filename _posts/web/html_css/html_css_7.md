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

## 7. 浮动和定位对行内元素的影响
1. 将一个行内元素设置成 float 相当于把这个元素设置成了一个块元素
2. 绝对定位和固定定位，与 float 一样也可以将这个元素设置成了一个块元素
3. 总结: 脱离标准文档流的 float、绝对定位、固定定位都会将行内元素设置成一个块元素  

对 div 等块级元素设置 float 会收缩效果。

## 8. 定位与 z-index
给元素设置定位会出现压盖现象，z-index 可以设置相互压盖元素显示的优先级。

z-index 有如下几个特性:
1. 只能用于设置了定位的元素上
2. 是一个整数，越大显示优先级越高
3. 如果父辈元素也设置了 z-index，则元素显示的优先级由其父辈的 z-index 决定

## 9 背景与边框属性
### 9.1 背景属性
背景包括如下属性
1. 背景色: `background-color: red`
2. 背景图片: `background-img: url("/images/image.jpg")`
3. 背景图片的平铺方式: 
    - `background-repeat: no-repeat`
    - 表示背景图片是否重复以填充整个元素
    - no-repeat 表示不复制，repeat-x 横向平铺 repeaet-y 纵向平铺 
4. 背景图片定位: 
    - `background-position: 0 0`
    - 定位有三种方式:
        - `50px 100px`: x 轴方向(水平方向)右移 50px，垂直方向下移 100px
        - `top/center/bottom left/center/right`: 关键字定位，分别表示上下、左右额位置
        - `0% 50%`: 水平方向右移 0%, 垂直方向下移 50%
5. 缩放背景图片的尺寸: 
    - `background-size: 24px 596px` 对应为宽度和高度
    - `background-size: cover`: 根据容器的百分比进行伸缩
5. 综合属性: `backgroud: url("") no-repeat center top`

 ### 9.2 CSS Sprite 雪碧图
CSS Sprite 是一个将多个小图标合并到一张图上，并利用 CSS 背景定位来显示需要显示的部分的技术。

CSS Sprite 适用于:
1. 静态图片，不随用户信息变化而变化
2. 小图片，2-3kb
3. 加载量比较大
4. 一些大图片不建议使用雪碧图

目的是减少 HTTP 请求的数量，加快网页响应速度，跟合并 JS 文件和 CSS 文件是一个道理。

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        * {
            padding: 0;
            margin: 0;
        }
        div {
            width: 24px;
            height: 24px;
            display: inline-block;
            border: 1px solid palegreen;
            /* 图片大小: 48px * 1184px  */
            background: url("/_posts/html_css/taobao_sprite.png") no-repeat 0 0 ;
            background-size: 24px 597px;
        }

        .sprit2 {
            background-position: 0 -44px;
        }

        .sprit3 {
            background-position: 0 -88px;
        }
    </style>
</head>
<body>
    <div class="sprit"></div>
    <div class="sprit2"></div>
    <div class="sprit3"></div>
</body>
</html>
```

### 9.3 边框属性
边框包括如下属性:
1. 边框的圆角: 
    - `border-radius: 3px 10px 30px 2px`
    - `border-radius: 50%`: 将正方形设置为圆
    - `border-top-left: 15px 15px`
2. 边框阴影: `box-shadow: 0px 0px 5px red inset`
    - 水平偏移方向
    - 垂直偏移方向
    - 模糊程度
    - 颜色
    - 外设还是内设，默认为外设，inset 表示内设

## 10. CSS 类命名规范
### 10.1 相对网页外层重要部分CSS样式命名
1. 外套 wrap ------------------用于最外层 
2. 头部 header ----------------用于头部 
3. 主要内容 main ------------用于主体内容（中部） 
4. 左侧 main-left -------------左侧布局 
5. 右侧 main-right -----------右侧布局 
6. 导航条 nav -----------------网页菜单导航条 
7. 内容 content ---------------用于网页中部主体        
8. 底部 footer -----------------用于底部


### 10.2 DIV+CSS命名参考表

|CSS样式命名|说明|
|:---|:---|
||#wrapper|        页面外围控制整体布局宽度|
|#container或#content|     容器,用于最外层|
|#layout| 布局|
|#head, #header|  页头部分|
|#foot, #footer|  页脚部分|
|#nav|    主导航|
|#subnav| 二级导航|
|#menu|   菜单|
|#submenu|        子菜单|
|#sideBar|        侧栏|
|#sidebar_a, #sidebar_b|  左边栏或右边栏|
|#main|   页面主体|
|#tag|    标签|
|#msg| #message|   提示信息|
|#tips|   小技巧|
|#vote|   投票|
|#friendlink|     友情连接|
|#title|  标题|
|#summary|        摘要|
|#loginbar|       登录条|
|#searchInput|    搜索输入框|
|#hot|    热门热点|
|#search| 搜索|
|#search_output|  搜索输出和搜索结果相似|
|#searchBar|      搜索条|
|#search_results| 搜索结果|
|#copyright|      版权信息|
|#branding|       商标|
|#logo|   网站LOGO标志|
|#siteinfo|       网站信息|
|#siteinfoLegal|  法律声明|
|#siteinfoCredits|        信誉|
|#joinus| 加入我们|
|#partner|        合作伙伴|
|#service|        服务|
|#regsiter|       注册|
|arr/arrow|       箭头|
|#guild|  指南|
|#sitemap|        网站地图|
|#list|   列表|
|#homepage|       首页|
|#subpage|        二级页面子页面|
|#tool, #toolbar| 工具条|
|#drop|   下拉|
|#dorpmenu|       下拉菜单|
|#status| 状态|
|#scroll| 滚动|
|.tab|    标签页|
|.left| .right| .center|    居左、中、右|
|.news|   新闻|
|.download|       下载|
|.banner| 广告条(顶部广告条)|


## 11. 居中
### 11.1 行内元素居中

行内元素居中分为:
1. 水平居中: text-align
2. 垂直居中:
    - 方法一: 设置 line-height 与 height 同高
    - 方法二: 将容器设置为 table-cell 并设置 vertical-align

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        /* 方法一: text-align, line-height */
        .box {
            width: 200px;
            height: 200px;
            background-color: aquamarine;
            text-align: center;
            line-height: 200px;
        }

        /* 方法二: text-align, table-cell */
        .box2 {
            width: 200px;
            height: 200px;
            background-color: aquamarine;
            display: table-cell;
            vertical-align: middle;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="box">
        <span>JMM</span>
    </div>

    <div class="box2">
        <span>JMM</span>
    </div>
</body>
</html>
```

### 11.2 块元素居中
块元素居中有三种方法：
1. position + margin
2. table-cell
3. position: 纯定位的方式

#### position + margin
```html
<style>
    /* 方法一: position + margin */
    /* 父元素: position: relative */
    .box {
        width: 200px;
        height: 200px;
        background-color: orange;
        position: relative; 
    }

    
    .child {
        width: 100px;
        height: 100px;
        background-color: aquamarine;
        /* 子元素: 设置 position + margin + top/left/right/buttom */
        position: absolute;
        margin: auto;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
    }
</style>

<body>
    <div class="box">
        <div class="child"></div>
    </div>
</body>
```

#### table-cell

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        .box {
            width: 200px;
            height: 200px;
            background-color: orange;
            /* 方法二: 父元素设置 table-cell */
            display: table-cell;
            vertical-align: middle;
            text-align: center;
        }

        
        .child {
            width: 100px;
            height: 100px;
            background-color: aquamarine;
            /* 方法二: 子元素设置 inline-block */
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="box">
        <div class="child"></div>
    </div>
</body>
</html>
```

#### 纯位移计算

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        .box {
            width: 200px;
            height: 200px;
            background-color: orange;
            /* 方法三: 父元素 */
            position: relative;;
        }
        
        .child {
            width: 88px;
            height: 88px;
            background-color: aquamarine;
            /* 方法三:  纯定位方式，位移父子宽高差值的一半*/
            position: absolute;
            top: 50%;
            left: 50%;
            margin-left: -44px;
            margin-top: -44px;
        }
    </style>
</head>
<body>
    <div class="box">
        <div class="child"></div>
    </div>

    <div class="box2">
        <span>JMM</span>
    </div>
</body>
</html>
```