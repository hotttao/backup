---
weight: 1
title: "RagFlow ORM"
date: 2025-08-20T12:00:00+08:00
lastmod: 2025-08-20T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow ORM"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一节我们介绍了 RagFlow 中的表，这一节我们来介绍 Ragflow 中的表操作。Ragflow 将表操作定义在了不同的 Service 中，这些 Service 定义在 `api\db\services`。

## 1. api\db 

首先我们来看一下 api\db 的结构。

### 1.1 **核心文件结构**

```
api/db/
├── __init__.py          # 枚举定义和常量
├── db_models.py         # 数据库模型定义
├── db_utils.py          # 数据库工具函数
├── runtime_config.py    # 运行时配置管理
├── init_data.py         # 初始化数据
└── services/            # 业务服务层
    ├── user_service.py
    ├── document_service.py
    ├── knowledgebase_service.py
    ├── canvas_service.py
    └── ... (其他服务)
```

### 1.2 **各文件功能详解**

#### **`__init__.py` - 枚举和常量定义**
- 定义了系统中使用的各种枚举类型：
  - `StatusEnum`: 状态枚举（有效/无效）
  - `UserTenantRole`: 用户租户角色（所有者/管理员/普通用户/邀请用户）
  - `FileType`: 文件类型（PDF、DOC、视觉、音频等）
  - `LLMType`: LLM类型（聊天、嵌入、语音转文本等）
  - `TaskStatus`: 任务状态（未开始/运行中/取消/完成/失败）
  - `ParserType`: 解析器类型（演示文稿、法律、手册、论文等）

#### **`db_models.py` - 数据库模型层**
- 使用 **Peewee ORM** 框架
- 定义了自定义字段类型：
  - `JSONField`: JSON数据存储
  - `ListField`: 列表数据存储
  - `SerializedField`: 序列化数据存储（支持Pickle和JSON）
- 包含数据库连接池管理（MySQL/PostgreSQL）
- 实现了单例模式的数据库连接

#### **`db_utils.py` - 数据库工具函数**
- `bulk_insert_into_db()`: 批量插入数据
- `query_dict2expression()`: 查询字典转表达式
- `query_db()`: 通用数据库查询函数
- 支持动态表名生成
- 提供操作符映射（==, <, >, !=等）

#### **`runtime_config.py` - 运行时配置**
- 继承自 `ReloadConfigBase`
- 管理运行时配置参数：
  - 调试模式、工作模式、HTTP端口
  - 作业服务器配置
  - 环境变量管理
  - 服务数据库配置

#### **`init_data.py` - 数据初始化**
- 初始化超级管理员账户
- 初始化LLM工厂配置
- 设置默认租户和用户关系
- 验证LLM服务可用性

### 1.3 **服务层架构 (`services/`)**

服务层采用分层架构，每个服务负责特定的业务领域：

- **`user_service.py`**: 用户管理服务
- **`document_service.py`**: 文档管理服务
- **`knowledgebase_service.py`**: 知识库管理服务
- **`canvas_service.py`**: 画布/工作流服务
- **`llm_service.py`**: LLM服务管理
- **`task_service.py`**: 任务管理服务
- **`file_service.py`**: 文件管理服务

### 1.4 **设计特点**

1. **ORM框架**: 使用Peewee ORM，支持MySQL和PostgreSQL
2. **连接池**: 实现了数据库连接池管理
3. **字段类型**: 自定义了JSON、序列化等特殊字段类型
4. **服务分层**: 清晰的服务层架构，职责分离
5. **配置管理**: 支持运行时配置重载
6. **多租户**: 内置多租户支持
7. **枚举管理**: 统一的枚举定义，便于维护

## 2. Peewee ORM
ragflow 使用 Peewee + playhouse ORM 框架来管理数据库操作。我们先对这两个框架做一个简单了解。

