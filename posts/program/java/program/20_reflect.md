---
weight: 1
title: "Java 反射"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 反射"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Class 
class是由JVM在执行过程中动态加载的。JVM在第一次读取到一种class类型时，将其加载进内存。每加载一种class，JVM就为其创建一个Class类型的实例，并关联起来。Class 实例会保存其关联 class 的所有信息。

Class 的定义如下:

```java
public final class Class {
    private Class() {}
}

// 加载 String 时，JVM 会创建如下的 Class 并关联到 String 
Class cls = new Class(String);
```

### 1.1 Class 实例获取
获取一个 class 的 Class 实例有三个方法：

```java
// 方法一：直接通过一个class的静态变量class获取：
Class cls = String.class;

// 方法二：如果我们有一个实例变量，可以通过该实例变量提供的getClass()方法获取：
String s = "Hello";
Class cls = s.getClass();

// 方法三：如果知道一个class的完整类名，可以通过静态方法Class.forName()获取：
Class cls = Class.forName("java.lang.String");


// 通过反射获取 Object 的 class 信息
void printObjectInfo(Object obj) {
    Class cls = obj.getClass();
}

// 通过 Class 实例来创建对应类型的实例
// 获取String的Class实例:
Class cls = String.class;
// 创建一个String实例:
String s = (String) cls.newInstance();
```

通过Class.newInstance()可以创建类实例，它的局限是：只能调用public的无参数构造方法。带参数的构造方法，或者非public的构造方法都无法通过Class.newInstance()被调用。

### 1.2 动态加载
JVM在执行Java程序的时候，并不是一次性把所有用到的class全部加载到内存，而是第一次需要用到class时才加载。利用JVM动态加载class的特性，我们才能在运行期根据条件加载不同的实现类。例如，Commons Logging总是优先使用Log4j，只有当Log4j不存在时，才使用JDK的logging。利用JVM动态加载特性，大致的实现代码如下：

```java
// Commons Logging优先使用Log4j:
LogFactory factory = null;
if (isClassPresent("org.apache.logging.log4j.Logger")) {
    factory = createLog4j();
} else {
    factory = createJdkLog();
}

boolean isClassPresent(String name) {
    try {
        Class.forName(name);
        return true;
    } catch (Exception e) {
        return false;
    }
}
```

这就是为什么我们只需要把Log4j的jar包放到classpath中，Commons Logging就会自动使用Log4j的原因。

### 1.3 反射 API 

下表展示了Java反射API的常用类和接口以及它们的功能：

| 类/接口                   | 功能                                            | 使用示例                                                                                      |
|------------------------|-------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `java.lang.Class`      | 表示一个类或接口，提供访问类的信息和操作类的方法                | `Class<?> clazz = MyClass.class;`<br>`String className = clazz.getName();`                    |
| `java.lang.reflect.Field`   | 表示类的字段（成员变量），提供访问和修改字段的值              | `Field field = clazz.getDeclaredField("fieldName");`<br>`field.setAccessible(true);`            |
| `java.lang.reflect.Method`  | 表示类的方法，提供调用方法的功能                          | `Method method = clazz.getDeclaredMethod("methodName");`<br>`method.invoke(instance);`         |
| `java.lang.reflect.Constructor` | 表示类的构造函数，提供创建类的实例的能力                    | `Constructor<?> constructor = clazz.getDeclaredConstructor(parameterTypes);`<br>`Object instance = constructor.newInstance(args);` |
| `java.lang.reflect.Modifier`   | 包含用于处理访问修饰符的方法                           | `int modifiers = field.getModifiers();`<br>`boolean isPublic = Modifier.isPublic(modifiers);` |
| `java.lang.reflect.Array`   | 提供对数组对象的动态操作和创建数组实例的能力                 | `Object array = Array.newInstance(componentType, length);`<br>`Array.set(array, index, value);` |
| `java.lang.reflect.Parameter` | 表示方法或构造函数的参数，提供访问参数的名称和修饰符             | `Parameter[] parameters = method.getParameters();`<br>`String parameterName = parameters[0].getName();` |
| `java.lang.reflect.Executable` | 表示可执行的成员，如方法或构造函数，提供访问修饰符和注解的功能    | `Executable executable = clazz.getDeclaredConstructor(parameterTypes);`<br>`Annotation[] annotations = executable.getAnnotations();` |
| `java.lang.reflect.AnnotatedElement` | 表示具有注解的元素，如类、字段、方法等，提供访问注解的能力  | `Annotation[] annotations = clazz.getAnnotations();`<br>`Annotation annotation = field.getAnnotation(MyAnnotation.class);` |
| `java.lang.reflect.InvocationHandler` | 用于实现动态代理的接口，处理代理对象的方法调用            | `InvocationHandler handler = new MyInvocationHandler();`<br>`MyInterface proxy = (MyInterface) Proxy.newProxyInstance(classLoader, interfaces, handler);` |

这些只是Java反射API的一小部分，还有许多其他的类和接口可供使用。在实际应用中，您可以根据需要选择适当的API来实现具体的反射操作。

以下是Java反射API的使用示例：

