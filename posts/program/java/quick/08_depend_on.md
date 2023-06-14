---
weight: 1
title: "Java 依赖管理"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 依赖管理"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---
## 5. 依赖管理 Maven

### 5.1 Maven 简介
[Maven 入门](https://www.runoob.com/maven/maven-tutorial.html)

### 5.2 Maven 常用命令
以下是一些常用的Maven命令，以表格形式列出它们的功能：

| 命令                    | 功能                                 |
|------------------------|--------------------------------------|
| `mvn clean`            | 清理项目，删除生成的目录和文件。         |
| `mvn compile`          | 编译项目的源代码。                     |
| `mvn test`             | 运行项目的单元测试。                   |
| `mvn package`          | 打包项目，生成可部署的构建结果。         |
| `mvn install`          | 安装项目构建结果到本地Maven仓库。        |
| `mvn dependency:tree`  | 显示项目的依赖树，包括所有传递依赖。     |
| `mvn clean install`    | 清理项目并重新构建并安装。               |
| `mvn clean package`    | 清理项目并重新构建并打包。               |
| `mvn clean test`       | 清理项目并重新构建并运行单元测试。        |
| `mvn clean compile`    | 清理项目并重新编译。                     |
| `mvn clean deploy`     | 清理项目并部署构建结果到远程仓库。        |
| `mvn clean site`       | 清理项目并生成项目的站点文档。           |


### 5.3 依赖调节
在Java中，您可以使用构建工具（如Maven、Gradle）来调整项目的依赖关系，以满足您的需求。依赖调节（Dependency Management）是通过管理和配置项目的依赖项来解决依赖冲突、版本问题和构建需求的过程。

下面是一些常见的依赖调节技术：

1. 依赖版本管理：您可以在项目的构建文件（如pom.xml或build.gradle）中指定依赖项的版本号，以确保使用特定的依赖版本。这有助于避免不必要的依赖冲突和版本不一致。
2. 依赖范围管理：您可以使用依赖范围（如compile、provided、runtime、test等）来控制依赖项在不同环境下的引入。例如，某些依赖项只在编译时需要，而在运行时不需要。
3. 强制依赖解析：您可以使用构建工具的强制依赖解析功能，确保所有依赖项都被正确解析和引入。这有助于解决依赖冲突和版本不一致的问题。
4. 依赖排除：如前面所提到的，您可以排除某些依赖的特定传递依赖关系，以避免引入不需要的依赖项。
5. 依赖分析工具：使用依赖分析工具可以帮助您识别项目中的依赖关系、版本冲突和潜在的问题。这些工具可以生成依赖关系图、冲突报告等，帮助您进行依赖调节和管理。

#### maven 依赖版本管理
在Maven中，依赖版本管理是通过指定依赖项的版本号来管理项目的依赖关系。通过明确指定依赖的版本，可以确保在构建过程中使用特定的依赖版本，避免依赖冲突和版本不一致的问题。

以下是一些常见的 Maven 依赖版本管理的技术和实践：

1. 显式声明版本：在项目的 pom.xml 文件中，您可以明确指定每个依赖项的版本号，使用 `<version>` 元素进行声明。例如：
   ```xml
   <dependencies>
     <dependency>
       <groupId>com.example</groupId>
       <artifactId>my-library</artifactId>
       <version>1.0.0</version>
     </dependency>
   </dependencies>
   ```

2. 使用属性定义版本：您可以在 pom.xml 文件的 `<properties>` 部分定义属性，并在依赖项中使用这些属性作为版本号。这样可以集中管理依赖版本，方便统一升级或切换版本。例如：
   ```xml
   <properties>
     <my-library.version>1.0.0</my-library.version>
   </properties>

   <dependencies>
     <dependency>
       <groupId>com.example</groupId>
       <artifactId>my-library</artifactId>
       <version>${my-library.version}</version>
     </dependency>
   </dependencies>
   ```

3. 使用依赖管理部分：在 Maven 的父项目中，您可以使用 `<dependencyManagement>` 元素来集中管理子项目的依赖版本。子项目只需指定依赖的坐标（groupId、artifactId），而版本号从父项目继承。这样可以确保子项目使用相同的依赖版本。例如：
   ```xml
   <dependencyManagement>
     <dependencies>
       <dependency>
         <groupId>com.example</groupId>
         <artifactId>my-library</artifactId>
         <version>1.0.0</version>
       </dependency>
     </dependencies>
   </dependencyManagement>
   ```

通过以上的版本管理技术，您可以更加灵活地管理和控制项目的依赖版本，确保项目构建过程的稳定性和一致性。

希望以上信息对您有所帮助。如有任何进一步的问题，请随时提问。

#### Maven 依赖范围管理
Maven通过依赖范围（Dependency Scope）来管理项目的依赖关系。依赖范围指定了在不同阶段如何使用依赖项。以下是Maven中常见的依赖范围及其含义：

| 依赖范围      | 描述                                                         |
|---------------|--------------------------------------------------------------|
| compile       | 默认范围，适用于编译、测试和运行阶段。                           |
| provided      | 编译和测试阶段使用，运行阶段由容器或环境提供。                   |
| runtime       | 编译阶段不需要，测试和运行阶段需要。                             |
| test          | 只在测试阶段使用，不会被打包或发布。                            |
| system        | 类似于provided范围，但需要显式指定依赖的路径或坐标。              |
| import        | 仅用于管理POM之间的依赖关系，不会添加到实际构建路径中。           |

下面是对每个依赖范围的详细说明：

1. compile：默认范围，适用于编译、测试和运行阶段。依赖项将在编译、测试和运行时的类路径中可用。
2. provided：适用于编译和测试阶段，但在运行时由容器或环境提供。比如，Java EE容器通常提供了Servlet API和JSP API，因此可以将这些依赖项设置为provided范围。
3. runtime：在编译阶段不需要，但在测试和运行时需要。例如，数据库驱动程序通常在运行时才需要。
4. test：只在测试阶段使用，不会被打包或发布。这些依赖项用于编写和运行单元测试。
5. system：类似于provided范围，但需要显式指定依赖的路径或坐标。这种范围使您能够在本地文件系统上指定依赖项，但是它不推荐使用，因为它会使构建不可移植。
6. import：仅用于管理POM之间的依赖关系，不会添加到实际构建路径中。这种范围用于导入其他模块的依赖关系，它将继承其他模块的依赖范围。

在Maven的POM文件中，您可以通过在`<dependency>`元素中使用`<scope>`元素来指定依赖范围。例如：
```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-library</artifactId>
    <version>1.0.0</version>
    <scope>compile</scope>
</dependency>
```
在上述示例中，`<dependency>`元素定义了一个编译时范围的依赖项。


#### Maven 父 pom
在Maven中，父POM（Parent POM）是一个用于管理多个子项目的POM文件。父POM定义了一组共享的配置和依赖项，供子项目继承和使用。子项目可以通过继承父POM来共享父POM中定义的构建配置、插件配置、依赖管理等。

父POM的主要作用是：

1. 统一管理配置：通过父POM，可以将一组共享的配置信息集中管理，避免在每个子项目中重复配置相同的内容。
2. 管理依赖项：父POM可以定义一组共享的依赖项及其版本号，子项目可以继承并使用这些依赖项，避免每个子项目都单独定义依赖项。
3. 统一管理插件：父POM可以配置一组共享的插件，子项目可以继承并使用这些插件，确保插件版本和配置的一致性。
4. 定义构建配置：父POM可以定义一些通用的构建配置，如编译参数、资源过滤等，子项目可以继承这些配置。

父POM通常以一个独立的Maven项目存在，子项目通过在其POM文件中使用`<parent>`元素来引用父POM。例如：
```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>my-parent</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>
    ...
</project>
```
在子项目的POM文件中，使用`<parent>`元素指定父POM的坐标信息：
```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>my-parent</artifactId>
        <version>1.0.0</version>
    </parent>
    <groupId>com.example</groupId>
    <artifactId>my-child</artifactId>
    <version>1.0.0</version>
    ...
</project>
```
通过继承父POM，子项目可以继承父POM中定义的配置和依赖项，同时可以覆盖和定制这些配置。

需要注意的是，父POM不一定需要是本地项目中的文件，它可以是一个远程仓库中的POM文件。在Maven的构建过程中，首先会尝试在本地仓库中查找父POM，如果没有找到则从远程仓库下载。

希望以上信息对您有所帮助。如有任何进一步的问题，请随时提问。