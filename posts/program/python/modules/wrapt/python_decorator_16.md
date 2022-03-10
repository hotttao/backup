---
weight: 1
title: 16 wrapt 模块实战
date: '2018-06-07T22:10:00+08:00'
lastmod: '2018-06-07T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 16 wrapt 模块实战
featuredImage: null
tags:
- python 库
categories:
- Python
lightgallery: true
---

装饰器和 wrapt 模块的介绍已经结束，作为整个系列的最后一篇的实战篇，我们来实现在一开始我提出的一个需求

<!-- more -->

### 1. 应用场景
在我日常的开发过程中，经常要查询各种数据库，比如 mysql, mongo，es 。基本上所有的数据库对查询语句能添加的查询条件都有限制。对于大批量的查询条件，只能分批多次查询，然后将查询结果合并。我们能不能将这种查询分批在合并的操作抽象出来实现为一个装饰器，在需要时对查询函数包装即可？下面是我的一个实现示例。

### 2. 代码实现
```python
#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
作用：用于优化的装饰器
功能：
    1. 实现分组迭代，分批查询的装饰器
"""

import os
import sys
import wrapt
import inspect
import pandas


def get_slice(total_num, slice_num):
    """
    :return: 等大小切片
    """
    r = []
    n = total_num / slice_num
    m = total_num % slice_num
    end = 0
    for i in range(1, n + 1):
        start = slice_num * (i - 1)
        end = slice_num * i
        r.append(slice(start, end))
    else:
        if m > 0:
            r.append(slice(end, end + m))
    return r


def slice_call(iter_param, slice_num=500):
    @wrapt.decorator
    def wrapper(wrapped, instance, args, kwargs):
        # 函数自省
        param = inspect.getcallargs(wrapped, *args, **kwargs)
        if instance:
            param.pop('self')
        if 'kwargs' in param:
            kwargs = param.pop('kwargs',{})
            param.update(kwargs)

        iter_value = param.get(iter_param)

        if iter_value is None:
            return wrapped(**param)
        if isinstance(iter_value, pandas.DataFrame):
            iter_value.reset_index(drop=True, inplace=True)
        # 分批
        total_num = len(iter_value)
        slice_iter = get_slice(total_num, slice_num)
        result = []
        # 合并
        for s in slice_iter:
            param[iter_param] = iter_value[s]
            result.append(wrapped(**param))
        if result:
            return pandas.concat(result)
        else:
            return pandas.DataFrame()
    return wrapper


# slice_call 使用示例
@slice_call(iter_param='names')
def get_video_by_name(self, names, c_type):
    where_name = "'" + "','".join(names) + "'"
    sql = ('select * from table'
           'where a="%s" and b in (%s) and c>=0;'
           % (c_type, where_name))
    print sql
    df = self.mysql_obj.query('', sql)
    df['updateTime'] = df['updateTime'].apply(lambda x: x.strftime("%Y-%m-%d"))
    return df
```

`slice_call` 函数在使用有一个限制条件，被包装函数的返回值必需是 pandas.DataFrame。因为在我日常的工作中，经常使用到 pandas 进行数据分析，对我来说，DataFrame 是一个非常通用的数据结构，因此就在此基础上构建了 `slice_call` 装饰器。整个实现中使用的额外知识就是函数的自省，由 `inspect` 模块提供，其他有关装饰器的部分都是前面博客介绍的内容，相信大家应该很容易就能看懂。

## 结语
至此 Python 装饰器的内容就先到此为止，接下来想结合 wrapt, unittest, mock 来说一说如何在 Python 中作单元测试。
