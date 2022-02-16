# 6.1 动态属性和特性

Python 术语
  - 属性：数据的属性和处理数据的方法统称属性
  - 特性：property，在不改变类接口的前提下，使用存取方法（即读值方法和设值方法）修改数据属性

本章内容
  - 特性
  - 动态属性
  - \_\_new\_\_ 与  \_\_init\_\_

## 2. 特性
特性 - property:
  - 类型：特性是 **覆盖性描述符**(详见下章)，是实现了描述符协议的类
  - 作用：
    - 特性都是类属性，但是特性管理的其实是实例属性的存取，会覆盖实例属性
    - 把公开属性变成使用读值方法和设值方法管理的属性，在不影响客户端代码的前提下实施业务规则
  - 应用：
    - 特性适用于管理实例属性
    - 私有类属性适合使用读值和设值方法管理
    - 用于修改对象的方法不能实现为特性
  - 抽象方式：详见下节
    1. 使用特性工厂函数
    2. 使用描述符类
  - 版本差异：
    - Python2：
      - 只有"新式"类支持特性
      - 定义新式类的方法是，直接或间接继承 object 类
  - 语法：
    - 作为类使用：property(fget=None, fset=None, fdel=None, doc=None)
      - 所有参数都是可选的
      - 如果没有把函数传给某个参数，那么得到的特性对象就不允许执行相应的操作
    - 作为装饰器：
      - 使用装饰器创建 property 对象时，读值方法的文档字符串作为一个整体，变成特性的文档

    ```Python
    class MyObj:
      @property
      def my_propety(self):
        """doc"""
        pass

      @my_propety.setter
      def set_property(self):
        pass

      @my_propety.deleter
      def del_property(self):
        pass
    ```

## 2. \_\_new\_\_ 与  \_\_init\_\_
### 2.1 \_\_init\_\_:
  - 作用：实例初始化方法
  - 特性：禁止返回任何值

