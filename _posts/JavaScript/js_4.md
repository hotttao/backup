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

var values = [1, 2, 3]
```

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
|`lastIndexOf(item, [start]`)|从后往前查找，严格相等||

注意: 如果数组中的某一项的值是null或者undefined，那么该值在join()、toLocaleString()、toString()和valueOf()方法返回的结果中以空字符串表示。

#### 数组项删除和替换
splice(start, del_num, item1, item2...): 
- 作用: 向数组中插入项，返回一个数组，包含删除的项
- 参数:
    - start: 开始位置
    - del_num: 删除的项数
    - 其他: 插入项

#### 数组迭代
迭代方法:
1. every()：对数组中的每一项运行给定函数，如果该函数对每一项都返回true，则返回true。
2. filter()：对数组中的每一项运行给定函数，返回该函数会返回true的项组成的数组。
3. forEach()：对数组中的每一项运行给定函数。这个方法没有返回值。
4. map()：对数组中的每一项运行给定函数，返回每次函数调用的结果组成的数组。
5. some()：对数组中的每一项运行给定函数，如果该函数对任一项返回true，则返回true。

每个方法都接收两个参数：要在每一项上运行的函数和（可选的）运行该函数的作用域对象。传入这些方法中的函数会接收三个参数：数组项的值、该项在数组中的位置和数组对象本身。


#### 归并
1. reduce(): 从左往右合并
2. reduceRight(): 从右往左合并

这两个方法都接收两个参数：一个在每一项上调用的函数和（可选的）作为归并基础的初始值。传给reduce()和reduceRight()的函数接收4个参数：前一个值、当前值、项的索引和数组对象。

## 2. Date 