### 2.1 Peewee
Peewee 是一个 轻量级的 Python ORM（Object Relational Mapping）框架。以下是其核心概念:

| 概念  | Peewee 对应          | 说明                                                      |
| --- | ------------------ | ------------------------------------------------------- |
| 数据库 | `Database` 类       | `SqliteDatabase`, `PostgresqlDatabase`, `MySQLDatabase` |
| 表   | Python 类继承 `Model` | 每个类对应数据库中的表                                             |
| 字段  | `Field` 类          | `CharField`, `IntegerField`, `TextField` 等              |
| 查询  | 方法链 API            | `select()`, `where()`, `join()` 等                       |
| 事务  | `atomic()` 上下文     | 支持事务管理                                                  |

下面是其使用示例:

```python
from peewee import Model, CharField, IntegerField
from peewee import SqliteDatabase

db = SqliteDatabase('my_database.db')

# 定义模型（表）
class User(Model):
    username = CharField(max_length=50)
    age = IntegerField()

    class Meta:
        database = db  # 指定数据库
        indexes = ((('username',), True),)  # 唯一索引

# 事务
with db.atomic():
    User.create(username='Bob', age=25)

```


## 2.2 playhouse 定位
`playhouse` 是 **Peewee ORM 的官方扩展库**，提供了很多 Peewee 本身没有的 **高级功能和工具**

* Peewee 的 **官方扩展集合**，包含多种模块和实用工具。
* 用于 **增强 Peewee 的功能**，比如数据库迁移、字段类型扩展、异步支持等。
* 直接安装 Peewee 后可选安装，也可以单独使用 Peewee 的部分模块。

#### playhouse.shortcuts

* **提供便捷工具**，比如：

  * `model_to_dict(model)`：将 Peewee 模型对象转换为 Python 字典。
  * `dict_to_model(model_class, data)`：将字典转回模型对象。

```python
from playhouse.shortcuts import model_to_dict

user = User.get(User.id == 1)
data = model_to_dict(user)
```

---

#### playhouse.migrate

* **数据库迁移工具**，支持表结构变更（增删字段、修改类型）。
* 简化迁移操作，无需手写复杂 SQL。

```python
from playhouse.migrate import SqliteMigrator, migrate
from peewee import CharField

migrator = SqliteMigrator(db)
migrate(
    migrator.add_column('user', 'email', CharField(default=''))
)
```

---

#### playhouse.pool

* **数据库连接池**，适合多线程或高并发环境。
* 支持 `PooledMySQLDatabase`、`PooledPostgresqlDatabase` 等。

```python
from playhouse.pool import PooledPostgresqlDatabase

db = PooledPostgresqlDatabase('mydb', max_connections=8, user='user', password='pass')
```

---

#### postgres_ext / mysql_ext

* **数据库特性扩展**：

  * Postgres: JSONField、ArrayField、HStoreField、全文搜索等。
  * MySQL: 支持 JSON 字段、ENUM 类型等。
* 便于利用数据库原生高级功能。


#### playhouse.signals

* **信号机制**，类似 Django signals。
* 支持在模型保存、删除前后触发回调。

```python
from playhouse.signals import Model, post_save

class User(Model):
    username = CharField()

@post_save(sender=User)
def after_save_handler(model_class, instance, created):
    print(f"{instance.username} saved, created={created}")
```

---

总结

* **Peewee**：轻量 ORM，基础 CRUD + 查询。
* **playhouse**：Peewee 官方扩展库，提供：

  * 迁移工具（`migrate`）
  * 连接池（`pool`）
  * 数据库特性扩展（`postgres_ext`, `sqlite_ext`）
  * 信号机制（`signals`）
  * 实用快捷工具（`shortcuts`）


### 2.3 自定义字段类型

在 **Peewee** 中，你可以通过继承 `Field` 类来自定义字段类型，实现你自己的数据库字段行为。下面我系统地给你讲解：

---

