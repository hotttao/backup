---
title: 4 CSS 布局-弹性盒子和多列布局
date: 2020-09-04
categories:
    - 前端
tags:
	- HTML&CSS
---

本篇是 CSS 布局的第三篇，今天我们来介绍 CSS3 另外两种布局技术弹性盒子和多列布局。
<!-- more -->

## 1. 弹性盒子
弹性盒子是一种用于按行或按列布局元素的一维布局方法。长久以来，CSS 布局中唯一可靠且跨浏览器兼容的创建工具只有 floats 和 positioning，但是下面简单的需求却难以实现:
1. 在父内容里面垂直居中一个块内容。
2. 使容器的所有子项占用等量的可用宽度/高度，而不管有多少宽度/高度可用。
3. 使多列布局中的所有列采用相同的高度，即使它们包含的内容量不同。

弹性盒子使得很多布局任务变得更加容易。

### 1.1 flex 模型说明
当元素表现为 弹性盒子(flex) 时，它们沿着两个轴来布局：

![弹性盒子模型](/images/html_css/flex_terms.png)

1. flex container: 设置了 display: flex 的父元素被称之为 flex 容器。
2. flex 项（flex item）:在 flex 容器中表现为弹性盒子的元素
3. 主轴（main axis）是沿着 flex 元素放置的方向延伸的轴。该轴的开始和结束被称为 main start 和 main end。
4. 交叉轴（cross axis）是垂直于 flex 元素放置方向的轴。该轴的开始和结束被称为 cross start 和 cross end。

前面我们介绍 display 属性的时候说过，dsiplay: flex 属于元素的内部显示类型，用来控制其**子元素**的布局。因此要创建弹性盒子，我们首先要为排版的内容创建一个容器，将父容器设置为 flex，他的直接子项将作为弹性盒子显示。

### 1.2 弹性盒子的相关属性
CSS 中有如下属性可以对弹性盒子进行设置:

|CSS 属性|作用|默认值|
|:---|:---|:---|
|flex-direction|指定主轴的方向，flex item放置方向|row，按行排列|
|flex-wrap|flex item 宽度之和超出容器时，自动换行||
|flex|设置 flex item 的宽度，有多种设置方式||
|flex-flow|flex-direction 和 flex-wrap||
|align-item|控制 flex item 在交叉轴上的位置|stretch|
|justify-content|控制 flex 项在主轴上的位置|flex-start|
|order|flex item 的属性值，控制其排序||


```html
<style>
    .container {
        flex-direction: row;
        flex-wrap: wrap;
    
        /* 合并写法 */
        flex-flow: row wrap;
    }
</style>
```

下面我们一一来介绍这些属性的用法和效果。下面是我们使用的基础示例:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Flexbox 0 — starting code</title>
    <style>
      html {
        font-family: sans-serif;
      }

      body {
        margin: 0;
      }

      header {
        background: purple;
        height: 100px;
      }

      h1 {
        text-align: center;
        color: white;
        line-height: 100px;
        margin: 0;
      }

      article {
        padding: 10px;
        margin: 10px;
        background: aqua;
      }

      /* Add your flexbox CSS below here */
    </style>
  </head>
  <body>
    <header>
      <h1>Sample flexbox example</h1>
    </header>

    <section>
      <article>
        <h2>First article</h2>

        <p>Tacos actually microdosing</p>
      </article>

      <article>
        <h2>Second article</h2>

        <p>Tacos actually microdosing2</p>
      </article>

      <article>
        <h2>Third article</h2>

        <p>Tacos actually microdosing3</p>
        </article>
    </section>
  </body>
</html>
```

### 1.3 display: flex
要想设置 <article> 元素为横向的三列布局，我们需要为 flexible 元素的父元素 section 设置 display：

```css
section {
  display:flex
}
```
![横向三列布局](/images/html_css/flexbox-example2.png)

### 1.4 flex-direction
flex-direction 可以指定主轴的方向（弹性盒子子类放置的地方），其有如下可选值:
1. row: 默认值，使得它们在按你浏览器的默认语言方向排成一排(前面说过不同语言的语言方向不一样，我们就是按行排列)
2. row-reverse: row 的逆序
3. column: 将主轴的方向设置为列(默认语言的垂直方向)

将其设置为 column，将使得页面回到最初的单列布局。

```css
section {
  display:flex;
  flex-direction: column;
}
```

### 1.5 flex-wrap
当在布局中使用定宽或者定高时，flex item 不会自动换行，从而超过父容器的宽度。解决的方式使用 flex-wrap 让 flex item 自动换行。

```css
section {
  display:flex;
  flex-wrap: wrap;
  flex-direction: column;
}
```

### 1.5 flex
flex 属性用于指定 flex item 行高或列宽。它是一个缩写属性，有如下几种设置方式:
1. 200px: 
    - 固定值，意味着每个元素的宽度至少是200px；
    - 可以单独指定全写 flex-basis 属性的值
2. 1: 
    - 无单位的比例值，表示每个元素占用空间都是相等的，占用的空间是在设置 padding 和 margin 之后剩余的空间
    - 可以单独指定全写 flex-grow 属性的值
3. 1 200px: 每个flex 项将首先给出200px的可用空间，然后，剩余的可用空间将根据分配的比例共享

### 1.6 align-item
align-items 控制 flex 项在交叉轴上的位置:
1. stretch: 
    - 默认的值，其会使所有 flex 项沿着交叉轴的方向拉伸以填充父容器
    - 如果父容器在交叉轴方向上没有固定宽度（即高度），则所有 flex 项将变得与最长的 flex 项一样长（即高度保持一致）。
2. center: 会使这些项保持其原有的高度，但是会在交叉轴居中。这就是那些按钮垂直居中的原因。
3. flex-start 或 flex-end: 使 flex 项在交叉轴的开始或结束处对齐所有的值
4. start 或 end
5. self-start 或 self-end

```css
container {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

item {
    align-self: flex-start
}
```
对 flex item 设置 align-self 属性可以覆盖 align-items 的行为。


### 1.7 justify-content
justify-content 控制 flex 项在主轴上的位置。
1. flex-start: 默认值，这会使所有 flex 项都位于主轴的开始处。
2. flex-end: 来让 flex 项位于主轴的结尾处。
3. center 在 justify-content 里也是可用的，可以让 flex 项在主轴居中。
4. space-around 是很有用的——它会使所有 flex 项沿着主轴均匀地分布，在任意一端都会留有一点空间。
5. space-between，它和 space-around 非常相似，只是它不会在两端留下任何空间。

### 1.8 order 
通过 order 属性，可以改变 flex 项的布局位置的功能，而不会影响到源顺序。

```css
button:first-child {
  order: 1;
}
```

注意:
1. 所有 flex 项默认的 order 值是 0。
2. order 值大的 flex 项比 order 值小的在显示顺序中更靠后。
3. 相同 order 值的 flex 项按源顺序显示
4. 也可以给 order 设置负值使它们比值为 0 的元素排得更前面