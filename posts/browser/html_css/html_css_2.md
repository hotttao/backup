---
title: 2 CSS 选择器
date: 2020-09-03
categories:
    - 前端
tags:
	- HTML&CSS
---

本节我们来学习 CSS 选择器，内容不复杂，就是要记住几种选择器语法。
<!-- more -->

## 1. 选择器的分类
通常我们将 CSS 选择器分为如下五类:
1. 基本选择器:
    - 通用选择器: *
    - 元素选择器：以某个 HTML 元素作为选择器
    - 类选择器: 使用 HTML 元素的 class 属性进行定位，语法为 .class
    - id选择器: 使用 HTML 元素的 id 属性进行定位，语法为 #id
2. 复合选择器: 由两个或者多个基础选择器组成
    - 交集选择器: 选择器.类选择器，元素选择器#id选择器
    - 并级选择器: 选择器1，选择器2,....
    - 后代选择器: 选择器1 选择器2 .....，选择所有后代元素
    - 子元素选择器: 选择器1 > 选择器2，只选择直接子元素
    - 相邻兄弟选择器: 选择器1 + 选择器2，选择器2选择的元素必须紧跟在选择器1后面，并且它们有相同父元素
    - 通用兄弟选择器: 选择器1 ~ 选择器2，与相邻兄弟选择器相比不需要紧挨着
3. 伪类选择器: 用于当已有元素处于某个状态时，为其添加样式
4. 伪元素选择器: 用于创建一些不存在文档树的元素，为其添加样式
5. 属性选择器: 通过元素的属性选择元素

接下来我们来详细讲解伪类与伪元素选择器。

## 2. 伪元素选择器
所谓伪元素选择器指的是"假装"有一个元素，然后选择它，包括:
1. ::first-line: 选择文本的第一行，仅对块级元素内的第一行内容有效
2. ::first-letter: 选择文本块的第一个字符
3. ::before/::after: 
4. ::selection: 选择用户选中的文本

## 3. 伪类选择器
所谓伪类选择器指的是选择处于特定状态的元素，包括:
1. 动态伪类选择器
2. UI 伪类选择器
3. 结构伪类选择器
4. 其他伪类选择器

![伪类选择器](/images/JavaScript/select_css.png)

### 3.1 动态伪类选择器
动态伪类选择器会根据条件的改变而匹配元素，包括:
1. 伪类选择器:
    - :link: 链接未被访问时
    - :visited: 链接被访问过后
    - :hover: 当鼠标悬停在链接上时，
    - :active: 鼠标按下链接的那一刻
    - :focus: 当元素获取焦点时，所谓获取焦点指的是能获取键盘输入的字符时
2. 说明: 
    - :hover 必须位于:link 和 :visited 后面，:active 必须位于 :hover 后面，记忆方法 LOVE & HATE
    - :hover 伪类选择器可以用于所有标签上
    - 其他伪类选择器只能用于 a 标签上

```css
div:hover{
    background-color: green;
}
div:hover span{
    color: white;
}
```

### 3.2 UI 伪类选择器
UI 伪类选择器用于选择具有特定状态的表单元素:
1. 通用 UI 伪类选择器:
    - :enable/:disable: 分别用于选中可用和不可用状态下的表单
    - :checked: 用于选中单选框，复选框和下拉列表被选中的选项
    - :required/:optional: 用于选中可选和必选的表单元素
    - :default: 选中默认的表单元素，比如提交表单就是一个默认元素
    - :read-only/:read-write: 分别用于选中只读和可读可写的表单元素，input 默认是可读可写的
2. 适用于 input 的 UI 伪类选择器:
    - :vaild/:invalid: 用于选中值合法和不合法的 input 元素
    - :in-range/:out-of-range: 
        - 适用: 设置了min，max 属性且 type="number" 的 input 元素
        - :in-range 表示值在范围内时选中，:out-of-range 表示不在范围内时选中

### 3.3 结构伪类选择器
结构伪类选择器用于选择 DOM 中特定位置的元素，包括:
1. 没什么用的结构伪类选择器:
    - :root: 总是匹配到 HTML 元素
    - :empty: 总是匹配没有定义任何内容的元素
2. 匹配子元素的结构伪类选择器: 选择的方式是元素相对于其父元素的位置
    - :first-child/:last-child: 
        - 作用: 选择第一个和最后一个子元素
        - 示例: p:first-child 选择p元素，且p是其父元素的第一个子元素
    - :only-child: 如果该元素是其父元素的唯一子元素，选中
    - :only-of-type: 
        - 作用: 如果子元素是其父元素下唯一类型的子元素，选中
        - 示例: strong:only-of-type 如果 strong 是其父元素内的唯一一个 strong，选中
    - :first-of-type/:last-of-type:
        - 作用: 选择第一个和最后一个特定类型的子元素
        - 示例: p:first-of-type 如果 p 是其父元素内第一 p 元素，不一定是第一个位置，选中
    - :nth-child(n)/:nth-last-child(n): 
        - 作用: n 指定元素所在的索引，:nth-child(n) 表示匹配顺序第 n 个子元素
        - 示例: p:nth-child(3) 如果 p 是其父元素的第三个子元素，选中
    - :nth-of-type(n)/:nth-last-of-type(n): 
        - 作用: n 指定元素所在的索引，但是索引仅限于指定的特定类型
        - 示例: p:nth-of-type(3) 如果 p 是其父元素的第三个 p 元素，选中

### 3.4 其他伪类选择器
其他伪类选择器是不能归属于上面分类的伪类选择器，包括:
1. :target: 选中页面内锚点
2. :lang():
    - 作用: 匹配了设置了 lang 全局属性的元素
    - 示例: lang(en) 选中类似 `<p lang="en"></p>` 设置了 lang="en" 的元素
3. :not(selector): 
    - 作用: 否定选择器，选择 selector 选择器选中之外的元素

## 4. 属性选择器
|选择器|描述|
|:---|:---|
|[attribute]|用于选取带有指定属性的元素|
|[attribute=value]|用于选取带有指定属性和值的元素|
|[attribute~=value]|用于选取属性值中包含指定词汇的元素，该值必须是整个单词|
|[attribute|=value]|用于选取带有以指定值开头的属性值的元素，该值必须是整个单词|
|[attribute^=value]|匹配属性值以指定值开头的每个元素|
|[attribute$=value]|匹配属性值以指定值结尾的每个元素|
|[attribute*=value]|匹配属性值中包含指定值的每个元素|

```css
[class|=top]
{ 
background-color:yellow;
}
```

上面的 css 将选中一下标签:

```html
<p class="top aaa"></p>
 <!-- 横杠作为分隔符的也可以匹配 -->
<p class="top-aaa"></p>
```