#### 自定义字段的基本步骤

1. **继承 `peewee.Field`**
2. **指定数据库类型**（`field_type` 属性）
3. **可选：重写数据转换方法**：

   * `db_value(self, value)`：Python 值 → 数据库存储值
   * `python_value(self, value)`：数据库值 → Python 值

---

#### 自定义 JSON 字段（SQLite 中存储为 TEXT）

```python
from peewee import Field
import json

class JSONField(Field):
    field_type = 'TEXT'  # 数据库存储类型

    def db_value(self, value):
        # Python 对象 → 数据库字符串
        if value is not None:
            return json.dumps(value)
        return None

    def python_value(self, value):
        # 数据库字符串 → Python 对象
        if value is not None:
            return json.loads(value)
        return None
```

**用法：**

```python
from peewee import Model, SqliteDatabase

db = SqliteDatabase('test.db')

class Document(Model):
    data = JSONField()

    class Meta:
        database = db

db.connect()
db.create_tables([Document])

# 测试
doc = Document.create(data={"name": "Alice", "age": 30})
retrieved = Document.get(Document.id == doc.id)
print(retrieved.data)  # {'name': 'Alice', 'age': 30}
```

---

#### 高级示例：自定义加密字段

假设你要存储加密字符串：

```python
from peewee import Field
from cryptography.fernet import Fernet

key = Fernet.generate_key()
cipher = Fernet(key)

class EncryptedField(Field):
    field_type = 'TEXT'

    def db_value(self, value):
        if value is not None:
            return cipher.encrypt(value.encode()).decode()
        return None

    def python_value(self, value):
        if value is not None:
            return cipher.decrypt(value.encode()).decode()
        return None
```

* 数据库中存储的是加密字符串
* Python 读取时自动解密

## 3. Ragflow ORM 使用
ragflow 对 Peewee 基础上添加了很多自定义的内容。

### 3.1 添加自定义字段

```python
# 1. 根据数据，选择长文本类型
class TextFieldType(Enum):
    MYSQL = "LONGTEXT"
    POSTGRES = "TEXT"


class LongTextField(TextField):
    field_type = TextFieldType[settings.DATABASE_TYPE.upper()].value


# 2. 自定义 JSON 和 List 类型
class JSONField(LongTextField):
    default_value = {}

    def __init__(self, object_hook=None, object_pairs_hook=None, **kwargs):
        self._object_hook = object_hook
        self._object_pairs_hook = object_pairs_hook
        super().__init__(**kwargs)

    def db_value(self, value):
        if value is None:
            value = self.default_value
        return utils.json_dumps(value)

    def python_value(self, value):
        if not value:
            return self.default_value
        return utils.json_loads(value, object_hook=self._object_hook, object_pairs_hook=self._object_pairs_hook)


class ListField(JSONField):
    default_value = []


# 3. 自定义序列化字段，可选序列化方式，支持 json 和 pickle
# 相比于 JSONField，添加了 object_hook
class SerializedType(IntEnum):
    PICKLE = 1
    JSON = 2

class SerializedField(LongTextField):
    def __init__(self, serialized_type=SerializedType.PICKLE, object_hook=None, object_pairs_hook=None, **kwargs):
        self._serialized_type = serialized_type
        self._object_hook = object_hook
        self._object_pairs_hook = object_pairs_hook
        super().__init__(**kwargs)

    def db_value(self, value):
        if self._serialized_type == SerializedType.PICKLE:
            return utils.serialize_b64(value, to_str=True)
        elif self._serialized_type == SerializedType.JSON:
            if value is None:
                return None
            return utils.json_dumps(value, with_type=True)
        else:
            raise ValueError(f"the serialized type {self._serialized_type} is not supported")

    def python_value(self, value):
        if self._serialized_type == SerializedType.PICKLE:
            return utils.deserialize_b64(value)
        elif self._serialized_type == SerializedType.JSON:
            if value is None:
                return {}
            return utils.json_loads(value, object_hook=self._object_hook, object_pairs_hook=self._object_pairs_hook)
        else:
            raise ValueError(f"the serialized type {self._serialized_type} is not supported")


class JsonSerializedField(SerializedField):
    def __init__(self, object_hook=utils.from_dict_hook, object_pairs_hook=None, **kwargs):
        super(JsonSerializedField, self).__init__(serialized_type=SerializedType.JSON, object_hook=object_hook, object_pairs_hook=object_pairs_hook, **kwargs)
```