1. 使用`java.lang.Class`获取类的信息和操作类的方法：

```java
Class<?> clazz = MyClass.class;
String className = clazz.getName();
int modifiers = clazz.getModifiers();
Package package = clazz.getPackage();
Class<?> superClass = clazz.getSuperclass();
Class<?>[] interfaces = clazz.getInterfaces();

Class<?> class1 = String.class;
Class<?> class2 = Object.class;
Class<?> class3 = Integer.class;

boolean isAssignable1 = class1.isAssignableFrom(class2);  // true，因为String是Object的子类
boolean isAssignable2 = class2.isAssignableFrom(class1);  // false，因为Object不是String的子类
boolean isAssignable3 = class1.isAssignableFrom(class3);  // false，因为String不是Integer的子类
```

2. 使用`java.lang.reflect.Field`访问和修改类的字段：

```java
Field field = clazz.getDeclaredField("fieldName");
field.setAccessible(true);
Object instance = clazz.newInstance();
Object value = field.get(instance);
field.set(instance, newValue);
```

3. 使用`java.lang.reflect.Method`调用类的方法：

```java
Method method = clazz.getDeclaredMethod("methodName", parameterTypes);
method.setAccessible(true);
Object instance = clazz.newInstance();
Object result = method.invoke(instance, args);
```

setAccessible(true)可能会失败。如果JVM运行期存在SecurityManager，那么它会根据规则进行检查，有可能阻止setAccessible(true)。例如，某个SecurityManager可能不允许对java和javax开头的package的类调用setAccessible(true)，这样可以保证JVM核心库的安全。

4. 使用`java.lang.reflect.Constructor`创建类的实例：

```java
Constructor<?> constructor = clazz.getDeclaredConstructor(parameterTypes);
constructor.setAccessible(true);
Object instance = constructor.newInstance(args);
```

5. 使用`java.lang.reflect.Modifier`处理访问修饰符：

```java
int modifiers = field.getModifiers();
boolean isPublic = Modifier.isPublic(modifiers);
boolean isStatic = Modifier.isStatic(modifiers);
boolean isFinal = Modifier.isFinal(modifiers);
```

6. 使用`java.lang.reflect.Array`操作数组对象：

```java
Object array = Array.newInstance(componentType, length);
Array.set(array, index, value);
Object element = Array.get(array, index);
int arrayLength = Array.getLength(array);
```

7. 使用`java.lang.reflect.Parameter`访问方法或构造函数的参数：

```java
Parameter[] parameters = method.getParameters();
String parameterName = parameters[0].getName();
```

8. 使用`java.lang.reflect.Executable`访问可执行成员的修饰符和注解：

```java
Executable executable = clazz.getDeclaredConstructor(parameterTypes);
int modifiers = executable.getModifiers();
Annotation[] annotations = executable.getAnnotations();
```

9. 使用`java.lang.reflect.AnnotatedElement`访问具有注解的元素：

```java
Annotation[] annotations = clazz.getAnnotations();
Annotation annotation = field.getAnnotation(MyAnnotation.class);
```

10. 使用`java.lang.reflect.InvocationHandler`实现动态代理：


```java
InvocationHandler handler = new MyInvocationHandler();
MyInterface proxy = (MyInterface) Proxy.newProxyInstance(classLoader, interfaces, handler);

// 更具体的示例如下:
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

public class Main {
    public static void main(String[] args) {
        InvocationHandler handler = new InvocationHandler() {
            @Override
            public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                System.out.println(method);
                if (method.getName().equals("morning")) {
                    System.out.println("Good morning, " + args[0]);
                }
                return null;
            }
        };
        Hello hello = (Hello) Proxy.newProxyInstance(
            Hello.class.getClassLoader(), // 传入ClassLoader
            new Class[] { Hello.class }, // 传入要实现的接口
            handler); // 传入处理调用方法的InvocationHandler
        hello.morning("Bob");
    }
}

interface Hello {
    void morning(String name);
}

// 动态代理实际上是JVM在运行期动态创建class字节码并加载的过程，它并没有什么黑魔法
// 把上面的动态代理改写为静态实现类大概长这样：

public class HelloDynamicProxy implements Hello {
    InvocationHandler handler;
    public HelloDynamicProxy(InvocationHandler handler) {
        this.handler = handler;
    }
    public void morning(String name) {
        handler.invoke(
           this,
           Hello.class.getMethod("morning", String.class),
           new Object[] { name });
    }
}
```

在运行期动态创建一个interface实例的方法如下：
1. 定义一个InvocationHandler实例，它负责实现接口的方法调用；
2. 通过Proxy.newProxyInstance()创建interface实例，它需要3个参数：
    - 使用的ClassLoader，通常就是接口类的ClassLoader；
    - 需要实现的接口数组，至少需要传入一个接口进去；
    - 用来处理接口方法调用的InvocationHandler实例。
3. 将返回的Object强制转型为接口。



使用反射调用方法时，仍然遵循多态原则：即总是调用实际类型的覆写方法（如果存在）:

```java

Method m = Person.class.getMethod("hello");
m.invoke(new Student());

// 上面代码等同于：
Person p = new Student();
p.hello();
```

