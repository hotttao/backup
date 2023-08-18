---
weight: 1
title: "Java 日志"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 日志"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Properties
### 1.1 Properties 定义
Java默认配置文件以.properties为扩展名，每行以key=value表示，以#课开头的是注释。`Properties` 类继承自 `Hashtable<Object, Object>`，因此它实际上是一个哈希表，用于存储属性的键和值。属性文件的格式是文本文件，可以通过 `Properties` 类进行加载、读取、写入和保存。它的设计实际上是有问题的，但是为了保持兼容性，现在已经没法修改了。除了getProperty()和setProperty()方法外，还有从Hashtable继承下来的get()和put()方法，这些方法的参数签名是Object，我们在使用Properties的时候，不要去调用这些从Hashtable继承下来的方法。


以下是 `Properties` 类的部分方法：

| 方法名                              | 功能描述                                                             |
|-------------------------------------|----------------------------------------------------------------------|
| `void load(InputStream inStream)`    | 从输入流加载属性文件。                                               |
| `void load(Reader reader)`           | 从字符读取器加载属性文件。                                           |
| `void store(OutputStream out, String comments)` | 将属性保存到输出流，附带注释。                              |
| `void store(Writer writer, String comments)`     | 将属性保存到字符写入器，附带注释。                          |
| `String getProperty(String key)`     | 根据键获取属性值。                                                   |
| `String getProperty(String key, String defaultValue)` | 根据键获取属性值，如果不存在则返回默认值。     |
| `void setProperty(String key, String value)` | 设置属性值，如果键已存在则更新其值。                           |
| `Enumeration<?> propertyNames()`      | 获取所有属性名的枚举。                                               |
| `Set<String> stringPropertyNames()`  | 获取所有属性名的字符串集合。                                         |
| `void remove(Object key)`            | 根据键删除属性。                                                     |


下面是 Properties 的使用示例:

```java
// 从文件读取 properties
String f = "setting.properties";
Properties props = new Properties();
props.load(new java.io.FileInputStream(f));

String filepath = props.getProperty("last_open_file");
String interval = props.getProperty("auto_save_interval", "120");

Properties props = new Properties();
props.load(new FileReader("settings.properties", StandardCharsets.UTF_8));

// 从classpath读取.properties文件
Properties props = new Properties();
props.load(getClass().getResourceAsStream("/common/setting.properties")); 

// 有多个.properties文件，可以反复调用load()读取，后读取的key-value会覆盖已读取的key-value
// 可以把默认配置文件放到classpath中，然后，根据机器的环境编写另一个配置文件，覆盖某些默认的配置。
Properties props = new Properties();
props.load(getClass().getResourceAsStream("/common/setting.properties"));
props.load(new FileInputStream("C:\\conf\\setting.properties"));

// 写入配置
Properties props = new Properties();
props.setProperty("url", "http://www.liaoxuefeng.com");
props.setProperty("language", "Java");
props.store(new FileOutputStream("C:\\conf\\setting.properties"), "这是写入的properties注释");
```

## 2. Commons Logging
Commons Logging的特色是，它可以挂接不同的日志系统，并通过配置文件指定挂接的日志系统。默认情况下，Commons Loggin自动搜索并使用Log4j，如果没有找到Log4j，再使用JDK Logging。

### 2.1 使用
使用Commons Logging 分为两步：
1. 第一步，通过LogFactory获取Log类的实例
2. 第二步，使用Log实例的方法打日志

```java
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

public class Main {
    public static void main(String[] args) {
        Log log = LogFactory.getLog(Main.class);
        log.info("start...");
        log.warn("end.");
    }
}

// 在静态方法中引用Log，通常直接定义一个静态类型变量
public class Main {
    static final Log log = LogFactory.getLog(Main.class);

    static void foo() {
        log.info("foo");
    }
}

// 在实例方法中引用Log，通常定义一个实例变量：
public class Person {
    // getClass() 的好处是子类可以直接使用该log实例
    protected final Log log = LogFactory.getLog(getClass());

    void foo() {
        log.info("foo");
    }
}

// 记录异常
try {
    ...
} catch (Exception e) {
    log.error("got exception!", e);
}
```

## 3. Log4j
Log4j是一个组件化设计的日志系统，它的架构大致如下：

```shell
log.info("User signed in.");
 │
 │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 ├──>│ Appender │───>│  Filter  │───>│  Layout  │───>│ Console  │
 │   └──────────┘    └──────────┘    └──────────┘    └──────────┘
 │
 │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 ├──>│ Appender │───>│  Filter  │───>│  Layout  │───>│   File   │
 │   └──────────┘    └──────────┘    └──────────┘    └──────────┘
 │
 │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 └──>│ Appender │───>│  Filter  │───>│  Layout  │───>│  Socket  │
     └──────────┘    └──────────┘    └──────────┘    └──────────┘
```
Log4j可以通过不同的Appender把同一条日志输出到不同的目的地。例如：
1. console：输出到屏幕；
2. file：输出到文件；
3. socket：通过网络输出到远程计算机；
4. jdbc：输出到数据库

### 3.1 Log4j 配置
以XML配置为例，使用Log4j的时候，我们把一个log4j2.xml的文件放到classpath下就可以让Log4j读取配置文件并按照我们的配置来输出日志。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration>
	<Properties>
        <!-- 定义日志格式 -->
		<Property name="log.pattern">%d{MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36}%n%msg%n%n</Property>
        <!-- 定义文件名变量 -->
		<Property name="file.err.filename">log/err.log</Property>
		<Property name="file.err.pattern">log/err.%i.log.gz</Property>
	</Properties>
    <!-- 定义Appender，即目的地 -->
	<Appenders>
        <!-- 定义输出到屏幕 -->
		<Console name="console" target="SYSTEM_OUT">
            <!-- 日志格式引用上面定义的log.pattern -->
			<PatternLayout pattern="${log.pattern}" />
		</Console>
        <!-- 定义输出到文件,文件名引用上面定义的file.err.filename -->
		<RollingFile name="err" bufferedIO="true" fileName="${file.err.filename}" filePattern="${file.err.pattern}">
			<PatternLayout pattern="${log.pattern}" />
			<Policies>
                <!-- 根据文件大小自动切割日志 -->
				<SizeBasedTriggeringPolicy size="1 MB" />
			</Policies>
            <!-- 保留最近10份 -->
			<DefaultRolloverStrategy max="10" />
		</RollingFile>
	</Appenders>
	<Loggers>
		<Root level="info">
            <!-- 对info级别的日志，输出到console -->
			<AppenderRef ref="console" level="info" />
            <!-- 对error级别的日志，输出到err，即上面定义的RollingFile -->
			<AppenderRef ref="err" level="error" />
		</Root>
	</Loggers>
</Configuration>
```

### 4. SLF4J和Logback
SLF4J和Logback 是 Commons Logging + Log4j 的替代品:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class Main {
    final Logger logger = LoggerFactory.getLogger(getClass());
}
```