所有自定义 field 中比较复杂的是 JsonSerializedField。相比 JsonField，JsonSerializedField 可以添加 json hook，将 json 进一步转换为 Python 对象，而不是字典。

#### json hook
`object_hook` 和 `object_pairs_hook`，都是用来 **自定义 JSON 解码后 Python 对象的处理方式** 的。

---

1️⃣ `object_hook`

**作用**：

* 当 JSON 对象（`{...}`）被解码为 Python 字典时，`object_hook` 会被调用，用来**将字典转换成自定义对象**。
* 它接受一个 Python 字典作为参数，返回你想要的对象。

**示例**：

```python
import json

class User:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    def __repr__(self):
        return f"User(name={self.name}, age={self.age})"

def user_hook(d):
    # 把 dict 转换成 User 对象
    if "name" in d and "age" in d:
        return User(d["name"], d["age"])
    return d

data = '{"name": "Alice", "age": 30}'
user = json.loads(data, object_hook=user_hook)
print(user)  # User(name=Alice, age=30)
```

✅ 总结：`object_hook` 可以把 JSON 对象解码为**自定义类对象**。

---

2️⃣ `object_pairs_hook`

**作用**：

* 当 JSON 对象被解码为字典时，原本的键值对顺序可能丢失。
* `object_pairs_hook` 接收一个 **键值对列表**（list of tuples）而不是字典，返回你想要的对象。
* 它常用来保持 JSON 的**键顺序**或者自定义数据结构。

**示例**：

```python
import json
from collections import OrderedDict

data = '{"b": 2, "a": 1, "c": 3}'

# 使用 object_pairs_hook 保留顺序
ordered = json.loads(data, object_pairs_hook=OrderedDict)
print(ordered)  # OrderedDict([('b', 2), ('a', 1), ('c', 3)])
```

* `object_pairs_hook` 的参数是 `[(key1, value1), (key2, value2), ...]`，你可以返回任何对象。
* **注意**：如果同时提供 `object_hook` 和 `object_pairs_hook`，**优先使用 `object_pairs_hook`**。

---

3️⃣ 区别总结

| 参数                  | 输入类型           | 输出效果        | 用途                        |
| ------------------- | -------------- | ----------- | ------------------------- |
| `object_hook`       | dict           | 自定义对象       | 把 JSON 对象转换为自定义类或其他结构     |
| `object_pairs_hook` | list of tuples | 自定义对象，保持键顺序 | 保留顺序或转换为 OrderedDict/其他结构 |

---

简单记忆：

* `object_hook` → 字典 → 你想要的对象
* `object_pairs_hook` → 键值对列表 → 你想要的对象（可保序）

### 3.2 BaseModel
ragflow 在 peewee.Model 自定义了 BaseModel，所有的 model 都继承自 BaseModel，以给所有 model 添加字段和查询方法。

