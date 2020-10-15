---
title: 9 JavaScript DOM
date: 2020-08-12
categories:
    - 前端
tags:
	- JavaScript
---
JavaScript 的文档对象模型 DOM。
<!-- more -->


## 1. DOM 对象模型简介
HTML 文档在浏览器加载后会成为一颗 DOM 树供 JavaScript 使用(通过 document 对象访问)。树中节点按照在 HTML 中不同部分分成:
1. 文档节点: 文档的根节点，即 document
2. 元素节点: HTML 元素标签
3. 特性节点: HTML 标签的特性 attribute
4. 文本节点: HTML 标签内的文本
4. 注释节点: HTML 注释信息

总共 12 个节点类型，这些都类型都继承自一个基类型 Node。DOM 提供了众多的属性和方法来设置标签，并通过树特有的家谱定位方式(父节点，子节点...)提供了查找节点的方法。DOM 标准就是定义了不同DOM节点包含的属性和方法，接下来我们会就常用的部分一一介绍。

```js
                        Node

HTMLDocument        HTMLElement       Text    Comment
```

## 2.Node
Node 在继承关系中相当于所有节点的基类，它在 DOM1级定义

### 2.1 Node 提供的属性
Node 基类提供了如下的属性用于获取节点信息和节点的关联节点:

|属性|返回值|
|:---|:---|
|nodeType| 节点类型|
|nodeName| 节点名称|
|nodeValue| 节点包含值|
|childNodes| 返回一个类数组的 NodeList 对象包含了节点包含的所有直接子节点|
|parentNode| 节点的父节点|
|previousSibling| 上一个同胞节点 |
|nextSibling| 下一个同胞节点|
|firstChild| childNodes列表中的第一个|
|lastChild| childNodes列表中的最后一个节点|
|ownerDocument| 指向表示整个文档的文档节点|
|hasChildNodes()| 在节点包含一或多个子节点的情况下返回true|

需要注意的是虽然所有节点类型都继承自Node，但并不是每种节点都有子节点。

#### nodeName，nodeValue
nodeName，nodeValue 属性依节点类型返回不同值，对应关系如下:

|nodeType|nodeName|nodeValue|
|:---|:---|:---|
|Node.ELEMENT_NODE(1)|元素标签名|null|
|Node.ATTRIBUTE_NODE(2)|||
|NodeTEXT_NODE(3)|#text|文本值|
|Node.CDATA_SECTION_NODE(4)|||
|Node.ENTITY_REFERENCE_NODE(5)|||
|Node.ENTITY_NODE(6)|||
|Node.PROCESSING_INSTRUCTION_NODE(7)|||
|Node.COMMENT_NODE(8)|#comment|注释内容|
|Node.DOCUMENT_NODE(9)|#document|null|
|Node.DOCUMENT_TYPE_NODE(10)|doctype名称|null|
|Node.DOCUMENT_FRAGMENT_NODE(11)|||
|Node.NOTATION_NODE(12|||

#### NodeList 
node.childNodes 返回的  NodeList 是一个类数组对象，支持方括号语法索引节点。NodeList对象的独特之处在于，它实际上是基于DOM结构动态执行查询的结果，因此DOM结构的变化能够自动反映在NodeList对象中，而不是一次访问时的快照。

```js
var firstChild = someNode.childNodes[0]
var secondChild = someNode.childNodes.item(1)
var count = someNode.childNodes.length
var arrayOfNode = Array.prototype.slice.call(someNode.childNodes, 0)
```

### 2.2 Node 提供的方法
Node 基类提供了如下的方法用于操作节点包含的子节点。

|方法|作用|返回值|
|:---|:---|:---|
|appendChild(node)|在节点尾部添加子节点|返回追加的节点|
|insertBefore(node, baseNode)|将节点插入到baseNode(参照节点)前|插入的节点|
|replaceChild(node, replaceNode)|替换节点||
|removeChild(node)|移除节点|返回移除的节点|
|cloneNode(bool)|创建节点的副本，参数表示是否深复制<br>true 表示深复制，即复制节点及其整个子节点树<br>false，执行浅复制，即只复制节点本身|


#### appendChild
最常用的方法是appendChild()，用于向childNodes列表的末尾添加一个节点。添加节点后，childNodes的新增节点、父节点及以前的最后一个子节点的关系指针都会相应地得到更新。如果传入到appendChild()中的节点已经是文档的一部分了，那结果就是将该节点从原来的位置转移到新位置

#### insertBefore
insertBefore 接受两个参数：要插入的节点和作为参照的节点。如果参照节点是null，则insertBefore()与appendChild()执行相同的操作。

#### replaceChild,removeChild
replaceChild()，removeChild()移除的节点仍然为文档所有，只不过在文档中已经没有了自己的位置。

前面介绍的四个方法操作的都是某个节点的子节点，也就是说，要使用这几个方法必须先取得父节点（使用parentNode属性）。另外，并不是所有类型的节点都有子节点，如果在不支持子节点的节点上调用了这些方法，将会导致错误发生。

#### cloneChild
cloneChild 复制后返回的节点副本属于文档所有，但并没有为它指定父节点。因此，这个节点副本就成为了一个“孤儿”，除非通过appendChild()、insertBefore()或replaceChild()将它添加到文档中.

接下来我们来一一介绍常见的具体 DOM 节点类型。

## 3. Document 节点
JavaScript通过Document类型表示文档。在浏览器中，document对象是 HTMLDocument （继承自Document类型）的一个实例，表示整个HTML页面。而且，document对象是window对象的一个属性，因此可以将其作为全局对象来访问。

Document节点的子节点可以是DocumentType、Element、ProcessingIn-struction或Comment。DocumentType 用于特殊表示 <! DOCTYPE>标签。

### 3.1 document 的属性

|属性|返回值|
|:---|:---|
|documentElement|指向`<html>`元素|
|body|指向`<body>`元素|
|doctype|指向<! DOCTYPE>标签元素|
|title|包含着`<title>`元素中的文本，修改title属性的值会改变`<title>`元素|
|URL|页面完整的URL|
|domain|页面的域名|
|referrer|页面跳转前的URL|
|anchors|包含文档中所有带name特性的`<a>`元素|
|forms|包含文档中所有的`<form>`元素|
|images|包含文档中所有的`<img>`元素|
|links|包含文档中所有带href特性的`<a>`元素|

### 3.2 document 节点查找
document 下列方法提供了索引 DOM 树节点的方法:

|方法|作用|返回值|
|:---|:---|:---|
|getElementById(id)|通过标签 id 查找元素节点|元素节点|
|getElementsByTagName(tag)|通过标签名查找元素节点|NodeList|
|getElementByName(name)|返回带有给定name特性的所有元素|HTMLCollection|

#### getElementsByTagName
getElementsByTagName 返回的是包含零或多个元素的NodeList。在HTML文档中，这个方法会返回一个HTMLCollection对象，作为一个“动态”集合，该对象与NodeList非常类似。

HTMLCollection 对象还有一个方法，叫做namedItem()，使用这个方法可以通过元素的name特性取得集合中的项。对命名的项也可以使用方括号语法来访问

```js
var images = document.getElementByTagName("img");
var myImage = images.namedItem("myImage");
var myImage = images["myImage"];
```

对HTMLCollection而言，我们可以向方括号中传入数值或字符串形式的索引值。在后台，对数值索引就会调用item()，而对字符串索引就会调用namedItem()。

### 3.3 document 文档写入
document 下列方法提供了将输出流写入到网页中的能力:
1. write()、writeln():
    - 接受一个字符串参数，即要写入到输出流中的文本
    - write()会原样写入，而writeln()则会在字符串的末尾添加一个换行符（\n）
    - 还可以使用write()和writeln()方法动态地包含外部资源
    - 在页面被呈现的过程中 document.write() 将直接向其中输出了内容
    - 如果在文档加载结束后再调用document.write()，那么输出的内容将会重写整个页面 
2. open()和close(): 分别用于打开和关闭网页的输出流


```js
// 字符串"</script>"将被解释为与外部的<script>标签匹配，结果文本"，需要转义
document.write("<script type=\"\text/javascript" scr=\"file.js\">" + "<\/script>");

// 到页面完全加载之后延迟执行的 document.write 将重写整个页面
window.onload = function(){
    document.write("hello world")
}
```

### 3.4 document 节点创建
document.createElement()方法可以创建新元素节点。这个方法只接受一个参数，即要创建元素的标签名。这个标签名在HTML文档中不区分大小写。要把新元素添加到文档树，可以使用appendChild()、inser-tBefore()或replaceChild()方法。

```js
div = document.createElement("div");
```

document.createTextNode()可以创建新文本节点，这个方法接受一个参数——要插入节点中的文本

## 4. Element 节点
Element类型用于表现XML或HTML元素，提供了对元素标签名、子节点及特性的访问。HTML元素所有HTML元素都由HTMLElement类型表示，HTMLElement 类型直接继承自Element并添加了一些属性。

所有HTML元素都是由 HTMLElement 或者其更具体的子类型来表示的。下表列出了所有HTML元素以及与之关联的类型。每种 HTMLElement 子类型都有与之相关的特性和方法，这里我们只介绍 HTMLElement 的通用属性和方法。

![HTMLElement子类](/images/JavaScript/html_element.jpg)

### 4.1 HTMLElement 的属性

|属性|返回值|
|:---|:---|
|tagName|通 nodeName 返回节点标签名|
|id|元素在文档中的唯一标识符|
|title|有关元素的附加说明信息，一般通过工具提示条显示出来|
|className|与元素的class特性对应，即为元素指定的CSS类<br>更改 css 属性于此关联的样式会立即更新|
|attributes|NamedNodeMap 特性节点 Attr 的集合(不推荐使用)|
|style|设置 CSS 样式的对象|
|onclick|等等时间处理程序|
|childNodes| 返回一个类数组的 NodeList 对象包含了节点包含的所有直接子节点|

#### attributes
attributes属性返回的 NamedNodeMap 是如下 {"attr": Attr 节点} 的集合 
```js
> div = document.getElementById("s_top_wrap")
> div.attributes
0: id
1: class
2: style
length: 3
class: class
id: id
style: style
__proto__: NamedNodeMap
```

与NodeList类似，NamedNodeMap 也是一个“动态”的集合。元素的每一个特性都由一个Attr节点表示。通常我们使用 attributes 属性去遍历元素的所有特性。

```js
for (let i=0;i<div.attributes.lenght;i++){
    attr = div.attrbutes[i].nodeName;
    value = div.attrbutes[i].nodeValue;
}
```

### 4.2 HTMLElement 特性获取
html 元素特性操作主要有如下三个方法:
1. getAttribute(attr)
2. setAttribute(attr, value)
3. removeAttribute(attr)

#### getAttribute
getAttribute 用于通过特性名获取特性值。attr 为特性名，不区分大小写。HTMLElement 有5个属性可以通过 HTMLElement 节点本身的属性来访问(上面我们已经列出)。有两类特殊的特性，它们虽然有对应的属性名，但属性的值与通过getAttribute()返回的值并不相同:
1. 第一类特性就是style:
    - 通过getAttribute()访问时，返回的style特性值中包含的是CSS文本
    - 通过属性来访问它则会返回一个对象
2. 第二类特性是onclick这样的事件处理程序
    - 通过getAttribute()访问，则会返回相应代码的字符串
    - 在访问onclick属性时，则会返回一个JavaScript函数

由于存在这些差别，在通过JavaScript以编程方式操作DOM时，开发人员经常不使用getAttri-bute()，而是只使用对象的属性。只有在取得自定义特性值的情况下，才会使用getAttribute()方法。

```js
div = document.getElementById("myDiv");
div.getAttribute("id");
div.getAttribute("class");
```

#### setAttribute
setAttribute(attr, value) 用于设置特性值。setAttribute()会以指定的值替换现有的值；如果特性不存在，setAttribute()则创建该属性并设置相应的值。因为所有特性都是属性，所以直接给属性赋值可以设置特性的值。不过，像下面这样为DOM元素添加一个自定义的属性，该属性不会自动成为元素的特性。

```js
div.mycolor = "red";
div.getAttribute("mycolor"); // null
```

#### removeAttribute
调用这个方法不仅会清除特性的值，而且也会从元素中完全删除特性。

## 5. Text 节点
Text 节点存在如下属性和方法:
1. normalize()： 如果在一个包含两个或多个文本节点的父元素上调用normalize()方法，则会将所有文本节点合并成一个节点，结果节点的nodeValue等于将合并前每个文本节点的nodeValue值拼接起来的值
2. splitText(index): 与normalize()相反的方法,将一个文本节点分成两个文本节点，即按照指定的位置分割nodeValue值。


## 6. DOM2 以及 HTML 标准
前面我们已经介绍了 DOM 节点的基本内容。DOM 标准是一个不断完善的过程，这个过程因为某些特殊目的为多种节点添加了各种方法。接下来我们按照操作目的一一来介绍这些方法。

### 6.1 选择符API
选择符 API 提供了索引节点的新方法，这些方法适用于 HTMLDocument 和 HTMLElement 节点。

|方法|作用|
|:---|:---|
|querySelector(css)|querySelector()方法接收一个CSS选择符，返回与该模式匹配的第一个元素|
|querySelectorAll(css)|返回匹配css选择符的一个NodeList的实例|
|matchesSelector(css)|如果调用元素与该选择符匹配，返回true|
|getElementsByClassName()|接收一个包含一或多个类名的字符串，返回带有指定类的所有元素的NodeList|

处于效率考虑 querySelectorAll 返回的值实际上是带有所有属性和方法的NodeList，而其底层实现则类似于一组元素的快照，而非不断对文档进行搜索的动态查询。

### 6.2 元素遍历
对于HTML 中元素间的空格，不同浏览器处理方式不同，IE9及之前版本不会返回文本节点，而其他所有浏览器都会返回文本节点。这样，就导致了在使用childNodes和firstChild等属性时的行为不一致。Element Traversal规范新定义了一组属性。

|属性|作用|
|:---|:---|
|childElementCount|返回子元素（不包括文本节点和注释）的个数|
|firstElementChild|指向第一个子元素；firstChild的元素版|
|lastElementChild|指向最后一个子元素；lastChild的元素版|
|previousElementSibling|指向前一个同辈元素；previousSibling的元素版|
|nextElementSibling|指向后一个同辈元素；nextSibling的元素版|

### 6.3 class 增删改查
为了避免直接操作 class 类名字符串的复杂性，HTML5 新增了一个 classList 属性，classList属性是新集合类型DOMTokenList的实例。

DOMTokenList有一个表示自己包含多少元素的length属性，而要取得每个元素可以使用item()方法，也可以使用方括号语法。此外，这个新类型还定义如下方法。
1. add(value)：将给定的字符串值添加到列表中。如果值已经存在，就不添加了
2. contains(value)：表示列表中是否存在给定的值，如果存在则返回true，否则返回false。
3. remove(value)：从列表中删除给定的字符串。
4. toggle(value)：如果列表中已经存在给定的值，删除它；如果列表中没有给定的值，添加它。

### 6.4 焦点管理
HTML5也添加了辅助管理DOM焦点的功能。首先就是document.activeElement属性，这个属性始终会引用DOM中当前获得了焦点的元素。默认情况下，文档刚刚加载完成时，document.activeElement中保存的是document.body元素的引用。文档加载期间，document.activeElement的值为null。

另外就是新增了document.hasFocus()方法，这个方法用于确定文档是否获得了焦点。

### 6.5 插入标记
插入标记的技术，可以让我们快速插入多个HTML文本，而不必为带插入的每个HTML元素创建相应的节点。

#### innerHTML属性
在读模式下，innerHTML属性返回与调用元素的所有子节点（包括元素、注释和文本节点）对应的HTML标记。在写模式下，innerHTML会根据指定的值创建新的DOM树，然后用这个DOM树完全替换调用元素原先的所有子节点。

```js
div.innerHTML = "<div>test</div>"
```

使用innerHTML属性也有一些限制。比如，在大多数浏览器中，通过innerHTML插入`<script>`元素并不会执行其中的脚本。

#### outerHTML属性
在读模式下，outerHTML返回调用它的元素及所有子节点的HTML标签。在写模式下，outerHTML会根据指定的HTML字符串创建新的DOM子树，然后用这个DOM子树完全替换调用元素。

#### innerText属性
在通过innerText读取值时，它会按照由浅入深的顺序，将子文档树中的所有文本拼接起来。在通过innerText写入值时，结果会删除元素的所有子节点，插入包含相应文本值的文本节点。

#### outerText属性
除了作用范围扩大到了包含调用它的节点之外，outerText与innerText基本上没有多大区别。在读取文本值时，outerText与innerText的结果完全一样。但在写模式下，outerText就完全不同了：outerText不只是替换调用它的元素的子节点，而是会替换整个元素（包括子节点）。

### 6.6 滚动页面
HTML5选择了scrollIntoView()作为标准方法来实现滚动页面。scrollIntoView()可以在所有HTML元素上调用。如果给这个方法传入true作为参数，或者不传入任何参数，那么窗口滚动之后会让调用元素的顶部与视口顶部尽可能平齐。如果传入false作为参数，调用元素会尽可能全部出现在视口中，实际上，为某个元素设置焦点也会导致浏览器滚动并显示出获得焦点的元素。

## 7. 样式
任何支持style特性的HTML元素在JavaScript中都有一个对应的style属性。这个style对象是`CSSStyleDeclaration`的实例，包含着通过HTML的style特性指定的所有样式信息，但不包含与外部样式表或嵌入样式表经层叠而来的样式。在style特性中指定的任何CSS属性都将表现为这个style对象的相应属性。对于使用短划线（分隔不同的词汇，例如background-image）的CSS属性名，必须将其转换成驼峰大小写形式，才能通过JavaScript来访问。

由于float是JavaScript中的保留字，因此不能用作属性名。“DOM2级样式”规范规定样式对象上相应的属性名应该是cssFloat;

```js
div = document.getElementById("myDiv");
div.style.backgroundColor="red";
```

### 7.1 style 对象属性和方法
style 对象提供了如下属性和方法:
1. cssText：返回style特性中的CSS代码
    - 读取模式下，cssText返回浏览器对style特性中CSS代码的内部表示
    - 在写入模式下，赋给cssText的值会重写整个style特性的值
    - 设置cssText是为元素应用多项变化最快捷的方式，因为可以一次性地应用所有变化。
2. length：应用给元素的CSS属性的数量
3. parentRule：表示CSS信息的CSSRule对象
4. getPropertyCSSValue(propertyName)：返回包含给定属性值的CSSValue对象
    - CSSValue对象 包含两个属性 cssText和cssValueType
    - cssText属性的值与getPropertyValue()返回的值相同
    - cssValueType属性则是一个数值常量，表示值的类型：0表示继承的值，1表示基本的值，2表示值列表，3表示自定义的值。
6. getPropertyValue(propertyName)：返回给定属性的字符串值
5. getPropertyPriority(propertyName)：如果给定的属性使用了！important设置，则返回"important"；否则，返回空字符串
7. item(index)：返回给定位置的CSS属性的名称，也可以使用方括号语法
8. removeProperty(propertyName)：从样式中删除给定属性
9. setProperty(propertyName, value, priority)：将给定属性设置为相应的值，并加上优先权标志（"important"或者一个空字符串）

```js
div.style.cssText = "width: 23px;"

for (let i=0; i<div.style.length;i++){
    console.log(div.style[i])
}

div.style.removeProperty("border");
```

### 7.2 计算样式
虽然style对象能够提供支持style特性的任何元素的样式信息，但它不包含那些从其他样式表层叠而来并影响到当前元素的样式信息。

“DOM2级样式”增强了document.defaultView，提供了getComputedStyle()方法。这个方法接受两个参数：
1. 要取得计算样式的元素和一个伪元素字符串（例如":after"）
2. 如果不需要伪元素信息，第二个参数可以是null

getComputedStyle()方法返回一个CSSStyleDeclaration对象（与style属性的类型相同），其中包含当前元素的所有计算的样式。所有计算的样式都是只读的；不能修改计算后样式对象中的CSS属性。