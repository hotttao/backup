---
weight: 1
title: "Java 注解"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 注解"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---
Java 的注解语法上类似于 Python 的装饰器，但是用起来不太一样。Python 的装饰器是增加处理逻辑，Java 的注解是给类或者方法添加额外的元数据信息。从JVM的角度看，注解本身对代码逻辑没有任何影响，如何使用注解完全由工具决定。

## 1. 注解的定义
### 1.1 注解的语法
Java的注解可以分为三类：

1. 第一类是由编译器使用的注解，例如：
    - @Override：让编译器检查该方法是否正确地实现了覆写；
    - @SuppressWarnings：告诉编译器忽略此处代码产生的警告。
    - 这类注解不会被编译进入.class文件，它们在编译后就被编译器扔掉了。
2. 第二类是由工具处理.class文件使用的注解：
    - 比如有些工具会在加载class的时候，对class做动态修改，实现一些特殊的功能。
    - 这类注解会被编译进入.class文件，但加载结束后并不会存在于内存中。这类注解只被一些底层库使用，一般我们不必自己处理。
3. 第三类是在程序运行期能够读取的注解
    - 它们在加载后一直存在于JVM中，这也是最常用的注解
    - 例如，一个配置了@PostConstruct的方法会在调用构造方法后自动被调用（这是Java代码读取该注解实现的功能，JVM并不会识别该注解）

Java语言使用@interface语法来定义注解（Annotation），它的格式如下：

```java
public @interface Report {
    int type() default 0;
    String level() default "info";
    String value() default "";
}
```

注解的参数类似无参数方法，可以用default设定一个默认值。参数的类型可以包括：
1. 所有基本类型；
2. String；
3. 枚举类型；
4. 基本类型、String、Class以及枚举的数组。

因为配置参数必须是常量，所以，上述限制保证了注解在定义时就已经确定了每个参数的值。

### 1.2 元注解
有一些注解可以修饰其他注解，这些注解就称为元注解（meta annotation）。Java标准库已经定义了一些元注解，我们只需要使用元注解，通常不需要自己去编写元注解。

#### @Target
最常用的元注解是@Target。使用@Target可以定义Annotation能够被应用于源码的哪些位置，`@Target` 元注解的定义如下：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Target;

@Target(ElementType.ANNOTATION_TYPE) // 表示该注解可以应用于其他注解
public @interface Target {
    ElementType[] value(); // 返回一个数组，表示该注解可以应用的程序元素类型
}
```

`@ElementType` 是一个枚举数组(只有一个元素时，可以省略数组的写法)，用于指定自定义注解可以应用的程序元素类型，其可用值为：
- `ElementType.TYPE`: 可以应用于类、接口、枚举类等类型。
- `ElementType.FIELD`: 可以应用于字段（成员变量）。
- `ElementType.METHOD`: 可以应用于方法。
- `ElementType.PARAMETER`: 可以应用于方法的参数。
- `ElementType.CONSTRUCTOR`: 可以应用于构造函数。
- `ElementType.LOCAL_VARIABLE`: 可以应用于局部变量。
- `ElementType.ANNOTATION_TYPE`: 可以应用于其他注解。
- `ElementType.PACKAGE`: 可以应用于包。


```java
// 定义注解@Report可用在方法上，我们必须添加一个@Target(ElementType.METHOD)：
@Target(ElementType.METHOD)
public @interface Report {
    int type() default 0;
    String level() default "info";
    String value() default "";
}
// 定义注解@Report可用在方法或字段上
@Target({
    ElementType.METHOD,
    ElementType.FIELD
})
public @interface Report {
    ...
}
```

#### @Retention
另一个重要的元注解@Retention定义了Annotation的生命周，以下是 `@Retention` 元注解的定义：

```java
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

@Retention(RetentionPolicy.RUNTIME) // 表示该注解在运行时可见
public @interface Retention {
    RetentionPolicy value(); // 返回一个枚举值，表示注解的保留策略
}
```
`RetentionPolicy` 是一个枚举类，定义了三种保留策略：
- `RetentionPolicy.SOURCE`: 注解仅保留在源代码中，不会包含在编译后的字节码中，对运行时不可见。
- `RetentionPolicy.CLASS`: 注解保留在编译后的字节码中，但在运行时不可见。这是默认的保留策略。
- `RetentionPolicy.RUNTIME`: 注解保留在编译后的字节码中，并在运行时可见。可以通过反射机制获取并处理这些注解。


如果@Retention不存在，则该Annotation默认为CLASS。因为通常我们自定义的Annotation都是RUNTIME，所以，务必要加上@Retention(RetentionPolicy.RUNTIME)这个元注解：

```java
@Retention(RetentionPolicy.RUNTIME)
public @interface Report {
    int type() default 0;
    String level() default "info";
    String value() default "";
}
```

#### @Repeatable
使用@Repeatable这个元注解可以定义Annotation是否可重复。这个注解应用不是特别广泛。

```java

@Repeatable(Reports.class)
@Target(ElementType.TYPE)
public @interface Report {
    int type() default 0;
    String level() default "info";
    String value() default "";
}

