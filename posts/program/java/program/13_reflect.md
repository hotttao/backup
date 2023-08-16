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

所谓反射就会解决对象自省，即如何在运行时获得对象的所有信息。通常语言层面会维护所有类型的元数据信息，正是借助这个元数据信息，语言可以提供反射API。

## 1. Class 
class是由JVM在执行过程中动态加载的。JVM在第一次读取到一种class类型时，将其加载进内存。每加载一种class(包括 interface)，JVM就为其创建一个Class类型的实例，并关联起来。Class 实例会保存其关联 class 的所有信息。

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

### 2. 反射 API 

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


以下是Java反射API的使用示例：

### 2.1 `java.lang.Class`

| 方法签名                                     | 描述                                          |
|-------------------------------------------|---------------------------------------------|
| `String getName()`                        | 获取类的全限定名称。                            |
| `String getSimpleName()`                   | 获取类的简单名称。                              |
| `ClassLoader getClassLoader()`              | 获取加载类的类加载器。                          |
| `Class<?> getSuperclass()`                  | 获取类的父类。                                 |
| `Class<?>[] getInterfaces()`                | 获取类实现的接口数组。只返回当前类直接实现的接口类型，并不包括其父类实现的接口类型|
| `boolean isInterface()`                    | 检查是否是接口。                               |
| `int getModifiers()`                       | 获取类的修饰符。                               |
| `Annotation[] getAnnotations()`            | 获取类的注解数组（包括继承和非继承注解）。        |
| `Annotation[] getDeclaredAnnotations()`    | 获取类的直接声明的注解数组。                   |
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查类是否具有指定类型的注解。   |
| `boolean isArray()`                        | 检查是否是数组类型。                            |
| `boolean isPrimitive()`                    | 检查是否是基本数据类型。                         |
| `boolean isEnum()`                         | 检查是否是枚举类型。                            |
| `boolean isAnonymousClass()`               | 检查是否是匿名类。                             |
| `boolean isLocalClass()`                   | 检查是否是局部类。                             |
| `boolean isMemberClass()`                  | 检查是否是成员类（非静态内部类）。               |
| `boolean isSynthetic()`                    | 检查是否是合成类（由编译器生成）。                 |
| `T[] getEnumConstants()`                   | 获取枚举类型的常量数组。                         |
| `Field[] getFields()`                      | 获取类的公共字段数组。                          |
| `Field[] getDeclaredFields()`              | 获取类的直接声明的字段数组。                    |
| `Method[] getMethods()`                    | 获取类的公共方法数组。                          |
| `Method[] getDeclaredMethods()`            | 获取类的直接声明的方法数组。                    |
| `Constructor<?>[] getConstructors()`       | 获取类的公共构造函数数组。                       |
| `Constructor<?>[] getDeclaredConstructors()` | 获取类的直接声明的构造函数数组。                 |
| `Class<?> getComponentType()`               | 获取数组的组件类型。                            |


使用`java.lang.Class`获取类的信息和操作类的方法：

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