### 2.2 \_\_new\_\_(cls, \*\*arg, \*\*kwargs):
  - 作用：实例构造方法
  - 特性：
    - 这是个类方法(使用特殊方式处理，因此不必使用 @classmethod装饰器）
    - 必须返回一个实例，返回的实例作为第一个参数（即 self）传给 \_\_init\_\_ 方法
    - \_\_new\_\_ 方法**也可以返回其他类的实例**，此时，解释器不会调用 \_\_init\_\_ 方法
  - 附注：几乎不需要自己编写 \_\_new\_\_ 方法，因为从 object 类继承的实现已经足够了
  - 参数：
    - \_\_new\_\_ 是类方法，第一个参数是类本身
    - 余下的参数与 \_\_init\_\_ 方法一样，只不过没有 self

**Python 构建对象过程的伪代码**
```Python
def object_maker(the_class, some_arg):
    new_object = the_class.__new__(some_arg)
    if isinstance(new_object, the_class):
        the_class.__init__(new_object, some_arg)
    return new_obj

# 下述两个语句的作用基本等效
x = Foo('bar')
x = object_maker(Foo, 'bar')
```

### 2.3 \_\_new\_\_ 使用示例
```python
class FrozenJSON:
    """A read-only façade for navigating a JSON-like object
       using attribute notation
    """

    def __new__(cls, arg):  # <1>
        if isinstance(arg, abc.Mapping):
            return super().__new__(cls)  # <2>
        elif isinstance(arg, abc.MutableSequence):  # <3>
            return [cls(item) for item in arg]
        else:
            return arg
```
super().\_\_new\_\_(cls)
  - 默认的行为是委托给超类的 \_\_new\_\_ 方法
  - 这里是调用 object.\_\_new\_\_(FrozenJSON)，
  - object 类构建的是 FrozenJSON 的实例
  - 真正的构建操作由解释器调用 C 语言实现的 object.\_\_new\_\_ 方法执行

### 2.4 super() 函数
#### Python2
class super(object)
  - super(type)：返回非绑定的函数
  - super(type, obj)：调用实例方法，要求 isinstance(obj, type)
  - super(type, type2)：调用类方法，要求 issubclass(type2, type)
  - 典型用法:

  ```python
  class C(B):
      def meth(self, arg):
          super(C, self).meth(arg)
  ```

#### Python3
http://python3-cookbook.readthedocs.io/zh_CN/latest/c08/p07_calling_method_on_parent_class.html


## 3. 动态属性
### 3.1 属性查找顺序：
  1. 类中的覆盖性描述符
  2. 实例，类，超类
  3. 所属类中定义的 \_\_getattr\_\_ 方法， 传入 self 和属性名称的字符串形式

### 3.2 处理属性的特殊方法
附注：
  - 使用点号或内置的 getattr、 hasattr 和 setattr 函数存取属性都会触发下述列表中相应的特殊方法
  - 直接通过实例的 \_\_dict\_\_ 属性读写属性不会触发这些特殊方法——如果需要，通常会使用这种方式跳过特殊方法
  - 特殊方法从类上获取，因此不会被同名实例属性遮盖

\_\_delattr\_\_(self, name)
  - 调用：使用 del 语句删除属性时
  - 例如：del obj.attr 语句触发 Class.\_\_delattr\_\_(obj, 'attr') 方法


\_\_dir\_\_(self)
  - 调用：使用 dir 函数获取对象属性时
  - 例如：dir(obj) 触发 Class.\_\_dir\_\_(obj) 方法


\_\_getattribute\_\_(self, name)
  - 触发：尝试获取指定的属性时总会调用，包括点号，getattr 和 hasattr 内置函数
  - 特性：
    - 寻找的属性是特殊属性或特殊方法时除外
    - 调用 \_\_getattribute\_\_ 方法且抛出 AttributeError 异常时，才会调用 \_\_getattr\_\_ 方法
  - 使用：为了在获取 obj 实例的属性时不导致无限递归， \_\_getattribute\_\_ 方法的实现要使用
  super().\_\_getattribute\_\_(obj, name)


\_\_getattr\_\_(self, name)
  - 触发：仅当在 obj、 Class 和超类中找不到指定的属性时才会触发


\_\_setattr\_\_(self, name, value)
  - 触发：尝试设置指定的属性时调用，包括点号和 setattr 内置函数
  - 例如：obj.attr = 42 和 setattr(obj, 'attr', 42) 都会触发
  Class.\_\_setattr\_\_(obj, "attr" , 42) 方法
  - 说明：
    - 特殊方法 \_\_getattribute\_\_ 和 \_\_setattr\_\_ 不管怎样都会调用，几乎会影响每一次属性存取，
    因此比 \_\_getattr\_\_ 方法（只处理不存在的属性名）更难正确使用
    - 与定义这些特殊方法相比，使用特性或描述符相对不易出错


### 3.3 影响属性处理方式的特殊属性
\_\_class\_\_
  - 作用：对象所属类的引用（即 obj.\_\_class\_\_ 与 type(obj) 的作用相同)
  - 特性：Python 的某些特殊方法，例如 \_\_getattr\_\_，只在对象的类中寻找，而不在实例中寻找

\_\_dict\_\_
  - 作用：
    - 一个映射，存储对象或类的可写属性
    - 有 \_\_dict\_\_ 属性的对象，任何时候都能随意设置新属性

\_\_slots\_\_
  - 作用：类可以定义这个属性，限制实例能有哪些属性
  - 属性值：一个字符串组成的元组，指明允许有的属性
  - 附注：如果 \_\_slots\_\_ 中没有 '\_\_dict\_\_'，那么该类的实例没有
  \_\_dict\_\_ 属性，实例只允许有指定名称的属性

### 3.4 处理属性的内置函数
dir([object])
  - 作用：
    - 列出 object 对象的大多数属性
    - 如果没有指定可选的 object 参数， dir 函数会列出当前作用域中的名称
  - 文档： https://docs.python.org/3/library/functions.html#dir
  - 特性：
    - 目的是交互式使用，因此没有提供完整的属性列表，只列出一组“重要的"属性名
    - 能审查有或没有 \_\_dict\_\_ 属性的对象
    - 不会列出 \_\_dict\_\_ 属性本身，但会列出其中的键。
    - 也不会列出类的几个特殊属性，例如\_\_mro\_\_、 \_\_bases\_\_ 和 \_\_name\_\_