@Target(ElementType.TYPE)
public @interface Reports {
    Report[] value();
}
```

经过@Repeatable修饰后，在某个类型声明处，就可以添加多个@Report注解：

```java
@Report(type=1, level="debug")
@Report(type=2, level="warning")
public class Hello {
}
```

#### @Inherited
使用@Inherited定义子类是否可继承父类定义的Annotation。@Inherited仅针对@Target(ElementType.TYPE)类型的annotation有效，并且仅针对class的继承，对interface的继承无效：

```java
@Inherited
@Target(ElementType.TYPE)
public @interface Report {
    int type() default 0;
    String level() default "info";
    String value() default "";
}
```

在使用的时候，如果一个类用到了@Report：

```java
@Report(type=1)
public class Person {
}
```
则它的子类默认也定义了该注解：

```java
public class Student extends Person {
}
```

#### 自定义注解
自定义注解时:
1. 通常把最常用的参数定义为value()
2. 所有参数都尽量设置默认值
3. 必须设置@Target和@Retention，@Retention一般设置为RUNTIME，因为我们自定义的注解通常要求在运行期读取

## 2. 注解的使用
注解是放在Java源码的类、方法、字段、参数前的一种特殊“注释”:

```java
@Resource("hello")
public class Hello {
    // 如果只写注解，相当于全部使用默认值。
    @Inject
    int n;

    @PostConstruct
    public void hello(@Param String name) {
        System.out.println(name);
    }

    @Override
    public String toString() {
        return "Hello";
    }
}

public class Hello {
    @Check(min=0, max=100, value=55)
    public int n;

    @Check(value=99)
    public int p;

    @Check(99) // @Check(value=99)
    public int x;

    // 如果只写注解，相当于全部使用默认值。
    @Check
    public int y;
}
```

## 3. 处理注解
### 3.1 读取注解的反射 API
根据@Retention的配置：
1. SOURCE类型的注解在编译期就被丢掉了；
2. CLASS类型的注解仅保存在class文件中，它们不会被加载进JVM；
3. RUNTIME类型的注解会被加载进JVM，并且在运行期可以被程序读取。

如何使用注解完全由工具决定。SOURCE类型的注解主要由编译器使用，因此我们一般只使用，不编写。CLASS类型的注解主要由底层工具库使用，涉及到class的加载，一般我们很少用到。因此，我们只讨论如何读取RUNTIME类型的注解。

因为注解定义后也是一种class，所有的注解都继承自java.lang.annotation.Annotation，因此，读取注解，需要使用反射API。

读取Annotation的方法包括：
1. 判断某个注解是否存在于Class、Field、Method或Constructor：
    - Class.isAnnotationPresent(Class)
    - Field.isAnnotationPresent(Class)
    - Method.isAnnotationPresent(Class)
    - Constructor.isAnnotationPresent(Class)
2. 读取Annotation：
    - Class.getAnnotation(Class)
    - Field.getAnnotation(Class)
    - Method.getAnnotation(Class)
    - Constructor.getAnnotation(Class)

```java
class cls = Person.class;
if (cls.isAnnotationPresent(Report.class)) {
    Report report = cls.getAnnotation(Report.class);
    ...
}

Class cls = Person.class;
Report report = cls.getAnnotation(Report.class);
if (report != null) {
   ...
}
```

读取方法参数的Annotation就比较麻烦一点，因为方法参数本身可以看成一个数组，而每个参数又可以定义多个注解，所以，一次获取方法参数的所有注解就必须用一个二维数组来表示

```java
public void hello(@NotNull @Range(max=5) String name, @NotNull String prefix) {
}

// 获取Method实例:
Method m = ...
// 获取所有参数的Annotation:
Annotation[][] annos = m.getParameterAnnotations();
// 第一个参数（索引为0）的所有Annotation:
Annotation[] annosOfName = annos[0];
for (Annotation anno : annosOfName) {
    if (anno instanceof Range r) { // @Range注解
        r.max();
    }
    if (anno instanceof NotNull n) { // @NotNull注解
        //
    }
}
```

### 3.2 使用注解
注解如何使用，完全由程序自己决定:

首先定义一个@Range注解，我们希望用它来定义一个String字段的规则：字段长度满足@Range的参数定义:

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Range {
    int min() default 0;
    int max() default 255;
}
```

在某个JavaBean中，我们可以使用该注解：

```java
public class Person {
    @Range(min=1, max=20)
    public String name;

    @Range(max=10)
    public String city;
}
```

最后编写代码使用注解，对 Persion 示例进行检查:

```java
void check(Person person) throws IllegalArgumentException, ReflectiveOperationException {
    // 遍历所有Field:
    for (Field field : person.getClass().getFields()) {
        // 获取Field定义的@Range:
        Range range = field.getAnnotation(Range.class);
        // 如果@Range存在:
        if (range != null) {
            // 获取Field的值:
            Object value = field.get(person);
            // 如果值是String:
            if (value instanceof String s) {
                // 判断值是否满足@Range的min/max:
                if (s.length() < range.min() || s.length() > range.max()) {
                    throw new IllegalArgumentException("Invalid field: " + field.getName());
                }
            }
        }
    }
}
```