// 如果是两个Class实例，要判断一个向上转型是否成立，可以调用isAssignableFrom()
boolean isAssignable1 = class1.isAssignableFrom(class2);  // true，因为String是Object的子类
boolean isAssignable2 = class2.isAssignableFrom(class1);  // false，因为Object不是String的子类
boolean isAssignable3 = class1.isAssignableFrom(class3);  // false，因为String不是Integer的子类
```

对所有interface的Class调用getSuperclass()返回的是null，获取接口的父接口要用getInterfaces()：

```java
System.out.println(java.io.DataInputStream.class.getSuperclass()); // java.io.FilterInputStream，因为DataInputStream继承自FilterInputStream
System.out.println(java.io.Closeable.class.getSuperclass()); // null，对接口调用getSuperclass()总是返回null，获取接口的父接口要用getInterfaces()
```

### 2.2 `java.lang.reflect.Field`
Class类提供了以下几个方法来获取字段：
1. `Field getField(name)`：根据字段名获取某个public的field（包括父类）
2. `Field getDeclaredField(name)`：根据字段名获取当前类的某个field（不包括父类）
3. `Field[] getFields()`：获取所有public的field（包括父类）
4. `Field[] getDeclaredFields()`：获取当前类的所有field（不包括父类）

一个Field对象包含了一个字段的所有信息：

| 方法签名                               | 描述                                           |
|-------------------------------------|----------------------------------------------|
| `String getName()`                  | 获取字段的名称。                                |
| `Class<?> getType()`                | 获取字段的类型（`Class` 对象）。                 |
| `int getModifiers()`                | 获取字段的修饰符。                              |
| `Object get(Object obj)`            | 获取指定对象中的字段值。                        |
| `void set(Object obj, Object value)`| 设置指定对象中的字段值。                        |
| `Annotation[] getAnnotations()`     | 获取字段的注解数组（包括继承和非继承注解）。        |
| `Annotation[] getDeclaredAnnotations()` | 获取字段的直接声明的注解数组。                  |
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查字段是否具有指定类型的注解。  |
| `Type getGenericType()`             | 获取字段的泛型类型。                            |
| `boolean isEnumConstant()`          | 检查字段是否是枚举常量。                        |
| `boolean isSynthetic()`             | 检查字段是否是合成字段（由编译器生成）。          |
| `boolean isAccessible()`            | 检查字段是否可访问。                            |
| `void setAccessible(boolean flag)`  | 设置字段的访问标志。                            |


使用`java.lang.reflect.Field`访问和修改类的字段：

```java
// 获取字段的信息
Field f = String.class.getDeclaredField("value");
f.getName(); // "value"
f.getType(); // class [B 表示byte[]类型
int m = f.getModifiers();
Modifier.isFinal(m); // true
Modifier.isPublic(m); // false
Modifier.isProtected(m); // false
Modifier.isPrivate(m); // true
Modifier.isStatic(m); // false

// 访问和修改字段的值
Field field = clazz.getDeclaredField("fieldName");
field.setAccessible(true);
Object instance = clazz.newInstance();
Object value = field.get(instance);
field.set(instance, newValue);
```

### 2.3 `java.lang.reflect.Method`
Class类提供了以下几个方法来获取Method：
1. `Method getMethod(name, Class...)`：获取某个public的Method（包括父类）
2. `Method getDeclaredMethod(name, Class...)`：获取当前类的某个Method（不包括父类）
3. `Method[] getMethods()`：获取所有public的Method（包括父类）
4. `Method[] getDeclaredMethods()`：获取当前类的所有Method（不包括父类）

一个Method对象包含一个方法的所有信息：

| 方法签名                                          | 描述                                           |
|------------------------------------------------|----------------------------------------------|
| `String getName()`                             | 获取方法的名称。                                |
| `Class<?> getReturnType()`                     | 获取方法的返回类型（`Class` 对象）。             |
| `int getModifiers()`                          | 获取方法的修饰符。                              |
| `Class<?>[] getParameterTypes()`               | 获取方法的参数类型列表（`Class` 对象数组）。     |
| `Class<?>[] getExceptionTypes()`               | 获取方法可能抛出的异常类型列表（`Class` 对象数组）。 |
| `Object invoke(Object obj, Object... args)`   | 调用方法，传递对象和参数，返回结果。            |
| `Annotation[] getAnnotations()`                | 获取方法的注解数组（包括继承和非继承注解）。        |
| `Annotation[] getDeclaredAnnotations()`        | 获取方法的直接声明的注解数组。                  |
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查方法是否具有指定类型的注解。  |
| `TypeVariable<Method>[] getTypeParameters()`   | 获取方法的类型参数（泛型参数）。                |
| `boolean isVarArgs()`                         | 检查方法是否是可变参数方法。                    |
| `boolean isSynthetic()`                       | 检查方法是否是合成方法（由编译器生成）。          |
| `boolean isBridge()`                          | 检查方法是否是桥方法（由编译器生成的泛型方法）。   |

使用 `java.lang.reflect.Method` 调用类的方法：

```java
Method method = clazz.getDeclaredMethod("methodName", parameterTypes);
method.setAccessible(true);
Object instance = clazz.newInstance();
Object result = method.invoke(instance, args);