vars([object])
  - 作用：
    - 返回 object 对象的 \_\_dict\_\_ 属性
    - 如果没有指定参数，var() 与 locals() 函数一样，返回表示本地作用域的字典
  - 特性：
    - 如果实例所属的类定义了 \_\_slots\_\_ 属性，实例没有 \_\_dict\_\_ 属性，
    那么 vars 函数不能处理那个实例，相反， dir 函数能处理这样的实例

getattr(object, name[, default])
  - 作用：从 object 对象中获取 name 字符串对应的属性
  - 返回：
    - 获取的属性可能来自对象所属的类或超类
    - 如果没有指定的属性， getattr 函数抛出 AttributeError 异常，
    或者返回 default参数的值（如果设定了的话）

hasattr(object, name)
  - 作用：检查 object 对象是否拥有指定的属性，有返回True
  - 原理：调用 getattr(object, name) 函数，检查是否抛出 AttributeError 异常
  - 文档：https://docs.python.org/3/library/functions.html#hasattr

setattr(object, name, value)
  - 作用：把 object 对象指定属性的值设为 value
  - 前提：object 对象能接受那个值。
  - 附注：这个函数可能会创建一个新属性，或者覆盖现有的属性

### 3.5 动态属性示例 1
```python
from collections import abc

class FrozenJSON:
    def __init__(self, mapping):
        self.__data = dict(mapping)

    def __getattr__(self, name):
        if hasattr(self.__data, name):
            return getattr(self.__data, name)
        else:
            return FrozenJSON(self.__data[name])  # <4>
```
\_\_getattr\_\_:
  - 首先查看 self.\_\_data 字典有没有指定名称的属性（不是键），
  这样 FrozenJSON 实例便可以处理字典的所有方法
  - 如果 self.\_\_data 没有指定名称的属性，那么 \_\_getattr\_\_ 方法以那个名称为键，
  从 self.\_\_data 中获取一个元素，并进行实例构造

### 3.6 动态属性示例 2
```python
class Record:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)   # 快速地在实例中创建一堆属性
                                       # 前提是类中没有声明 __slots__ 属性
# END SCHEDULE2_RECORD
```
self.\_\_dict\_\_.update(kwargs)
  - 快速地在实例中创建一堆属性，前提是类中没有声明 __slots__ 属性
  - 从数据中创建实例属性的名称时肯定有可能会引入缺陷，因为类属性（例如方法）可能被遮盖，
  或者由于意外覆盖现有的实例属性而丢失数据

```python
# BEGIN SCHEDULE2_DBRECORD
class DbRecord(Record):  #

    __db = None  # __db 类属性存储一个打开的 shelve.Shelf 数据库引用。

    @staticmethod  # <4>
    def set_db(db):
        DbRecord.__db = db  # __db 是 DbRecord 类的私有属性

    @staticmethod
    def get_db():
        return DbRecord.__db

    @classmethod
    def fetch(cls, ident):
        db = cls.get_db()
        try:
            return db[ident]
        except TypeError:
            if db is None:
                msg = "database not set; call '{}.set_db(my_db)'"
                raise MissingDatabaseError(msg.format(cls.__name__))
            else:       # 重新抛出 TypeError 异常
                raise

    def __repr__(self):
        if hasattr(self, 'serial'):  # <11>
            cls_name = self.__class__.__name__
            return '<{} serial={!r}>'.format(cls_name, self.serial)
        else:
            return super().__repr__()  # <12>
# END SCHEDULE2_DBRECORD
```

```python
class Event(DbRecord):
    @property
    def speakers(self):
        if not hasattr(self, '_speaker_objs'):
            # 从 __dict__ 中获取 'speakers'，防止无限递归，因为特性的公开名称也是 speakers
            spkr_serials = self.__dict__['speakers']  
            fetch = self.__class__.fetch  # 获取 fetch 类方法的引用，避免被实例同名属性覆盖
            self._speaker_objs = [fetch('speaker.{}'.format(key))
                                  for key in spkr_serials]  # <6>
        return self._speaker_objs
```

