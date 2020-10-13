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


## 1. CSS 布局概述
CSS 布局技术的作用是控制HTML 元素显示的相对位置。在我们学些 CSS 的不同布局技术之前，我们首先要搞明白下面这些内容:
1. CSS 的盒子模型: 元素在页面显示的基本控制单位
2. 块级元素和行内元素: 按照 HTML 默认显示方式，对 HTML 元素的分类，块级元素和行内元素都与一种特定的盒子模型相关联
3. 正常布局流: 浏览器的默认布局行为，即如何对每个 HTML 元素对应的盒子进行排版

### 1.1 块元素与行内元素
HTML 的元素分为两类:
1. 块元素: 占据其父元素整块空间，默认情况下，块级元素会新起一行(与语言默认的阅读顺序有关)。
2. 行内元素: 只能位于块元素内，只会占据内容实际使用空间。

块元素内容的布局方向被描述为块方向。块方向在英语等具有水平书写模式(writing mode)的语言中垂直运行。它可以在任何垂直书写模式的语言中水平运行。对应的内联方向是内联内容（如句子）的运行方向。

HTML 元素是块元素还是行内元素并不是绝对的。每一个 HTML 元素都有一个默认的 display 属性值，它决定了这个元素应该以怎样的形态还在那时在我们面前。

### 1.3 盒子模型
盒子模型是浏览样式和布局的基本单位，浏览器通过控制**每个盒子的样式，盒子与盒子之间的位置关系**达到设置样式和布局的目的。标准的盒子模型如下:

![盒子模型](/images/html_css/标准盒模型.png)

块级元素与内联元素的盒子模型表现不同:
1. 块级元素对应的是块级盒子(Block box)
    - 盒子会在内联的方向上扩展并占据父容器在该方向上的所有可用空间，在绝大数情况下意味着盒子会和父容器一样宽每个盒子都会换行
    - width 和 height 属性可以发挥作用
    - 内边距（padding）, 外边距（margin） 和 边框（border） 会将其他元素从当前盒子周围“推开”
2. 行内元素对应的是内联盒子(Inline box)，与块级盒子相比:
    - 盒子不会产生换行
    - width 和 height 属性将不起作用
    - 垂直方向的内边距、外边距以及边框会被应用但是不会把其他处于 inline 状态的盒子推开
    - 水平方向的内边距、外边距以及边框会被应用而且也会把其他处于 inline 状态的盒子推开

### 1.4 正常布局流
正常布局流(normal flow)是指在不对页面进行任何布局控制时，浏览器默认的HTML布局方式。正常布局流中:
1. HTML元素完全按照源码中出现的先后次序显示
2. 块级元素和行内元素将按照前面介绍的盒子模型进行展示

接下来我们介绍的布局技术就是用来覆盖默认的布局行为:
1. display 属性: 可以更改标签默认的显示方式
2. position 属性: 定位，允许你精准设置盒子的位置
3. float: 浮动
4. 表格布局:
5. 多列布局

## 2. display 属性值
display 属性值决定了元素的展现形态，可以设置元素的内部和外部显示类型:
1. 元素的外部显示类型 outer display types 决定了该元素在流式布局中的表现（块级 block 或内联元素 inline）
2. 元素的内部显示类型 inner display types 可以控制其**子元素**的布局，这些属性需要和其他布局技术结合使用(注意作用的对象是元素的子元素)

display 有下面这些可选值:

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


## 3. 定位
position 有不同值，对应不同的定位方式:

|position值|定位方式|显示规则|
|static|静态定位|元素定位的默认值，意味将元素放入布局流的正常位置|
|relative|相对定位|相对于元素正常布局流的位置，向上向下向左向右移动，不会影响周围元素的位置|
|absolute|绝对定位|相对于绝对定位元素的包含元素( <html> 元素或其最近的定位祖先)，位于独立的层，不再存在于正常文档布局流中|
|fixed|固定定位|与绝对定位类似，但是只相对于浏览器视口本身，位于独立的层，不再存在于正常文档布局流中|
|sticky|"粘性"定位|相对位置和固定位置的混合体|

### 3.1 relative
修改相对定位，需要使用top，bottom，left和right属性。需要注意的是这些属性值的设置方式是相反的，你需要考虑一个看不见的力，推动定位的盒子的一侧，移动它的相反方向。 所以例如，如果你指定 top: 30px;一个力推动框的顶部，使它向下移动30px。top，bottom，left和right 属性对下面几个 position 值同样适用。

