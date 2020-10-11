---
title: 4 JavaScript 内置的引用类型
date: 2020-08-07
categories:
    - 前端
tags:
	- JavaScript
---
如同其他语言一样，为了提高编程的效率，JavaScript 内置了常用的"数据结构"，包括 Array、Date、RegExp，在 JavaScript 它们都是引用类型。这些内置类型一般的有构造函数和字面量两种创建方式。
<!-- more -->


## 1. Array
JavaScript 的数组的每一项可以保存任何类型的数据，并且大小是可以动态调整的。数组的创建有两种方式:
1. Array 构造函数
2. 数组字面量: 不会调用Array构造函数

```js
var colors= new Array()   // new 关键字可以省略
var colors= Array(20) // 指定数组的长度
var colors= new Array("red", "blue") // 直接传入数组的项

var values = [1, 2, 3] // 数组字面量

// 数组类型检测
// 1. 对于一个网页，或者一个全局作用域，可以使用 instanceof
if (value instanceof Array){

}
// 2. 确定某个值到底是不是数组，而不管它是在哪个全局执行环境中创建的
if (Array.isArray(value)){

} 
```

使用 instanceof 进行类型检测的问题在于，它假定只有一个全局执行环境。如果网页中包含多个框架，那实际上就存在两个以上不同的全局执行环境，从而存在两个以上不同版本的Array构造函数。如果你从一个框架向另一个框架传入一个数组，那么传入的数组与在第二个框架中原生创建的数组分别具有各自不同的构造函数。从而导致检测失败。

### 1.1 Array 数组长度
数组长度保存在 length 属性中，与其他语言相比，JavaScript 数组在扩展上有下面一些特性:
1. 如果设置某个值的索引超过了数组现有项数，数组就会自动增加到该索引值加1的长度，新增的每一项都会取得undefined值
2. Arrary.length 属性不是只读的，通过设置这个属性，可以从数组的末尾移除项或向数组中添加新项
3. 数组最多可以包含4294967295个项

### 1.2 Array 的属性和方法
#### 通用方法
|属性/方法|作用|示例|
|:---|:---|:---|
|valueOf()|返回数组本身||
|toString()|对每一项调用 toString()，并返回逗号分隔的字符串||
|toLocalString()|对每一项调用 toLocalString()，并返回逗号分隔的字符串||
|join(seq)|返回以特定字符分隔的字符串，seq默认为逗号||
|push(arg1,arg2)|将任意项添加到数组末尾，返回修改后数组长度||
|pop()|弹出数组末尾项||
|shift()|移除数组中的第一个项并返回该项，同时将数组长度减1||
|unshift(arg1, arg2)|在数组前端添加任意个项并返回新数组的长度||
|reverse()|反转数组||
|sort(func)|默认调用每个数组项的toString()并排序，func 是用于决定如何排序的函数||
|concat(item, array)|默认返回当前数组的副本，有参数返回合并后的数组||
|slice(start, end)|切片，支持负索引|
|`indexOf(item, [start]`)|从前往后查找，严格相等||
|`lastIndexOf(item, [start]`)|从后往前查找，严格相等，start 是正向索引||

注意: 如果数组中的某一项的值是null或者undefined，那么该值在join()、toLocaleString()、toString()和valueOf()方法返回的结果中以空字符串表示。

```js
var a = [1, 3, 2]
a.sort(function (v1, v2){
    return v2 - v1
})

b = a.concat(4, [20, 13])

```

#### 数组项删除和替换
splice(start, del_num, item1, item2...): 
- 作用: 向数组中插入项，返回一个数组，包含删除的项
- 参数:
    - start: 开始位置，从 0 开始
    - del_num: 删除的项数
    - 其他: 插入项

```js
var color = ['red', 'green', 'black]

> color.splice(0, 1) // 删除第一项
["red"]

> color.splice(1, 0, 'yellow', 'test') // 从第二项开始插入
```

#### 数组迭代
迭代方法:
1. every()：对数组中的每一项运行给定函数，如果该函数对每一项都返回true，则返回true。
2. filter()：对数组中的每一项运行给定函数，返回该函数会返回true的项组成的数组。
3. forEach()：对数组中的每一项运行给定函数。这个方法没有返回值。
4. map()：对数组中的每一项运行给定函数，返回每次函数调用的结果组成的数组。
5. some()：对数组中的每一项运行给定函数，如果该函数对任一项返回true，则返回true。

