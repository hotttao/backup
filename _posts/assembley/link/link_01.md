---
title: 1. 《程序员的自我修养》读书笔记
date: 2021-10-17
categories:
    - 操作系统
tags:
	- 程序员的自我修养
	- 入门指南
---

没想到这么快就从心心恋恋的大厂走了，人生就是这么的奇特。不过博客终于可以续更了，这个系列是操作系统的第二个系列，内容是[《程序员的自我修养 : 链接、装载与库》](https://book.douban.com/subject/3652388/)的读书笔记，目的是深入学习应用程序是如何**编译、链接和运行**的。

## 1. 本书内容
[《程序员的自我修养 : 链接、装载与库》](https://book.douban.com/subject/3652388/)一书介绍了一个应用程序在编译、链接和运行时刻所发生的各种事项，包括：
1. 代码指令是如何保存的
2. 库文件如何与应用程序代码静态链接
3. 应用程序如何被装载到内存中并开始运行，动态链接如何实现
4. C/C++运行库的工作原理
5. 以及操作系统提供的系统服务是如何被调用的。
6. 详细描述现在流行的Windows和Linux操作系统下各自的可执行文件、目标文件格式；
7. 普通C/C++程序代码如何被编译成目标文件及程序在目标文件中如何存储；
8. 目标文件如何被链接器链接到一起，并且形成可执行文件；
9. 目标文件在链接时符号处理、重定位和地址分配如何进行；
10. 可执行文件如何被装载并且执行；
11. 可执行文件与进程的虚拟空间之间如何映射；
12. 什么是动态链接，为什么要进行动态链接；
13. Windows和Linux如何进行动态链接及动态链接时的相关问题；
14. 什么是堆，什么是栈；函数调用惯例；
15. 运行库，Glibc和MSVC CRT的实现分析；
16. 系统调用与API；

说实话在看这本书之前，上面很多问题自己从来都没想过，可能曾经看到了相关内容，脑海也曾一闪而过，但是从没有深入思考过。这次匆匆的大厂的经历，也让我意识到自己学习过程中的问题。直到目前为止，很多知识都停留在比较浅显的层次，越往下走越意识到这些底层的基础知识的重要性。十年磨一剑，这一次从头再来。

## 2. ELF 文件格式

```C
/* * SimpleSection.c * * 
Linux: *  
	 gcc -c SimpleSection.c * * 
Windows: *   
	cl SimpleSection.c /c /Za 
*/

int printf(const char* format, ...);
int global_init_var = 84;
int global_uninit_var;

void func1(int i)
{        
	printf( "%d\n",  i );
}
	
int main(void){    
	static int static_var = 85;
	static int static_var2;
	int a = 1;    
	int b;    
	func1(static_var + static_var2 + a + b);
	return a;
}
```

```bash
> objdump -h SimpleSection.o

SimpleSection.o：     文件格式 elf64-x86-64

节：
Idx Name          Size      VMA               LMA               File off  Algn
  0 .text         00000055  0000000000000000  0000000000000000  00000040  2**0
                  CONTENTS, ALLOC, LOAD, RELOC, READONLY, CODE
  1 .data         00000008  0000000000000000  0000000000000000  00000098  2**2
                  CONTENTS, ALLOC, LOAD, DATA
  2 .bss          00000004  0000000000000000  0000000000000000  000000a0  2**2
                  ALLOC
  3 .rodata       00000004  0000000000000000  0000000000000000  000000a0  2**0
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  4 .comment      0000002d  0000000000000000  0000000000000000  000000a4  2**0
                  CONTENTS, READONLY
  5 .note.GNU-stack 00000000  0000000000000000  0000000000000000  000000d1  2**0
                  CONTENTS, READONLY
  6 .eh_frame     00000058  0000000000000000  0000000000000000  000000d8  2**3
                  CONTENTS, ALLOC, LOAD, RELOC, READONLY, DATA

> size SimpleSection.o
   text    data     bss     dec     hex filename
    177       8       4     189      bd SimpleSection.o
```

00000055 + 00000040 = 00000095 对其到 00000098