import java.lang.reflect.Method;
public class Main {
    public static void main(String[] args) throws Exception {
        // String对象:
        String s = "Hello world";
        // 获取String substring(int)方法，参数为int:
        Method m = String.class.getMethod("substring", int.class);
        // 在s对象上调用该方法并获取结果:
        String r = (String) m.invoke(s, 6);
        // 打印调用结果:
        System.out.println(r);
    }
}
```

setAccessible(true)可能会失败。如果JVM运行期存在SecurityManager，那么它会根据规则进行检查，有可能阻止setAccessible(true)。例如，某个SecurityManager可能不允许对java和javax开头的package的类调用setAccessible(true)，这样可以保证JVM核心库的安全。

### 2.4 `java.lang.reflect.Constructor`
如果通过反射来创建新的实例，可以调用Class提供的newInstance()方法：`Person p = Person.class.newInstance();`。调用Class.newInstance()的局限是，它只能调用该类的public无参数构造方法。如果构造方法带有参数，或者不是public，就无法直接通过Class.newInstance()来调用。为了调用任意的构造方法，Java的反射API提供了Constructor对象。

通过Class实例获取Constructor的方法如下：
1. `getConstructor(Class...)`：获取某个public的Constructor；
1. `getDeclaredConstructor(Class...)`：获取某个Constructor；
1. `getConstructors()`：获取所有public的Constructor；
1. `getDeclaredConstructors()`：获取所有Constructor。

一个 Constructor 对象包含一个构造方法的所有信息：

| 方法签名                                        | 描述                                        |
|----------------------------------------------|-------------------------------------------|
| `Class<?> getDeclaringClass()`               | 获取声明该构造函数的类。                      |
| `int getModifiers()`                         | 获取构造函数的修饰符。                      |
| `Class<?>[] getParameterTypes()`              | 获取构造函数的参数类型列表（`Class` 对象数组）。 |
| `Annotation[] getAnnotations()`              | 获取构造函数的注解数组（包括继承和非继承注解）。    |
| `Annotation[] getDeclaredAnnotations()`      | 获取构造函数的直接声明的注解数组。              |
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查构造函数是否具有指定类型的注解。  |
| `TypeVariable<Constructor<T>>[] getTypeParameters()` | 获取构造函数的类型参数（泛型参数）。 |
| `Class<?>[] getExceptionTypes()`             | 获取构造函数可能抛出的异常类型列表（`Class` 对象数组）。 |
| `boolean isSynthetic()`                      | 检查构造函数是否是合成构造函数（由编译器生成）。    |
| `boolean isVarArgs()`                        | 检查构造函数是否是可变参数构造函数。             |
| `boolean isAccessible()`                     | 检查构造函数是否可访问。                      |
| `void setAccessible(boolean flag)`           | 设置构造函数的访问标志。                      |

使用`java.lang.reflect.Constructor`创建类的实例：

```java
Constructor<?> constructor = clazz.getDeclaredConstructor(parameterTypes);
constructor.setAccessible(true);
Object instance = constructor.newInstance(args);
```

### 2.5 `java.lang.reflect.Modifier`

`java.lang.reflect.Modifier` 包含类、属性、方法的修饰符信息:

| 方法签名                                       | 描述                                           |
|---------------------------------------------|----------------------------------------------|
| `static boolean isAbstract(int modifiers)`  | 检查修饰符是否表示抽象。                     |
| `static boolean isFinal(int modifiers)`     | 检查修饰符是否表示 final。                   |
| `static boolean isInterface(int modifiers)` | 检查修饰符是否表示接口。                     |
| `static boolean isNative(int modifiers)`    | 检查修饰符是否表示 native。                  |
| `static boolean isPrivate(int modifiers)`   | 检查修饰符是否表示 private。                 |
| `static boolean isProtected(int modifiers)` | 检查修饰符是否表示 protected。               |
| `static boolean isPublic(int modifiers)`    | 检查修饰符是否表示 public。                  |
| `static boolean isStatic(int modifiers)`    | 检查修饰符是否表示 static。                  |
| `static boolean isStrict(int modifiers)`    | 检查修饰符是否表示 strictfp。                |
| `static boolean isSynchronized(int modifiers)` | 检查修饰符是否表示 synchronized。          |
| `static boolean isTransient(int modifiers)` | 检查修饰符是否表示 transient。               |
| `static boolean isVolatile(int modifiers)`  | 检查修饰符是否表示 volatile。                |
| `static String toString(int modifiers)`     | 将修饰符转换为字符串。                       |

使用`java.lang.reflect.Modifier`处理访问修饰符：

```java
int modifiers = field.getModifiers();
boolean isPublic = Modifier.isPublic(modifiers);
boolean isStatic = Modifier.isStatic(modifiers);
boolean isFinal = Modifier.isFinal(modifiers);
```

### 2.6 `java.lang.reflect.Array`
`java.lang.reflect.Array` 包含了操作数组的方法: 

| 方法签名                                         | 描述                                               |
|-----------------------------------------------|--------------------------------------------------|
| `static Object newInstance(Class<?> componentType, int length)` | 创建一个新的数组实例。                       |
| `static Object newInstance(Class<?> componentType, int... dimensions)` | 创建一个多维数组实例。                 |
| `static int getLength(Object array)`             | 获取数组的长度。                               |
| `static Object get(Object array, int index)`     | 获取数组指定索引位置的元素。                     |
| `static boolean getBoolean(Object array, int index)` | 获取数组指定索引位置的 boolean 元素。       |
| `static byte getByte(Object array, int index)`    | 获取数组指定索引位置的 byte 元素。          |
| `static char getChar(Object array, int index)`    | 获取数组指定索引位置的 char 元素。          |
| `static short getShort(Object array, int index)`  | 获取数组指定索引位置的 short 元素。         |
| `static int getInt(Object array, int index)`      | 获取数组指定索引位置的 int 元素。           |
| `static long getLong(Object array, int index)`    | 获取数组指定索引位置的 long 元素。          |
| `static float getFloat(Object array, int index)`  | 获取数组指定索引位置的 float 元素。         |
| `static double getDouble(Object array, int index)` | 获取数组指定索引位置的 double 元素。        |
| `static void set(Object array, int index, Object value)` | 设置数组指定索引位置的元素。               |
| `static void setBoolean(Object array, int index, boolean value)` | 设置数组指定索引位置的 boolean 元素。  |
| `static void setByte(Object array, int index, byte value)`    | 设置数组指定索引位置的 byte 元素。     |
| `static void setChar(Object array, int index, char value)`    | 设置数组指定索引位置的 char 元素。     |
| `static void setShort(Object array, int index, short value)`  | 设置数组指定索引位置的 short 元素。   |
| `static void setInt(Object array, int index, int value)`      | 设置数组指定索引位置的 int 元素。     |
| `static void setLong(Object array, int index, long value)`    | 设置数组指定索引位置的 long 元素。   |
| `static void setFloat(Object array, int index, float value)`  | 设置数组指定索引位置的 float 元素。 |
| `static void setDouble(Object array, int index, double value)` | 设置数组指定索引位置的 double 元素。|

使用`java.lang.reflect.Array`操作数组对象：

```java
Object array = Array.newInstance(componentType, length);
Array.set(array, index, value);
Object element = Array.get(array, index);
int arrayLength = Array.getLength(array);
```

### 2.7 `java.lang.reflect.Parameter`
`java.lang.reflect.Parameter` 可以获取函数和方法的参数信息:


| 方法签名                                    | 描述                                       |
|------------------------------------------|------------------------------------------|
| `boolean isNamePresent()`                 | 检查参数是否有名称。                       |
| `String getName()`                       | 获取参数的名称。                          |
| `int getModifiers()`                     | 获取参数的修饰符。                        |
| `Class<?> getType()`                     | 获取参数的类型（`Class` 对象）。             |
| `Type getParameterizedType()`             | 获取参数的参数化类型。                    |
| `AnnotatedType getAnnotatedType()`       | 获取参数的注解类型。                      |
| `boolean isImplicit()`                   | 检查参数是否是隐式的（由编译器生成的）。       |
| `boolean isSynthetic()`                  | 检查参数是否是合成的（由编译器生成的）。       |
| `boolean isVarArgs()`                    | 检查参数是否是可变参数。                   |
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查参数是否具有指定类型的注解。  |
| `Annotation[] getAnnotations()`          | 获取参数的注解数组（包括继承和非继承注解）。     |
| `Annotation[] getDeclaredAnnotations()`  | 获取参数的直接声明的注解数组。               |

使用`java.lang.reflect.Parameter`访问方法或构造函数的参数：

```java
Parameter[] parameters = method.getParameters();
String parameterName = parameters[0].getName();
```

### 2.8 `java.lang.reflect.Executable`
java.lang.reflect.Executable 是 Java 反射 API 中的一个抽象类，用于表示可执行成员，例如方法和构造函数。它是 java.lang.reflect.Method 和 java.lang.reflect.Constructor 类的父类，提供了一些用于操作和获取可执行成员信息的共享方法。由于方法和构造函数在很多方面都有相似的属性和操作，因此 Java 设计了 Executable 抽象类，将它们共有的方法抽象出来，使得可以在一些通用的情况下更方便地操作这些成员。例如，Executable 类提供了获取方法或构造函数的参数类型、异常类型、修饰符等信息的方法。

使用`java.lang.reflect.Executable`访问可执行成员的修饰符和注解：

```java
Executable executable = clazz.getDeclaredConstructor(parameterTypes);
int modifiers = executable.getModifiers();
Annotation[] annotations = executable.getAnnotations();
```

### 2.9 `java.lang.reflect.AnnotatedElement`
`java.lang.reflect.AnnotatedElement` 可以获取注解的信息:

| 方法签名                                           | 描述                                             |
|-------------------------------------------------|------------------------------------------------|
| `boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)` | 检查元素是否具有指定类型的注解。      |
| `<T extends Annotation> T getAnnotation(Class<T> annotationClass)` | 获取元素指定类型的注解。                 |
| `Annotation[] getAnnotations()`                 | 获取元素的注解数组（包括继承和非继承注解）。     |
| `Annotation[] getDeclaredAnnotations()`         | 获取元素的直接声明的注解数组。               |

使用`java.lang.reflect.AnnotatedElement`访问具有注解的元素：

```java
Annotation[] annotations = clazz.getAnnotations();
Annotation annotation = field.getAnnotation(MyAnnotation.class);
```

### 2.10 `java.lang.reflect.InvocationHandler`

Java标准库提供了一种动态代理（Dynamic Proxy）的机制：可以在运行期动态创建某个interface的实例。

```java
InvocationHandler handler = new MyInvocationHandler();
MyInterface proxy = (MyInterface) Proxy.newProxyInstance(classLoader, interfaces, handler);

// 更具体的示例如下:
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

interface Hello {
    void morning(String name);
}

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

动态代理是通过Proxy创建代理对象，然后将接口方法“代理”给InvocationHandler完成的。在运行期动态创建一个interface实例的方法如下：
1. 定义一个InvocationHandler实例，它负责实现接口的方法调用；
2. 通过Proxy.newProxyInstance()创建interface实例，它需要3个参数：
    - 使用的ClassLoader，通常就是接口类的ClassLoader；
    - 需要实现的接口数组，至少需要传入一个接口进去；
    - 用来处理接口方法调用的InvocationHandler实例。
3. 将返回的Object强制转型为接口。


## 2. 动态加载
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