每个方法都接收两个参数：要在每一项上运行的函数和（可选的）运行该函数的作用域对象。传入这些方法中的函数会接收三个参数：数组项的值、该项在数组中的位置和数组对象本身。

```js
var num = [1, 2, 5, 10]
everyResult = num.every(function (item, index, array){
    return item > 2
})
```

#### 归并
1. reduce(): 从左往右合并
2. reduceRight(): 从右往左合并

这两个方法都接收两个参数：一个在每一项上调用的函数和（可选的）作为归并基础的初始值。传给reduce()和reduceRight()的函数接收4个参数：前一个值、当前值、项的索引和数组对象。

```js
var num = [1, 2, 3, 4]
var sum = num.reduce(function(pre, cur, index, array){
    return pre + cur
}, 1) // 11
```
## 2. Date 
Date 对象的创建有四种方式:
1. new + Date() 构造函数: 通过时间戳创建 Date 对象
2. Date.parse(): 解析字符串时间为 Date 对象
3. Date.UTC(): 返回参数表示时间的时间戳，Date.UTC()的参数分别是:
    - 年份
    - 基于0的月份（一月是0，二月是1，以此类推）
    - 月中的哪一天（1到31）
    - 小时数（0到23）、分钟、秒以及毫秒数
4. Date.now(): 返回调用此方法时的时间戳
```js
// 1. 构造函数
var now = new Date() // 不带参数返回当前时间的 Date 对象
var now = new Date(1602380330000) // 可接受一个毫秒的时间戳，返回对应时间的 Date对象

// 2. parse 方法
// 直接将表示日期的字符串传递给Date构造函数，会在后台调用 Date.parse()
var now = new Date("2019-10-11: 10:10:10")
var now = new Date.parse("2019-10-11: 10:10:10")

// 3. UTC 方法
var stamp = Date.UTC(2020, 10) // 11 月
var d = new Date(stamp)
// 如同模仿Date.parse()一样，Date构造函数也会模仿Date.UTC()
var y2k = new Date(2020, 10)
var t = new Date(2005, 4, 5, 10, 10, 23)

// 4. 当前时间戳
var stamp = Date.now()  // 等同于 +new Date()
var start =+new Date()  // + 用于将 Date 对象转成 number
```

### 2.2 Date 的属性和方法
|属性/方法|作用|示例|
|:---|:---|:---|
|valueOf()|返回日期的毫秒表示||
|toString()|通常返回带有时区信息的日期和时间||
|toLocalString()|按照与浏览器设置的地区相适应的格式返回日期和时间||
|toDateString()|以特定于实现的格式显示星期几、月、日和年||
|toTimeString()|以特定于实现的格式显示时、分、秒和时区；||
|toLocaleDateString()|以特定于地区的格式显示星期几、月、日和年；||
|toLocaleTimeString()|以特定于实现的格式显示时、分、秒；||
|toUTCString()|以特定于实现的格式完整的UTC日期||

### 2.3 Date 时间格式化
js 没有内置 Date 的时间格式化方法，下面是一个自定义的实现方式。方法里面用到了我们接下里要将的正则表达式 RegExp
```js
Date.prototype.format = function(fmt)   
{ //author: meizz   
  var o = {   
    "M+" : this.getMonth()+1,                 //月份   
    "d+" : this.getDate(),                    //日   
    "h+" : this.getHours(),                   //小时   
    "m+" : this.getMinutes(),                 //分   
    "s+" : this.getSeconds(),                 //秒   
    "q+" : Math.floor((this.getMonth()+3)/3), //季度   
    "S"  : this.getMilliseconds()             //毫秒   
  };   
  if(/(y+)/.test(fmt))   
    fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));   
  for(var k in o)   
    if(new RegExp("("+ k +")").test(fmt))   
  fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));   
  return fmt;   
}

var time1 = new Date().format("yyyy-MM-dd HH:mm:ss"); 
```