```python
# BEGIN SCHEDULE2_LOAD
def load_db(db):
    raw_data = osconfeed.load()
    warnings.warn('loading ' + DB_NAME)
    for collection, rec_list in raw_data['Schedule'].items():
        record_type = collection[:-1]
        cls_name = record_type.capitalize()
        cls = globals().get(cls_name, DbRecord)  ➌
        if inspect.isclass(cls) and issubclass(cls, DbRecord):  ➍
            factory = cls
        else:
            factory = DbRecord
        for record in rec_list:  # <7>
            key = '{}.{}'.format(record_type, record['serial'])
            record['serial'] = key
            db[key] = factory(**record)  # <8>
```
- ➌ 从模块的全局作用域中获取那个名称对应的对象；如果找不到对象，使用 DbRecord。
- ➍ 如果获取的对象是类，而且是 DbRecord 的子类

## 延伸阅读
### Python:
Builtin Functions
  - 属性处理和内置的内省函数的官方文档
  - https://docs.python.org/3/library/functions.html

3.3.9. Special method lookup
  - 调用特殊方法会跳过实例的语意原因
  - https://docs.python.org/3/reference/datamodel.html#special-method-lookup）

4.13. Special Attributes
  - 说明了 \_\_class\_\_ 和 \_\_dict\_\_ 属性
  - https://docs.python.org/3/library/stdtypes.html#special-attributes）

\_\_slots\_\_ 属性
  -  https://docs.python.org/3/reference/datamodel.html#customizing-attribute-access

### blog:
The simple but handy ‘ collector of a bunch of named stuff’class
  - http://code.activestate.com/recipes/52308-the-simple-but-handy-collector-of-a-bunch-of-named/

Class-level read only properties in Python
  - http://stackoverflow.com/questions/1735434/class-level-read-only-properties-in-python
  - 为类中的只读属性提供了解决方案

### 实用工具
keyword 模块
  - keyword.iskeyword(value): 判断value 是否是 Python 关键字
  - str.isidentifier(): 根据语言的语法判断 str 是否为有效的 Python 标识符


shelve 模块
  - 作用：提供了 pickle 存储方式
  - shelve.open:
    - 作用：返回一个 shelve.Shelf 实例，这是简单的键值对象数据库，背后由dbm 模块支持
  - Shelf:
    - 是 abc.MutableMapping 的子类，因此提供了处理映射类型的重要方法
    - 提供了几个管理 I/O 的方法，如 sync 和 close；也是一个上下文管理器
    - 只要把新值赋予键，就会保存键和值
    - 键必须是字符串。
    - 值必须是 pickle 模块能处理的对象
  - 文档：
    - shelve: https://docs.python.org/3/library/shelve.html
    - dbm: https://docs.python.org/3/library/dbm.html
    - pickle: https://docs.python.org/3/library/pickle.html

以下类实例可以有任意个属性，由传给构造方法的关键字参数构建：
  - multiprocessing.Namespace 类
    - 文档: https://docs.python.org/3/library/multiprocessing.html?highlight=namespace#namespaceobjects
    - 源码: https://hg.python.org/cpython/file/50d581f69a73/Lib/multiprocessing/managers.py#l909
  - argparse.Namespace 类
    - 文档: https://docs.python.org/3/library/argpa-rse.html#argparse.Namespace
    - 源码: https://hg.python.org/cpython/file/50d581f69a73/Lib/argparse.py#l1196

`python -i schedule1.py`: 启动加载了 schedule1 模块的控制台

### 书籍:
《 Python Cookbook（第 3 版）中文版》
  - 8.8 在子类中扩展属性: 解决了在继承自超类的特性中覆盖方法这个棘手问题
  - 8.15 委托属性的访问: 实现了一个代理类
  - 9.21 避免出现重复的属性方法

《 Python 技术手册（第 2 版）》

## 附注
统一访问原则(Unifrom Access Principle)
  - 相关文章：
    - http://c2.com/cgi/wiki?UniformAccessPrinciple
    - http://c2.com/cgi/wiki?WelcomeVisitors
  - Python：
    - 在 Python 中还有一处体现了统一访问原则(或者它的变体)：函数调用和对象实例化
    使用相同的句法——my_obj = foo()，其中 foo 是类或其他可调用的对象

\_\_new\_\_ 方法
  - 作用：可以把类变成工厂方法，生成不同类型的对象，或者返回事先构建好的实例，而不是每次都创建一个新实例