```python
class BaseModel(Model):
    # 定义基础字段：创建时间、创建日期、更新时间、更新日期，并建立索引
    create_time = BigIntegerField(null=True, index=True)  # 时间戳形式的创建时间
    create_date = DateTimeField(null=True, index=True)    # datetime 对象形式的创建时间
    update_time = BigIntegerField(null=True, index=True)  # 时间戳形式的更新时间
    update_date = DateTimeField(null=True, index=True)    # datetime 对象形式的更新时间

    # 将模型转为 JSON（弃用，内部调用 to_dict）
    def to_json(self):
        return self.to_dict()

    # 将模型数据转换为字典（直接返回 __data__，包含字段名和对应值）
    def to_dict(self):
        return self.__dict__["__data__"]

    # 返回人类可读的模型字典，可选择只包含主键和指定字段
    def to_human_model_dict(self, only_primary_with: list = None):
        model_dict = self.__dict__["__data__"]

        if not only_primary_with:
            # 移除字段前缀，返回所有字段
            return {remove_field_name_prefix(k): v for k, v in model_dict.items()}

        human_model_dict = {}
        # 添加主键字段
        for k in self._meta.primary_key.field_names:
            human_model_dict[remove_field_name_prefix(k)] = model_dict[k]
        # 添加额外指定字段
        for k in only_primary_with:
            human_model_dict[k] = model_dict[f"f_{k}"]
        return human_model_dict

    # 返回模型的元数据对象（_meta）
    @property
    def meta(self) -> Metadata:
        return self._meta

    # 获取主键字段名列表
    @classmethod
    def get_primary_keys_name(cls):
        if isinstance(cls._meta.primary_key, CompositeKey):
            return cls._meta.primary_key.field_names
        else:
            return [cls._meta.primary_key.name]

    # 根据属性名获取字段对象（用于动态访问字段）
    @classmethod
    def getter_by(cls, attr):
        return operator.attrgetter(attr)(cls)

    # 构建查询方法，可按字段值过滤，并支持范围、列表、多条件查询
    @classmethod
    def query(cls, reverse=None, order_by=None, **kwargs):
        filters = []
        for f_n, f_v in kwargs.items():
            attr_name = "%s" % f_n
            # 忽略不存在的字段或值为 None 的条件
            if not hasattr(cls, attr_name) or f_v is None:
                continue
            # 处理列表/集合类型的查询值
            if type(f_v) in {list, set}:
                f_v = list(f_v)
                # 对连续类型字段（如时间戳、数值）进行范围查询
                if is_continuous_field(type(getattr(cls, attr_name))):
                    if len(f_v) == 2:
                        # 如果是日期字符串，将其转换为时间戳
                        for i, v in enumerate(f_v):
                            if isinstance(v, str) and f_n in auto_date_timestamp_field():
                                f_v[i] = utils.date_string_to_timestamp(v)
                        lt_value, gt_value = f_v
                        # 构建 between 或 >= / <= 查询条件
                        if lt_value is not None and gt_value is not None:
                            filters.append(cls.getter_by(attr_name).between(lt_value, gt_value))
                        elif lt_value is not None:
                            filters.append(operator.attrgetter(attr_name)(cls) >= lt_value)
                        elif gt_value is not None:
                            filters.append(operator.attrgetter(attr_name)(cls) <= gt_value)
                else:
                    # 非连续类型字段使用 IN 查询
                    filters.append(operator.attrgetter(attr_name)(cls) << f_v)
            else:
                # 单值字段使用等于查询
                filters.append(operator.attrgetter(attr_name)(cls) == f_v)
        # 构建查询结果
        if filters:
            query_records = cls.select().where(*filters)
            # 支持排序
            if reverse is not None:
                if not order_by or not hasattr(cls, f"{order_by}"):
                    order_by = "create_time"
                if reverse is True:
                    query_records = query_records.order_by(cls.getter_by(f"{order_by}").desc())
                elif reverse is False:
                    query_records = query_records.order_by(cls.getter_by(f"{order_by}").asc())
            return [query_record for query_record in query_records]
        else:
            return []

    # 插入记录时自动填充 create_time
    @classmethod
    def insert(cls, __data=None, **insert):
        if isinstance(__data, dict) and __data:
          # __data 保存的是 Feild -> 值的映射
            __data[cls._meta.combined["create_time"]] = utils.current_timestamp()
        if insert:
            # insert 是 str key -> 值的映射
            insert["create_time"] = utils.current_timestamp()
        return super().insert(__data, **insert)

    # 数据标准化方法，供 insert/update 调用，自动更新时间和日期字段
    @classmethod
    def _normalize_data(cls, data, kwargs):
        normalized = super()._normalize_data(data, kwargs)
        if not normalized:
            return {}
        # 自动更新 update_time
        normalized[cls._meta.combined["update_time"]] = utils.current_timestamp()

        # 自动同步 *_time 和 *_date 字段
        for f_n in AUTO_DATE_TIMESTAMP_FIELD_PREFIX:
            # 判断字段是否存在，并且时间字段不为空
            if {f"{f_n}_time", f"{f_n}_date"}.issubset(cls._meta.combined.keys()) and \
               cls._meta.combined[f"{f_n}_time"] in normalized and \
               normalized[cls._meta.combined[f"{f_n}_time"]] is not None:
                normalized[cls._meta.combined[f"{f_n}_date"]] = utils.timestamp_to_date(
                    normalized[cls._meta.combined[f"{f_n}_time"]]
                )
        return normalized
```