### 3.2 absolute
绝对定位元素的“包含元素“？这取决于绝对定位元素的父元素的position属性:
1. 如果所有的父元素都没有显式地定义position属性，绝对定位元素会被放在<html>元素的外面，并且根据浏览器视口来定位，**即相对于<html>元素**
2. 如果存在任意父元素 position 属性为非 static，绝对定位元素就会相对于最近的 position != static 的父元素进行定位，**即相对于最近的定位祖先**。

### 3.3 fixed
fixed 与绝对定位的工作方式完全相同，只有一个主要区别：绝对定位固定元素是相对于 <html> 元素或其最近的定位祖先，而固定定位固定元素则是相对于浏览器视口本身。 

### 3.4 sticky
允许被定位的元素表现得像相对定位一样，直到它滚动到某个阈值点（例如，从视口顶部起1​​0像素）为止，此后它就变得固定了。

### 3.5 z-index 
z-index 属性值用于设置重叠元素的显示顺序，你可以想想网页也有一个z轴：一条从屏幕表面到你的脸。z-index 值影响定位元素位于该轴上的位置；正值将它们移动到堆栈上方，负值将它们向下移动到堆栈中。默认情况下，定位的元素都具有z-index为auto，实际上为0。

## 4. float
### 4.1 float 的使用
float 属性最初只用于在成块的文本内浮动图像。但是能浮动不止图像，float 可以生成多列布局。我们来看一个 float 的简单示例

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        body{
            width: 600px;
            margin: 0 auto;
        }
        img {
            float: left;
            margin-right: 30px;
            }
    </style>
</head>
<body>
    <h1>Simple float example</h1>

    <img src="https://mdn.mozillademos.org/files/13340/butterfly.jpg" alt="A pretty butterfly with red, white, and brown coloring, sitting on a large leaf">

    <p> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla luctus aliquam dolor, eu lacinia lorem placerat vulputate. Duis felis orci, pulvinar id metus ut, rutrum luctus orci. Cras porttitor imperdiet nunc, at ultricies tellus laoreet sit amet. Sed auctor cursus massa at porta. Integer ligula ipsum, tristique sit amet orci vel, viverra egestas ligula. Curabitur vehicula tellus neque, ac ornare ex malesuada et. In vitae convallis lacus. Aliquam erat volutpat. Suspendisse ac imperdiet turpis. Aenean finibus sollicitudin eros pharetra congue. Duis ornare egestas augue ut luctus. Proin blandit quam nec lacus varius commodo et a urna. Ut id ornare felis, eget fermentum sapien.</p>

    <p>Nam vulputate diam nec tempor bibendum. Donec luctus augue eget malesuada ultrices. Phasellus turpis est, posuere sit amet dapibus ut, facilisis sed est. Nam id risus quis ante semper consectetur eget aliquam lorem. Vivamus tristique elit dolor, sed pretium metus suscipit vel. Mauris ultricies lectus sed lobortis finibus. Vivamus eu urna eget velit cursus viverra quis vestibulum sem. Aliquam tincidunt eget purus in interdum. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.</p>

</body>
</html>
```

对于 float:
1. 浮动元素 (这个例子中的<img> 元素)会脱离正常的文档布局流，并吸附到其父容器的左边 (这个例子中的<body>元素)。
2. 在正常布局中位于该浮动元素之下的内容，此时会围绕着浮动元素，填满其右侧的空间。
3. 浮动内容仍然遵循盒子模型诸如外边距和边界。
4. 可以漂浮任何的东西，只要有两个项目的空间，以配合在一起。

### 4.2 多列浮动布局
```html
    <h1>2 column layout example</h1>

    <div>
        <h2>First column</h2>
        <p> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla luctus aliquam dolor, eu lacinia lorem placerat vulputate. Duis felis orci, pulvinar id metus ut, rutrum luctus orci. Cras porttitor imperdiet nunc, at ultricies tellus laoreet sit amet. Sed auctor cursus massa at porta. Integer ligula ipsum, tristique sit amet orci vel, viverra egestas ligula. Curabitur vehicula tellus neque, ac ornare ex malesuada et. In vitae convallis lacus. Aliquam erat volutpat. Suspendisse ac imperdiet turpis. Aenean finibus sollicitudin eros pharetra congue. Duis ornare egestas augue ut luctus. Proin blandit quam nec lacus varius commodo et a urna. Ut id ornare felis, eget fermentum sapien.</p>
    </div>

    <div>
        <h2>Second column</h2>
        <p>Nam vulputate diam nec tempor bibendum. Donec luctus augue eget malesuada ultrices. Phasellus turpis est, posuere sit amet dapibus ut, facilisis sed est. Nam id risus quis ante semper consectetur eget aliquam lorem. Vivamus tristique elit dolor, sed pretium metus suscipit vel. Mauris ultricies lectus sed lobortis finibus. Vivamus eu urna eget velit cursus viverra quis vestibulum sem. Aliquam tincidunt eget purus in interdum. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.</p>
    </div>