## 3. RegExp 正则表达式对象
### 3.1 RegExp 对象的创建
JS 的正则表达式与其他语言没有太大差别，其有两种创建方式:
1. 字面量: /pattern/flag
2. 构造函数: new RegExp(pattern, flag)

```js
var p1 = /[bc]at/gi
var p2= new RegExp("[bcat]", "gi")
```

由于RegExp构造函数的模式参数是字符串，所以在某些情况下要对字符进行双重转义。所有元字符都必须双重转义，那些已经转义过的字符也是如此，例如\n（字符\在字符串中通常被转义为\\，而在正则表达式字符串中就会变成\\\\）。下表给出了一些模式，左边是这些模式的字面量形式，右边是使用RegExp构造函数定义相同模式时使用的字符串。

|字面量|构造函数|
|:---|:---|
|/\[bc\]at/|"/\\[bc\\]at/"|
|/\w\\hello/|"\\w\\\\hello"|

### 3.2 RegExp 实例属性和方法

|属性/方法|作用|
|:---|:---|:---|
|global|布尔值，表示是否设置了g标志
|ignoreCase|布尔值，表示是否设置了i标志|
|lastIndex|整数，表示开始搜索下一个匹配项的字符位置，从0算起|
|multiline|布尔值，表示是否设置了m标志|
|source|正则表达式的字符串表示，按照字面量形式而非传入构造函数中的字符串模式|
|toLocaleString()|返回正则表达式的字面量|
|toString()|返回正则表达式的字面量|

#### exec 方法
exec(string)
- 作用: 
    - 返回包含第一个匹配项信息的数组，没有匹配时返回 null
    - 返回的数组虽然是Array的实例，但包含两个额外的属性：index和input。
    - index表示匹配项在字符串中的位置，而input表示应用正则表达式的字符串
- 匹配项:
    - 在数组中，第一项是与整个模式匹配的字符串
    - 其他项是与模式中的捕获组匹配的字符串（如果模式中没有捕获组，则该数组只包含一项）
- 注意:
    - 对于exec()方法而言，即使在模式中设置了全局标志（g），它每次也只会返回一个匹配项。
    - 设置全局标志时:
        - lastIndex的值在每次调用exec()后都会增加
        - 每次调用exec()则都会在字符串中继续查找新匹配项
    - 不设置全局标志
        - lastIndex 始终不变
        - 每次返回第一个匹配项目

```js
var text = "cat, dat, vat, tat"
var p = /(.at)/
m = p.exec(text) // m 将包含匹配项[cat, cat]
m[0] // 与整个模式匹配的字符串
m[1] // 匹配的分组

// 1. 不设置全局标志 g，对同一字符串， exec 总是返回第一个匹配项
m = p.exec(text) // m 仍将将包含匹配项[cat, cat]

// 在全局匹配模式下，
var p1 = /(.at)/g 
p1.exec(text) // [cat, cat]
p2.exec(text) // [dat, dat]
```

#### test 方法
text(string):
- 返回: 模式与字符串匹配成功时返回 true, 否则返回 false

### 3.3 RegExp 构造函数属性和方法
RegExp构造函数包含一些属性，适用于作用域中的所有正则表达式，并且基于所执行的最近一次正则表达式操作而变化。使用这些属性可以从exec()或test()执行的操作中提取出更具体的信息。这些属性分别有一个长属性名和一个短属性名:

|长属性名|短属性名|说明|
|:---|:---|:---|
|input|$_|最近一次要匹配的字符串|
|lastMatch|$&|最近一次的匹配项|
|lastParen|$+|最近一次匹配的捕获组|
|leftContext|$`|input 字符串中，lastMatch 之前的文本|
|rightContext|$'|input 字符串中，lastMatch 之后的文本|
|multiline|$*|布尔值，表示所有表达式是否都使用多行文本|
|$1-$9||存储第一、第二……第九个匹配的捕获组|

```js
var text = "aa short bb thort"
var p = /(.)hort/g
if (p.test(text)){
    console.log(RegExp.input)  // aa short bb thort
    console.log(RegExp.lastMatch) // short
    console.log(RegExp.lastParen) // s
    console.log(RegExp.leftContext) // aa
}
```