---


1. **基础字段**：`create_time/create_date/update_time/update_date`，用于统一记录创建和更新时间。
2. **to_dict/to_human_model_dict**：将 Peewee 内部 `__data__` 转为普通字典，可选择只显示主键和指定字段。
3. **meta 属性**：返回 Peewee 模型的 `_meta` 元数据对象。
4. **get_primary_keys_name**：获取模型主键字段名列表（支持复合主键）。
5. **getter_by**：动态获取字段对象，便于动态构造查询。
6. **query 方法**：支持多种过滤条件（单值、列表/集合、范围）、排序、按时间字段自动处理日期字符串。
7. **insert 方法**：插入数据时自动填充 `create_time`。
8. **_normalize_data 方法**：用于 insert/update 前统一处理数据：

   * 自动填充 `update_time`
   * 自动同步 \*_time 和 \*_date 字段，使 timestamp 和 datetime 保持一致

BaseModel 的实现中引用了如下 Meta 上的属性：


| `_meta` 属性    | 类型 / 说明                  | 在代码中的用途                                                                     |
| ------------- | ------------------------ | --------------------------------------------------------------------------- |
| `primary_key` | `Field` 或 `CompositeKey` | 获取主键字段信息，用于 `get_primary_keys_name()` 和 `to_human_model_dict()`             |
| `combined`    | `dict`                   | 包含模型及父类的所有字段映射（字段名 → Field 对象），用于 `_normalize_data()` 和 `insert()` 自动填充时间字段 |

### 3.3 连接池管理
ragflow:
1. 支持 Mysql 和 Postgresql 两种数据库链接
2. 通过单例保证数据库实例进程内唯一


```python
# 1. 定义数据库连接池可选枚举
class PooledDatabase(Enum):
    MYSQL = RetryingPooledMySQLDatabase
    POSTGRES = PooledPostgresqlDatabase


# 2. singleton 保证进程内数据库唯一
@singleton
class BaseDataBase:
    def __init__(self):
        # 通过配置初始化数据库连接池
        database_config = settings.DATABASE.copy()
        db_name = database_config.pop("name")
        self.database_connection = PooledDatabase[settings.DATABASE_TYPE.upper()].value(db_name, **database_config)
        logging.info("init database on cluster mode successfully")

# 3. 实例化全局数据库链接对象
DB = BaseDataBase().database_connection

# 4. 所有 model 继承自 DataBaseModel，持有数据库链接对象
class DataBaseModel(BaseModel):
    class Meta:
        database = DB

def singleton(cls, *args, **kw):
    instances = {}

    def _singleton():
        # 单例模式，通过类名和进程 ID 作为键，保证进程内唯一
        key = str(cls) + str(os.getpid())
        if key not in instances:
            instances[key] = cls(*args, **kw)
        return instances[key]

    return _singleton
```