```

像上面这样，要实现一个两列布局，我们需要:
1. 每个列都需要一个外部元素来包含其内容，并让我们一次操作它的所有内容，这个外部元素通常是类似<article>，<section> 等语义化标签，这里使用的是 div 标签
2. 要想将两个 div 放在一起，我们需要将它们的宽度之和设置为父元素宽度的 100% 或者更小，这样它们才能彼此相邻
3. 最后让两个 div 标签左右浮动

下面是设置的 CSS 样式

```html
<style>
    div:nth-of-type(1) {
        width: 48%;
        float: left;
    }

    div:nth-of-type(2) {
        width: 48%;
        float: right;
    }
</style>
```

### 4.3 清除浮动
浮动存在的一个问题是所有在浮动下面的自身不浮动的内容都将围绕浮动元素进行包装。通过 clear 属性可以清除浮动。当你把这个应用到一个元素上时，它主要意味着"此处停止浮动"——这个元素和源码中后面的元素将不浮动。

clear 可以取三个值：
1. left：停止任何活动的左浮动
2. right：停止任何活动的右浮动
3. both：停止任何活动的左右浮动

### 4.4 浮动问题
#### 浮动元素宽度问题
通过浮动来进行布局的一个问题是，通过合理配置浮动元素的宽度，包括边框和内外距。因为如果浮动元素的宽的和超过父元素，布局就会错乱。一种避免边框内边距对宽度造成的方式是使用  box-sizing 属性。

box-sizing 通过更改盒模型来拯救我们，盒子的宽度取值为 content + padding + border，而不仅是之前的content——所以当增加内边距或边界的宽度时，不会使盒子更宽——而是会使内容调整得更窄。

box-sizing 取值包括:
1. content-box: width = content
2. border-box: width = border + padding + content

#### 清除浮动的元素无法设置外边距问题
浮动的元素存在于正常的文档布局流之外，在某些方面的行为相当奇怪：
1. 首先，他们在父元素中所占的面积的有效高度为0 
2. 其次，非浮动元素的外边距不能用于它们和浮动元素之间来创建空间

我们可以通过在浮动和非浮动元素之间创建一个不显示的空标签来解决。像下面这样:
1. 通过 div.clearfix 来清除浮动
2. 将外边距加在 div.clearfix 和 footer 之间

```html
<style>
    .clearfix {
        clear: both;
    }
</style>

<div>
        <h2>Second column</h2>
        <p>Nam vulputate diam nec tempor bibendum. Donec luctus augue eget malesuada ultrices. Phasellus turpis est, posuere sit amet dapibus ut, facilisis sed est. Nam id risus quis ante semper consectetur eget aliquam lorem. Vivamus tristique elit dolor, sed pretium metus suscipit vel. Mauris ultricies lectus sed lobortis finibus. Vivamus eu urna eget velit cursus viverra quis vestibulum sem. Aliquam tincidunt eget purus in interdum. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.</p>
</div>

<div class="clearfix"></div>

<footer>
</footer>
```

#### 不同列的行高不一样
最后一个问题是我们布局的多列高度不同，我们可以通过给所有的列固定height 来解决这个问题，但是它使设计呆板，因此我们需要更加高级的布局技术。

# 1. 学习资源
1. [MDN-CSS布局](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Introduction): 非常的详细清晰
2. [B站油管最火CSS布局视频](https://www.bilibili.com/video/BV1X7411m7SH?from=search&seid=6929047692861071784): 看完 MDN 在看
3. [B站小甲鱼](https://www.bilibili.com/video/BV1QW411N762?p=52): 没有一点 HTML 和 CSS 基础的可以先看这个视频