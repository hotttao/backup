
## 2. 异常
Java的异常是class，它的继承关系如下：
```bash

                     ┌───────────┐
                     │  Object   │
                     └───────────┘
                           ▲
                           │
                     ┌───────────┐
                     │ Throwable │
                     └───────────┘
                           ▲
                 ┌─────────┴─────────┐
                 │                   │
           ┌───────────┐       ┌───────────┐
           │   Error   │       │ Exception │
           └───────────┘       └───────────┘
                 ▲                   ▲
         ┌───────┘              ┌────┴──────────┐
         │                      │               │
┌─────────────────┐    ┌─────────────────┐┌───────────┐
│OutOfMemoryError │... │RuntimeException ││IOException│...
└─────────────────┘    └─────────────────┘└───────────┘
                                ▲
                    ┌───────────┴─────────────┐
                    │                         │
         ┌─────────────────────┐ ┌─────────────────────────┐
         │NullPointerException │ │IllegalArgumentException │...
         └─────────────────────┘ └─────────────────────────┘
```

Throwable是异常体系的根，它继承自Object。Throwable有两个体系：Error和Exception
1. Error表示严重的错误
2. Exception则是运行时的错误

Exception又分为两大类：
1. RuntimeException以及它的子类；
2. 非RuntimeException（包括IOException、ReflectiveOperationException等等）

Java规定：
1. 必须捕获的异常，包括Exception及其子类，但不包括RuntimeException及其子类，这种类型的异常称为Checked Exception。
2. 不需要捕获的异常，包括Error及其子类，RuntimeException及其子类。

### 2.1 编译器强制捕获异常
```java
public byte[] getBytes(String charsetName) throws UnsupportedEncodingException {
    ...
}
```

Java 的方法在定义时，可以通过 throws 关键字表示可能抛出的异常类型。调用方在调用的时候，必须强制捕获这些异常，否则编译器会报错。

调用方也可以通过 throws 相同的异常，类似于将异常向上传递，以绕过编译器的检查，但是最终也必须在 main 函数中捕获异常:

```go
public class Main {
    public static void main(String[] args) {
        try {
            byte[] bs = toGBK("中文");
            System.out.println(Arrays.toString(bs));
        } catch (UnsupportedEncodingException e) {
            System.out.println(e);
        }
    }

    static byte[] toGBK(String s) throws UnsupportedEncodingException {
        // 用指定编码转换String为byte[]:
        return s.getBytes("GBK");
    }
}
```

可见，只要是方法声明的Checked Exception，不在调用层捕获，也必须在更高的调用层捕获。所有未捕获的异常，最终也必须在main()方法中捕获，不会出现漏写try的情况。这是由编译器保证的。main()方法也是最后捕获Exception的机会。

如果不想写任何try代码，可以直接把main()方法定义为throws Exception：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        byte[] bs = toGBK("中文");
        System.out.println(Arrays.toString(bs));
    }

    static byte[] toGBK(String s) throws UnsupportedEncodingException {
        // 用指定编码转换String为byte[]:
        return s.getBytes("GBK");
    }
}
```

### 2.2 异常打印
所有异常都可以调用printStackTrace()方法打印异常栈

```java
static byte[] toGBK(String s) {
    try {
        return s.getBytes("GBK");
    } catch (UnsupportedEncodingException e) {
        // 先记下来再说:
        e.printStackTrace();
    }
    return null;
```

### 2.3 原始异常信息以及异常抑制
下面是一个包含抛出异常、包含原始异常信息以及异常抑制操作的 Java 异常使用示例：

```java
public class ExceptionExample {
    public static void main(String[] args) {
        try {
            processFile("file.txt"); // 调用可能抛出异常的方法
        } catch (CustomException e) {
            System.out.println("捕获到异常：" + e.getMessage());
            Throwable cause = e.getCause();
            if (cause != null) {
                System.out.println("原始异常信息：" + cause.getMessage());
            }
        }
    }

    public static void processFile(String fileName) throws CustomException {
        try {
            readFile(fileName); // 调用可能抛出异常的方法
        } catch (IOException e) {
            CustomException customException = new CustomException("自定义异常");
            customException.initCause(e); // 设置原始异常
            customException.addSuppressed(new RuntimeException("附加的异常")); // 添加抑制的异常
            throw customException;
        }
    }

    public static void readFile(String fileName) throws IOException {
        if (fileName == null || fileName.isEmpty()) {
            throw new IllegalArgumentException("文件名不能为空");
        }

        // 模拟文件读取操作，假设发生了 IO 异常
        throw new IOException("文件读取错误");
    }
}

class CustomException extends Exception {
    public CustomException(String message) {
        super(message);
    }
}
```

在这个示例中，我们展示了以下内容：

- 在 `processFile` 方法中，我们调用了可能抛出 `IOException` 的方法 `readFile`。在 `catch` 块中，我们创建了一个自定义异常 `CustomException`，并使用 `initCause` 方法将原始异常 `IOException` 设置为自定义异常的原因。
- 通过 `getCause()` 方法，我们可以获取自定义异常的原始异常对象，并打印其信息。
- 使用 `addSuppressed` 方法，我们可以将其他异常添加到自定义异常的抑制异常列表中。
- 通过 `getSuppressed` 方法，我们可以获取自定义异常中的所有抑制异常，并进一步处理或打印它们。

这个示例演示了 Java 异常处理中如何包含原始异常信息、使用 `Throwable.getCause()` 方法获取原始异常、使用 `Throwable.addSuppressed()` 添加抑制异常、以及使用 `Throwable.getSuppressed()` 获取抑制异常的操作。

### 2.4 自定义异常

```java
public class BaseException extends RuntimeException {
    public BaseException() {
        super();
    }

    public BaseException(String message, Throwable cause) {
        super(message, cause);
    }

    public BaseException(String message) {
        super(message);
    }

    public BaseException(Throwable cause) {
        super(cause);
    }
}

public class UserNotFoundException extends BaseException {
}

public class LoginFailedException extends BaseException {
}
```

### 2.5 断言
```java
public static void main(String[] args) {
    double x = Math.abs(-123.45);
    assert x >= 0;
    System.out.println(x);
}
```

断言失败时会抛出AssertionError，导致程序结束退出。因此，断言不能用于可恢复的程序错误，只应该用于开发和测试阶段。JVM默认关闭断言指令，即遇到assert语句就自动忽略了，不执行。要执行assert语句，必须给Java虚拟机传递-enableassertions（可简写为-ea）参数启用断言。
1. -ea:com.itranswarp.sample.Main，表示只对com.itranswarp.sample.Main这个类启用断言
2. -ea:com.itranswarp.sample...（注意结尾有3个.），表示对com.itranswarp.sample这个包启动断言