ragflow 重载了 playhouse.PooledMySQLDatabase 的 execute_sql 方法，添加了重试机制。

代码里处理超时时，直接使用了 `self.close_all` 不会对其他正在使用中的链接有影响么？

```python
class RetryingPooledMySQLDatabase(PooledMySQLDatabase):
    def __init__(self, *args, **kwargs):
        self.max_retries = kwargs.pop('max_retries', 5)
        self.retry_delay = kwargs.pop('retry_delay', 1)
        super().__init__(*args, **kwargs)

    def execute_sql(self, sql, params=None, commit=True):
        from peewee import OperationalError
        for attempt in range(self.max_retries + 1):
            try:
                return super().execute_sql(sql, params, commit)
            except OperationalError as e:
                if e.args[0] in (2013, 2006) and attempt < self.max_retries:
                    logging.warning(
                        f"Lost connection (attempt {attempt+1}/{self.max_retries}): {e}"
                    )
                    self._handle_connection_loss()
                    time.sleep(self.retry_delay * (2 ** attempt))
                else:
                    logging.error(f"DB execution failure: {e}")
                    raise
        return None

    def _handle_connection_loss(self):
        # 连接丢失时，关闭所有连接并重新连接
        # 这个不会对其他正在使用中的链接有影响么？
        self.close_all()
        self.connect()

    def begin(self):
        from peewee import OperationalError
        for attempt in range(self.max_retries + 1):
            try:
                return super().begin()
            except OperationalError as e:
                if e.args[0] in (2013, 2006) and attempt < self.max_retries:
                    logging.warning(
                        f"Lost connection during transaction (attempt {attempt+1}/{self.max_retries})"
                    )
                    self._handle_connection_loss()
                    time.sleep(self.retry_delay * (2 ** attempt))
                else:
                    raise
```

### 3.4 数据库分布式锁

ragflow 实现了基于 mysql、postgresql 分布式锁。
1. mysql:
  - `SELECT GET_LOCK(%s, %s)`
  - `SELECT RELEASE_LOCK(%s)`
2. postgresql:
  - `SELECT pg_try_advisory_lock(%s)`
  - `SELECT pg_advisory_unlock(%s)`

