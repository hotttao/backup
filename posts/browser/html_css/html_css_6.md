---
title: 6 CSS 布局-响应式布局
date: 2020-09-06
categories:
    - 前端
tags:
	- HTML&CSS
---


<!-- more -->

## 1. 什么是响应式布局

响应式网页设计(responsive web design，RWD）指的是允许Web页面适应不同屏幕宽度因素等，进行布局和外观的调整的一系列实践。现代的CSS布局方式基本上就是响应式的，其依赖于 CSS 的如下技术:
1. 媒体查询
2. 灵活网格

下面我们来一一介绍这些内容。

### 1.1 媒体查询
媒介查询允许我们运行一系列测试，例如用户的屏幕是否大于某个宽度或者某个分辨率，并将CSS选择性地适应用户的需要应用在样式化页面上。例如，下面的媒体查询用于测试当 Web 页面为屏幕媒体（也就是说不是印刷文档），且视口至少有800像素宽应用此 CSS 样式

```html
<style>
    @media screen and (min-width: 800px) { 
        .container { 
            margin: 1em 2em; 
        } 
    } 
</style>
```


媒体查询，以及样式改变时的点，被叫做断点（breakpoints）。使用媒体查询时的一种通用方式是，为窄屏设备（例如移动设备）创建一个简单的单栏布局，然后检查当前屏幕是否是大屏，如果是大屏采用一种多栏的布局 。这经常被描述为移动优先设计。

### 1.3 灵活网格
响应式站点是建立在灵活网格上的。一个灵活网格意味着你不需要适配每个可能使用的设备尺寸，然后为其建立一个精确到像素级的适配布局。使用灵活网格，你只需要加进去一个断点，在内容看起来不齐整的时候改变设计。现代布局方式，例如多栏布局、伸缩盒和网格默认是响应式的。这些现代 CSS 布局技术，我们在之前的章节都已经一一介绍过了。

### 1.4 响应式图像
最简单的处理响应式图像的方式是像下面这样缩放图片:

```css
img {
  max-width: 100%:
} 
```

这种方式有显然的弊端，图像有可能会显示得比它的原始尺寸小很多，以至于浪费带宽，对于移动端而言下载了过大的图片。响应式图像，使用了<picture>元素和<img> srcset和sizes 特性解决了这些问题。

你可以提供附带着“提示”（描述图像最适合的屏幕尺寸和分辨率的元数据）的多种尺寸，浏览器将会选择对设备最合适的图像，以确保用户下载尺寸适合他们使用的设备的图像。待会我们会详细介绍这些标签和特性的使用方式。

### 1.5 响应式排版
借助媒体查询，我们不仅可以实现响应式布局，还能实现响应式排版，即依据屏幕大小设置字体的大小。另一种实现响应式排版的方法是使用视口单位vw。这也是我们接下来要讲解的内容之一。


## 2. 媒体查询
CSS媒体查询提供了一种应用 CSS 的方法，即仅在浏览器和设备的环境与你指定的规则相匹配的时候CSS才会真的被应用。允许你按照视口的尺寸创建不同的布局。

### 2.1 媒体查询的语法
最简单的媒体查询语法看起来是像这样的：

```css
@media media-type and (media-feature-rule) {
  /* CSS rules go here */
}
```
它由以下部分组成：
1. 一个媒体类型，告诉浏览器这段代码是用在什么类型的媒体上的（例如印刷品或者屏幕）；
2. 一个媒体表达式，是一个被包含的CSS生效所需的规则或者测试；
3. 一组CSS规则，会在测试通过且媒体类型正确的时候应用。


### 2.2 媒体类型
媒体类型有：
1. all
2. print: 打印体
3. screen: 屏幕
4. speech


### 2.3 媒体特征规则
有多种设置媒体特性规则的方式:
1. 宽和高: 最常探测的特征是视口宽度，可以使用min-width、max-width和width媒体特征，在视口宽度大于或者小于某个大小——或者是恰好处于某个大小——的时候，应用CSS。
2. 朝向: 探测媒体是竖放（portrait mode）还是横放（landscape mode）模式

```css
/* max 表示小于 400px 适用 */
@media screen and (max-width: 400px) {
    body {
        color: blue;
    }
}

@media (orientation: landscape) {
    body {
        color: rebeccapurple;
    }
}
```

### 2.4 媒体特征规则运算符
媒体特征规则支持使用 and，","，not 来组合多个探测条件。

```css
/* and 表示逻辑与 */
@media screen and (min-width: 400px) and (orientation: landscape) {
    body {
        color: blue;
    }
}

/* 逗号表示或 */
@media screen and (min-width: 400px), screen and (orientation: landscape) {
    body {
        color: blue;
    }
}

/* not操作符让整个媒体查询失效。这就直接反转了整个媒体查询的含义 */
@media not all and (orientation: landscape) {
    body {
        color: blue;
    }
}
```

## 3. 响应式图像

## 4. 视口单位
另一种实现响应式排版的方法是使用视口单位vw。1vw等同于视口宽度的百分之一，即如果你用vw来设定字体大小的话，字体的大小将总是随视口的大小进行改变。

```css
h1 {
  font-size: 6vw;
}
```
问题在于，当做上面的事情的时候，因为文本总是随着视口的大小改变大小，用户失去了放缩任何使用vw单位的文本的能力。所以你**永远都不要只用viewport单位设定文本**。

### 4.1 calc()
这里有一个解决方法，它使用了calc()，如果你将vw单位加到了使用固定大小（例如em或者rem）的值组，那么文本仍然是可放缩的。基本来说，是vw加在了放缩后的值上。

```css
h1 {
  font-size: calc(1.5rem + 3vw);
}
```

也就是说，我们只需要指定标题的字体大小一次，而不是为移动端设定它，然后再在媒介查询中重新定义它。字体会在你增加视口大小的时候逐渐增大。

### 4.2 视口元标签
一张响应式页面的HTML源代码，你通常将会在文档的<head>看到下面的<meta>标签。

```html
<meta name="viewport" content="width=device-width,initial-scale=1">
```

这个元标签告诉移动端浏览器，它们应该将视口宽度设定为设备的宽度，将文档放大到其预期大小的100%。必须这么设置的原因是移动端浏览器倾向于在它们的视口宽度上说谎。

移动端浏览器经常会把视口宽度设为960像素，并以这个宽度渲染页面。结果就会导致你的带断点和媒介查询的响应式设计不会在移动端浏览器上像预期那样工作。如果你有个窄屏布局，在480像素及以下的视口宽度下生效，但是视口是按960像素设定的，你将不会在移动端看到你的窄屏布局。通过设定width=device-width 将浏览器视口宽度设置为设备宽度，你的媒介查询才会像预期那样生效。

所以你应该在你的文档头部总是包含上面那行HTML。

和视口元标签一起，你可以使用另外几个设定，但大体说来，上面那行就是你想要使用的。
1. initial-scale：设定了页面的初始缩放，我们设定为1。
2. height：特别为视口设定一个高度。
3. minimum-scale：设定最小缩放级别。
4. maximum-scale：设定最大缩放级别。
5. user-scalable：如果设为no的话阻止缩放。

你应该避免使用minimum-scale、maximum-scale，尤其是将user-scalable设为no。用户应该有权力尽可能大或小地进行缩放，阻止这种做法会引起访问性问题。


## 学习资源
1. [MDN-响应式布局](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Responsive_Design)
1. [MDN-媒体查询](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Media_queries)
1. [MDN-响应式图像](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
2. [B站油管最火CSS布局视频](https://www.bilibili.com/video/BV1X7411m7SH?from=search&seid=6929047692861071784): 看完 MDN 在看
3. [B站小甲鱼](https://www.bilibili.com/video/BV1QW411N762?p=52): 没有一点 HTML 和 CSS 基础的可以先看这个视频