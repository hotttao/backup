

# 将以下内容转换为模板
title_template = """---
weight: 1
title: "{title}"
date: {date}
lastmod: {lastmod}
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "{title}"
featuredImage: 

tags: {tags}
categories: {categories}

lightgallery: true

toc:
  auto: false
---
"""

# 遍历内容并写入文件
content = [
    {
        "title": "变量、类型",
        "content": """以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
1. 变量常量的声明、初始化；多变量的声明和初始化
2. 变量类型推导
4. 变量作用域

以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
类型:
4. 类型转换，包括显示转换和隐式转换
5. 类型重命名
6. 自定义类型、枚举类型定义
8. 类型、子类型判断、接口实现判断

以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
基础类型:
1. 类型、长度、字面量表示
2. 浮点数
3. 字符和字符串

以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
流控:
1. 条件
2. 循环
3. switch
3. 运算符和优先级
4. 表达式的求值顺序"""
    },
{
        "title": "流控",
        "content": """以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
流控:
1. 条件
2. 循环
3. switch
3. 运算符和优先级
4. 表达式的求值顺序"""
    },
    {
        "title": "函数",
        "content": """以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
函数:
1. 定义和声明
2. 传参方式
3. 匿名函数
4. 返回多个值
5. 异常处理"""
    },
    {
        "title": "面向对象",
        "content": """以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
面向对象编程:
1. 类定义
2. 类的继承
3. 方法定义
4. 方法重写
5. 函数重载

以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
接口和抽象类:
1. 接口定义和实现
2. 抽象类定义和实现"""
    },
    {
        "title": "模块和依赖管理",
        "content": """以表格为展示方式，从以下方面总结 JavaScript ES6 中的模块和依赖管理
模块:
1. 包的声明和导入
2. 包的搜索路径
3. 包的初始化顺序
4. 标识符的可见性
5. 依赖管理"""
    },
    {
        "title": "元编程",
        "content": """以表格为展示方式，从以下方面总结 JavaScript ES6 中的反射和泛型实现
反射实现
泛型"""
    },
    {
        "title": "复合数据类型",
        "content": """以表格为展示方式，从以下方面总结 JavaScript ES6 中的复合数据类型:
1. 基础类型的包装类型
2. 复合数据类型
3. 标准库的类型"""
    }
]

# 写入模板内容
import datetime
import argparse
import os

# 添加命令行参数
parser = argparse.ArgumentParser(description='生成对比文档')
parser.add_argument('-o', '--output_dir', help='输出目录')
parser.add_argument('-p', '--program', help='编程语言名称')
args = parser.parse_args()

# 确保输出目录存在
os.makedirs(args.output_dir, exist_ok=True)

# 遍历content，生成文件
for index, section in enumerate(content, start=1):
    filename = f"{index:02d}_{args.program}.md"
    filepath = os.path.join(args.output_dir, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        # 写入标题模板
        
        now = datetime.datetime.now()
        date = now.strftime("%Y-%m-%dT%H:%M:%S+08:00")
        
        title_template = title_template.format(
            title=section['title'],
            date=date,
            lastmod=date,
            tags=f'["{args.program} 语法"]',
            categories=f'["{args.program}"]'
        )

        f.write(title_template)
        f.write('\n\n')  # 添加空行
        
        # 写入内容
        f.write(f"## {section['title']}\n")
        f.write(section['content'])
        f.write('\n\n')  # 添加空行

print(f"文件已生成在 {args.output_dir} 目录下")