```python
class DatabaseLock(Enum):
    MYSQL = MysqlDatabaseLock
    POSTGRES = PostgresDatabaseLock

DB = BaseDataBase().database_connection
DB.lock = DatabaseLock[settings.DATABASE_TYPE.upper()].value


class MysqlDatabaseLock:
    def __init__(self, lock_name, timeout=10, db=None):
        self.lock_name = lock_name
        self.timeout = int(timeout)
        self.db = db if db else DB

    @with_retry(max_retries=3, retry_delay=1.0)
    def lock(self):
        # SQL parameters only support %s format placeholders
        cursor = self.db.execute_sql("SELECT GET_LOCK(%s, %s)", (self.lock_name, self.timeout))
        ret = cursor.fetchone()
        if ret[0] == 0:
            raise Exception(f"acquire mysql lock {self.lock_name} timeout")
        elif ret[0] == 1:
            return True
        else:
            raise Exception(f"failed to acquire lock {self.lock_name}")

    @with_retry(max_retries=3, retry_delay=1.0)
    def unlock(self):
        cursor = self.db.execute_sql("SELECT RELEASE_LOCK(%s)", (self.lock_name,))
        ret = cursor.fetchone()
        if ret[0] == 0:
            raise Exception(f"mysql lock {self.lock_name} was not established by this thread")
        elif ret[0] == 1:
            return True
        else:
            raise Exception(f"mysql lock {self.lock_name} does not exist")

    def __enter__(self):
        if isinstance(self.db, PooledMySQLDatabase):
            self.lock()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if isinstance(self.db, PooledMySQLDatabase):
            self.unlock()

    def __call__(self, func):
        @wraps(func)
        def magic(*args, **kwargs):
            with self:
                return func(*args, **kwargs)

        return magic


class PostgresDatabaseLock:
    def __init__(self, lock_name, timeout=10, db=None):
        self.lock_name = lock_name
        self.lock_id = int(hashlib.md5(lock_name.encode()).hexdigest(), 16) % (2**31 - 1)
        self.timeout = int(timeout)
        self.db = db if db else DB

    @with_retry(max_retries=3, retry_delay=1.0)
    def lock(self):
        cursor = self.db.execute_sql("SELECT pg_try_advisory_lock(%s)", (self.lock_id,))
        ret = cursor.fetchone()
        if ret[0] == 0:
            raise Exception(f"acquire postgres lock {self.lock_name} timeout")
        elif ret[0] == 1:
            return True
        else:
            raise Exception(f"failed to acquire lock {self.lock_name}")

    @with_retry(max_retries=3, retry_delay=1.0)
    def unlock(self):
        cursor = self.db.execute_sql("SELECT pg_advisory_unlock(%s)", (self.lock_id,))
        ret = cursor.fetchone()
        if ret[0] == 0:
            raise Exception(f"postgres lock {self.lock_name} was not established by this thread")
        elif ret[0] == 1:
            return True
        else:
            raise Exception(f"postgres lock {self.lock_name} does not exist")

    def __enter__(self):
        if isinstance(self.db, PooledPostgresqlDatabase):
            self.lock()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if isinstance(self.db, PooledPostgresqlDatabase):
            self.unlock()

    def __call__(self, func):
        @wraps(func)
        def magic(*args, **kwargs):
            with self:
                return func(*args, **kwargs)

        return magic
```

### 3.5 表创建和迁移

```python
# 给函数增加数据库上下文管理和分布式锁
@DB.connection_context()            # 确保函数运行时自动获取和释放数据库连接
@DB.lock("init_database_tables", 60)  # 获取名为 "init_database_tables" 的数据库锁，超时时间 60 秒
def init_database_tables(alter_fields=[]):
    # 获取当前模块中所有类（class）的成员
    members = inspect.getmembers(sys.modules[__name__], inspect.isclass)

    table_objs = []         # 存放需要处理的数据库表模型类
    create_failed_list = [] # 记录创建失败的表名

    # 遍历模块中定义的所有类
    for name, obj in members:
        # 只处理继承自 DataBaseModel 的子类（即用户自定义的 ORM 模型类）
        if obj != DataBaseModel and issubclass(obj, DataBaseModel):
            table_objs.append(obj)

            # 判断表是否已经存在
            if not obj.table_exists():
                logging.debug(f"start create table {obj.__name__}")
                try:
                    # 创建表，如果表已存在则不会抛错（safe=True）
                    obj.create_table(safe=True)
                    logging.debug(f"create table success: {obj.__name__}")
                except Exception as e:
                    # 如果建表失败，记录错误并加入失败列表
                    logging.exception(e)
                    create_failed_list.append(obj.__name__)
            else:
                # 如果表已经存在则跳过
                logging.debug(f"table {obj.__name__} already exists, skip creation.")

    # 如果有表创建失败，记录日志并抛出异常
    if create_failed_list:
        logging.error(f"create tables failed: {create_failed_list}")
        raise Exception(f"create tables failed: {create_failed_list}")

    # 调用数据库迁移函数（用于更新已有表的字段等结构变更）
    migrate_db()

```
这段代码中:
1. `DB.connection_context()` 是 Peewee Database 提供的上下文管理器 / 装饰器，用于在一段代码（或一个函数）执行期间获取一个数据库连接并在结束时归还
2. `DB.lock("init_database_tables", 60)` 借助数据库锁，避免多实例/多线程同时跑初始化逻辑
