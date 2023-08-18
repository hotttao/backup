---
weight: 1
title: "Java 中的集合类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 中的集合类型"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---
## 1. Java 中的集合对象
Java标准库自带的java.util包提供了集合类：Collection，它是除Map外所有其他集合类的根接口。

Java的java.util包主要提供了以下三种类型的集合：
1. List：一种有序列表的集合
2. Set：一种保证没有重复元素的集合
3. Map：一种通过键值（key-value）查找的映射表集合

Java集合的设计有几个特点：
1. 一是实现了接口和实现类相分离，例如，有序表的接口是List，具体的实现类有ArrayList，LinkedList等，
2. 二是支持泛型，我们可以限制在一个集合中只能放入同一种数据类型的元素
3. Java访问集合总是通过统一的方式——迭代器（Iterator）来实现

### 1.1 Collection 接口
Java Collection接口定义的主要方法如下:

| 方法 | 描述 |
|-|-|  
| add(E e) | 将元素e添加到集合末尾 |
| addAll(Collection c) | 将集合c的所有元素添加到末尾 |
| clear() | 删除集合内所有元素 | 
| contains(Object o) | 判断集合是否包含o |
| containsAll(Collection c) | 判断是否包含集合c的所有元素 |
| equals(Object o) | 判断与指定对象是否相等 |
| hashCode() | 返回集合的哈希值 |
| isEmpty() | 判断集合是否为空 |
| iterator() | 返回在集合上的迭代器 | 
| remove(Object o) | 删除集合中第一个出现的o |
| removeAll(Collection c) | 删除集合中所有出现在c中的元素 |
| retainAll(Collection c) | 保留集合中所有出现在c中的元素 |
| size() | 返回集合中的元素个数 |
| toArray() | 返回包含集合中所有元素的数组 |

Collection定义了基础集合的通用方法,包括添加、删除、遍历等操作。具体Collection实现类扩展并优化了这些方法。

## 2. List
### 2.1 List 接口

| 方法                         | 描述                                                         |
|-----------------------------|--------------------------------------------------------------|
| `boolean add(E e)`           | 将元素添加到列表的末尾。                                     |
| `void add(int index, E e)`   | 将元素插入到指定索引位置。                                   |
| `boolean addAll(Collection<? extends E> c)` | 将另一个集合中的元素全部添加到列表。      |
| `boolean addAll(int index, Collection<? extends E> c)` | 在指定索引位置插入另一个集合中的元素。 |
| `void clear()`               | 清空列表中的所有元素。                                       |
| `boolean contains(Object o)` | 检查列表是否包含指定的元素。                                 |
| `boolean isEmpty()`          | 检查列表是否为空。                                           |
| `int indexOf(Object o)`      | 返回指定元素在列表中的第一个匹配的索引。                     |
| `int lastIndexOf(Object o)`  | 返回指定元素在列表中最后一个匹配的索引。                     |
| `E get(int index)`           | 获取指定索引处的元素。                                       |
| `E set(int index, E element)` | 将指定索引处的元素替换为新元素。                            |
| `E remove(int index)`        | 移除指定索引处的元素。                                       |
| `boolean remove(Object o)`   | 从列表中移除一个元素。                                       |
| `boolean removeAll(Collection<?> c)` | 从列表中移除另一个集合中包含的所有元素。   |
| `boolean retainAll(Collection<?> c)` | 仅保留列表中与另一个集合相同的元素。      |
| `int size()`                 | 返回列表中的元素数量。                                       |
| `List<E> subList(int fromIndex, int toIndex)` | 返回指定索引范围内的部分列表。        |
| `Object[] toArray()`         | 将列表转换为对象数组。                                       |
| `<T> T[] toArray(T[] a)`     | 将列表转换为指定类型的数组。                                 |

### 2.2 List 的实现类
以下是 Java 中一些常见的类实现了 `java.util.List` 接口，以表格形式呈现：

| 类名                         | 描述                                                       |
|-----------------------------|------------------------------------------------------------|
| `ArrayList`                 | 动态数组实现，支持可变大小的列表。                         |
| `LinkedList`                | 双向链表实现，支持高效的插入和删除操作。                   |
| `CopyOnWriteArrayList`      | 线程安全的列表，基于复制-on-write 策略。                 |

### 2.3 遍历
List 实现了 Iterator 接口，我们可以通过 Iterator 直接遍历:

```java
import java.util.Iterator;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> list = List.of("apple", "pear", "banana");
        for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
            String s = it.next();
            System.out.println(s);
        }
    }
}

// java for 循环内置了对 Iterator 的支持，上面的代码可以简化为:

public class Main {
    public static void main(String[] args) {
        List<String> list = List.of("apple", "pear", "banana");
        for (String s : list) {
            System.out.println(s);
        }
    }
}
```

### 2.4 List和Array转换

以下是 Java 中 `List` 与数组之间互相转换的方法列表，以表格形式呈现：

| 方法                        | 描述                                                               |
|----------------------------|--------------------------------------------------------------------|
| **从数组到 List：**          |                                                                    |
|`List.of(T...)`|返回的是一个只读List|
| `Arrays.asList(T... array)` | 将数组转换为固定大小的 `List`，返回的列表不支持添加或删除操作。     |
| **从 List 到数组：**        |                                                                    |
| `list.toArray(T[] a)`       | 使用 `List` 接口的 `toArray()` 方法将 `List` 转换为数组。          |
| `list.toArray(IntFunction<T[]> generator)` | List接口定义的`T[] toArray(IntFunction<T[]> generator)`方法               |
| `collection.toArray()`      | 使用 `Collection` 接口的 `toArray()` 方法将集合转换为 `Object` 数组，会丢失类型信息 |

`List.of` 是 Java 9 中引入的一个静态工厂方法，用于创建一个不可变的列表。它返回一个包含指定元素的不可变列表，无法修改其中的元素。并且 `List.of()`方法不接受null值，如果传入null，会抛出NullPointerException异常。

```java
// 1. 从 List 到数组
// list.toArray(T[] a)
// 如果传入的数组不够大，那么List内部会创建一个新的刚好够大的数组，填充后返回；
// 如果传入的数组比List元素还要多，那么填充完元素后，剩下的数组元素一律填充null
List<Integer> list = List.of(12, 34, 56);
Integer[] array = list.toArray(new Integer[3]);
Number[] array = list.toArray(new Number[3]);
Integer[] array = list.toArray(new Integer[list.size()]);

// T[] toArray(IntFunction<T[]> generator)
Integer[] array = list.toArray(Integer[]::new);

// collection.toArray()
List<String> list = List.of("apple", "pear", "banana");
Object[] array = list.toArray();

// 2. 数组到 List
Integer[] array = { 1, 2, 3 };
List<Integer> list = List.of(array);
// java11 之前的版本
List<Integer> list = Arrays.asList(array);
```

### 2.5 编写 equals 方法
List contains、indexOf 方法能否返回预期结果依赖对象是否实现了 equals 方法。那如何正确实现 equals 方法呢。

```java
class Person {
    String name;
    public Person(String name) {
        this.name = name;
    }
}

public boolean equals(Object o) {
    // 用instanceof判断传入的待比较的Object是不是当前类型
    if (o instanceof Person p) {
        // 对引用类型用Objects.equals()比较，对基本类型直接用==比较。

        return Objects.equals(this.name, p.name) && this.age == p.age;
    }
    return false;
}
```

使用`Objects.equals()`比较两个引用类型是否相等的目的是省去了判断null的麻烦。两个引用类型都是null时它们也是相等的。

### 2.6 ArrayList
#### ArrayList 的构造函数
ArrayList在Java中的常见构造函数包括:

- ArrayList():构造一个默认初始容量为10的空列表。

```java
ArrayList list = new ArrayList(); 
```

- ArrayList(int initialCapacity):构造指定初始容量的空列表。

```java
ArrayList list = new ArrayList(20);
```

- ArrayList(Collection<? extends E> c):构造一个包含指定集合元素的列表。

```java 
List<String> list1 = new ArrayList<>();
list1.add("a");
list1.add("b");

// 用已有List构造ArrayList
List<String> list2 = new ArrayList<>(list1);
```

- ArrayList(int initialCapacity, float growthRate):构造指定容量和扩容比率的空列表。

```java
ArrayList list = new ArrayList(10, 0.5f); 
```

另外,Java 9 adds:

- ArrayList(Stream<? extends E> stream)

从Stream构造ArrayList。

ArrayList构造函数允许灵活指定初始化参数,如初始容量、扩容方式、初始元素等,方便我们针对不同场景创建合适的ArrayList。

## 3. Map

### 3.1 Map 接口

| 方法                                  | 描述                                                                                     |
|--------------------------------------|------------------------------------------------------------------------------------------|
| `int size()`                          | 返回 Map 中键值对的数量。                                                                |
| `boolean isEmpty()`                   | 检查 Map 是否为空。                                                                       |
| `boolean containsKey(Object key)`     | 检查 Map 是否包含指定的键。                                                              |
| `boolean containsValue(Object value)` | 检查 Map 是否包含指定的值。                                                              |
| `V get(Object key)`                   | 根据键获取对应的值，如果键不存在则返回 `null`。                                          |
| `V put(K key, V value)`               | 将键值对添加到 Map 中，如果键已存在则替换对应的值，并返回旧值。                          |
| `V remove(Object key)`                | 根据键移除对应的键值对，并返回旧值。                                                    |
| `void putAll(Map<? extends K, ? extends V> m)` | 将另一个 Map 中的键值对添加到当前 Map 中。                                |
| `void clear()`                        | 移除 Map 中的所有键值对。                                                                 |
| `Set<K> keySet()`                     | 返回包含所有键的 Set 视图，用于遍历键。                                                 |
| `Collection<V> values()`              | 返回包含所有值的 Collection 视图，用于遍历值。                                         |
| `Set<Map.Entry<K, V>> entrySet()`     | 返回包含所有键值对的 Set 视图，用于遍历键值对。                                         |
| `default V getOrDefault(Object key, V defaultValue)` | 获取指定键的值，如果键不存在则返回默认值。                   |
| `default void forEach(BiConsumer<? super K, ? super V> action)` | 对 Map 中的每个键值对执行指定的操作。           |
| `default void replaceAll(BiFunction<? super K, ? super V, ? extends V> function)` | 对 Map 中的每个键值对执行指定的映射操作。 |
| `default V putIfAbsent(K key, V value)` | 如果指定的键不存在，则将键值对添加到 Map 中。                                        |
| `default boolean remove(Object key, Object value)` | 如果指定的键值对存在，则移除。          |
| `default boolean replace(K key, V oldValue, V newValue)` | 如果旧值匹配，则替换为新值。   |
| `default V replace(K key, V value)`  | 替换指定键的值，并返回旧值。                                                            |
| `default V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction)` | 根据键计算值并添加到 Map 中，如果键已存在则返回旧值。 |
| `default V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction)` | 根据键和值计算新值并替换，如果键不存在则不操作。 |
| `default V compute(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction)` | 根据键和值计算新值并替换，如果键不存在则添加。    |
| `default V merge(K key, V value, BiFunction<? super V, ? super V, ? extends V> remappingFunction)` | 根据键和值进行合并，如果键不存在则添加。   |

### 3.2 Map 实现类

| 类名                     | 描述                                                               |
|-------------------------|--------------------------------------------------------------------|
| `HashMap`               | 基于哈希表实现的 Map，无序且效率高。                             |
| `LinkedHashMap`         | 基于哈希表和链表实现的 Map，保留插入顺序。                       |
| `TreeMap`               | 基于红黑树实现的 Map，按键的自然顺序或自定义顺序排序。           |
| `Hashtable`             | 与 `HashMap` 类似，但线程安全，性能较差。                      |
| `WeakHashMap`           | 基于哈希表实现的 Map，对键使用弱引用，适用于缓存等场景。       |
| `IdentityHashMap`       | 基于哈希表实现的 Map，使用引用相等（而不是对象相等）进行比较。 |
| `EnumMap`               | 专门用于枚举类型键的 Map，基于数组实现。                       |
| `ConcurrentHashMap`     | 并发安全的 Map，支持高并发环境下的操作。                      |
| `ConcurrentSkipListMap` | 基于跳表实现的 Map，支持高并发和排序。                        |

### 3.2 遍历
```java
Map<String, Integer> map = new HashMap<>();
map.put("apple", 123);
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    String key = entry.getKey();
    Integer value = entry.getValue();
    System.out.println(key + " = " + value);
}

for (String key : map.keySet()) {
    Integer value = map.get(key);
    System.out.println(key + " = " + value);
}
```

### 3.3 自定义对象的 Hash
对于自定义对象，正确使用Map必须保证：
1. 作为key的对象必须正确覆写`equals()`方法，相等的两个key实例调用equals()必须返回true；
2. 作为key的对象还必须正确覆写`hashCode()`方法，且hashCode()方法要严格遵循以下规范：
    - 如果两个对象相等，则两个对象的`hashCode()`必须相等；
    - 如果两个对象不相等，则两个对象的`hashCode()`尽量不要相等。
3. 编写equals()和hashCode()遵循的原则是：`equals()`用到的用于比较的每一个字段，都必须在`hashCode()`中用于计算；`equals()`中没有使用到的字段，绝不可放在`hashCode()`中计算。

```java
public class Person {
    String firstName;
    String lastName;
    int age;

    @Override
    int hashCode() {
        return Objects.hash(firstName, lastName, age);
    }
}
```

### 3.4 HashMap 
#### HashMap 的构造函数
Java中的HashMap主要有以下几个构造函数:

- HashMap():构造一个默认初始容量(16)、默认负载因子(0.75)的空HashMap。

```java
Map map = new HashMap();
```

- HashMap(int initialCapacity):构造指定初始容量、默认负载因子的空HashMap。

```java
Map map = new HashMap(10);
```

- HashMap(int initialCapacity, float loadFactor):构造指定初始容量、指定负载因子的空HashMap。

```java
Map map = new HashMap(10, 0.8f);
```

- HashMap(Map<? extends K, ? extends V> m):构造一个包含指定Map元素的HashMap。

```java
Map<String, Integer> map1 = new HashMap<>();
map1.put("a", 1);
map1.put("b", 2);

// 用已有Map构造新Map
Map<String, Integer> map2 = new HashMap<>(map1); 
```

### 3.5 EnumMap
如果作为key的对象是enum类型，可以直接使用 EnumMap，其根据enum类型的key直接定位到内部数组的索引，并不需要计算hashCode()，不但效率最高，而且没有额外的空间浪费。

```java
import java.time.DayOfWeek;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<DayOfWeek, String> map = new EnumMap<>(DayOfWeek.class);
        map.put(DayOfWeek.MONDAY, "星期一");
        map.put(DayOfWeek.TUESDAY, "星期二");
        map.put(DayOfWeek.WEDNESDAY, "星期三");
        map.put(DayOfWeek.THURSDAY, "星期四");
        map.put(DayOfWeek.FRIDAY, "星期五");
        map.put(DayOfWeek.SATURDAY, "星期六");
        map.put(DayOfWeek.SUNDAY, "星期日");
        System.out.println(map);
        System.out.println(map.get(DayOfWeek.MONDAY));
    }
}
```

### 3.6 TreeMap
```java
       ┌───┐
       │Map│
       └───┘
         ▲
    ┌────┴─────┐
    │          │
┌───────┐ ┌─────────┐
│HashMap│ │SortedMap│
└───────┘ └─────────┘
               ▲
               │
          ┌─────────┐
          │ TreeMap │
          └─────────┘
```
注: SortedMap是接口，它的实现类是TreeMap。SortedMap保证遍历时以Key的顺序来进行排序。

使用TreeMap时，放入的Key必须实现Comparable接口(注: TreeMap不使用equals()和hashCode())。如果作为Key的class没有实现Comparable接口，那么，必须在创建TreeMap时同时指定一个自定义排序算法：

```java
Map<Person, Integer> map = new TreeMap<>(new Comparator<Person>() {
    public int compare(Person p1, Person p2) {
        return p1.name.compareTo(p2.name);
    }
});

Map<Student, Integer> map = new TreeMap<>(new Comparator<Student>() {
    public int compare(Student p1, Student p2) {
        return Integer.compare(p1.score, p2.score);
    }
});
```

#### TreeMap 构造函数
Java中的TreeMap主要有以下几个构造函数:

- TreeMap():构造一个空的TreeMap,按键的自然顺序排序。

```java
TreeMap map = new TreeMap(); 
```

- TreeMap(Comparator<? super K> comparator):构造一个空的TreeMap,按指定比较器排序。

```java
TreeMap map = new TreeMap(comparator);
```

- TreeMap(Map<? extends K, ? extends V> m):使用指定Map构造一个新的TreeMap。

```java 
Map m = new HashMap();
TreeMap map = new TreeMap(m);
```

- TreeMap(SortedMap<K, ? extends V> m):使用SortedMap构造TreeMap。

```java
SortedMap m = new TreeMap();
TreeMap map = new TreeMap(m); 
```

## 4. Set
### 4.1 Set 接口
Java Set接口主要实现的方法如下:

| 方法 | 描述 |
|-|-|
| add(E e) | 添加元素到Set中 |
| clear() | 移除Set中的所有元素 |
| contains(Object o) | 判断Set是否包含指定元素 |
| isEmpty() | 判断Set是否为空 |
| iterator() | 返回对Set的迭代器 |
| remove(Object o) | 从Set中移除指定元素 | 
| size() | 返回Set中的元素个数 | 
| toArray() | 返回包含Set中所有元素的数组 |
| equals(Object o) | 判断两个Set是否相等 |
| hashCode() | 返回Set的哈希值 |

### 4.2 Set接口实现类
```shell
       ┌───┐
       │Set│
       └───┘
         ▲
    ┌────┴─────┐
    │          │
┌───────┐ ┌─────────┐
│HashSet│ │SortedSet│
└───────┘ └─────────┘
               ▲
               │
          ┌─────────┐
          │ TreeSet │
          └─────────┘
```

实现上:
1. HashSet 仅仅是对 HashMap 的一个简单封装
1. TreeSet 仅仅是对 TreeMap 的一个简单封装

## 5. Queue
### 5.1 Queue 接口
Java Queue接口主要实现的方法如下:

| 方法 | 描述 |
|-|-|  
| add(E e)   | 将元素插入队尾，失败触发异常 |
| offer(E e) | 将元素插入队尾，失败返回false |
| remove()   | 移除并返回队头元素，队列空触发异常 |
| poll()     | 移除并返回队头元素，队列空返回null | 
| element()  | 返回但不移除队头元素，队列空触发异常 |
| peek()     | 返回但不移除队头元素，队列空返回null |
| put(E e)   | 添加元素到队尾,可能会阻塞 |
| take()     | 移除队头并返回元素,可能会阻塞 |
| isEmpty()  | 判断队列是否为空 |
| size()     | 返回队列元素个数 |

### 5.2 Queue 接口实现类
Java中常见的Queue接口实现类包括:

| 实现类 | 说明 |
|-|-|
| LinkedList       | 基于双向链表的FIFO队列 |
| ArrayDeque       | 基于数组的FIFO双端队列 |
| PriorityQueue    | 基于优先级堆的优先级队列 |
| DelayQueue       | 支持延时获取元素的阻塞队列 |
| SynchronousQueue | 不存储元素的阻塞队列 |
| LinkedBlockingQueue | 基于链表的有界阻塞队列 |
| ArrayBlockingQueue  | 基于数组的有界阻塞队列 | 

#### LinkedList
LinkedList即实现了List接口，又实现了Queue接口:

```java
// 这是一个List:
List<String> list = new LinkedList<>();
// 这是一个Queue:
Queue<String> queue = new LinkedList<>();
```

#### PriorityQueue
要使用PriorityQueue，我们就必须给每个元素定义“优先级”。因此，放入PriorityQueue的元素，必须实现Comparable接口。

在Java中,PriorityQueue主要有以下构造函数:

- PriorityQueue():创建一个默认初始容量(11)、默认排序比较器的空优先级队列。

```java
Queue q = new PriorityQueue(); 
```

- PriorityQueue(int initialCapacity):指定优先级队列的初始容量。

```java
Queue q = new PriorityQueue(20);
```

- PriorityQueue(Comparator<? super E> comparator):使用指定的比较器构造优先级队列。

```java  
Queue q = new PriorityQueue(comparator);
Queue<User> q = new PriorityQueue<>(new Comparator(){
    public int compare(User u1, User u2) {
        if (u1.number.charAt(0) == u2.number.charAt(0)) {
            // 如果两人的号都是A开头或者都是V开头,比较号的大小:
            return u1.number.compareTo(u2.number);
        }
        if (u1.number.charAt(0) == 'V') {
            // u1的号码是V开头,优先级高:
            return -1;
        } else {
            return 1;
        }
    }
});
```

- PriorityQueue(Collection<? extends E> c):使用指定集合的元素构造优先级队列。

```java
Collection c = new ArrayList();
Queue q = new PriorityQueue(c);
```

- PriorityQueue(PriorityQueue<? extends E> c):使用EXISTING优先级队列构造新队列。

```java
Queue q1 = new PriorityQueue();
Queue q2 = new PriorityQueue(q1); 
```

## 6. Deque
双端队列（Double Ended Queue）。

### 6.1 Deque 接口
Deque 接口实际上扩展自Queue：

```java
public interface Deque<E> extends Queue<E> {
    ...
}
```

它们出队和入队方法的对比如下:

| 操作 | Queue | Deque |
|-|-|-|  
| 入队     | add(e)/offer(e) | addLast(e)/offerLast(e) | 
| 入队头部 | 不支持           | addFirst(e)/offerFirst(e) |
| 出队     | remove()/poll()  | removeFirst()/pollFirst() |
| 出队尾部 | 不支持           | removeLast()/pollLast() |
| 检查队头 | element()/peek() | getFirst()/peekFirst() |
| 检查队尾 | 不支持           | getLast()/peekLast() |


Deque 扩展自Queue，Queue提供的add()/offer()方法在Deque中也可以使用，但是使用Deque，最好不要调用offer()，这样更符合语义。

#### 6.2 Deque 实现类

Java中Deque接口的常见实现类可总结为:

| 实现类 | 特点 |
|-|-|  
| ArrayDeque | 基于数组,无界限,高效 |
| LinkedList | 基于双向链表,灵活多用途 |
| ConcurrentLinkedDeque | 线程安全并发队列 |
| LinkedBlockingDeque | 基于链表的双端阻塞队列 | 
| ArrayBlockingQueue | 基于数组的有界阻塞队列 |
| PriorityBlockingDeque | 支持优先级排序的阻塞队列 |

- ArrayDeque、LinkedList用于非阻塞队列
- ConcurrentLinkedDeque支持并发
- LinkedBlockingDeque、ArrayBlockingQueue提供阻塞机制
- PriorityBlockingDeque支持优先级

LinkedList真是一个全能选手，它即是List，又是Queue，还是Deque。

### 6.3 Stack
Java的集合类没有单独的Stack接口，因为有个遗留类名字就叫Stack。所以没办法创建Stack接口，只能用Deque接口来“模拟”一个Stack了。

## 7. Iterator(迭代器)
集合类型都实现了 Iterable 接口。在Java中,Iterable接口定义如下:

```java
public interface Iterable<T> {

    // 返回一个Iterator用于遍历该元素集合
    Iterator<T> iterator();

}
```

Iterable是一个表示可以被迭代的集合类型的泛型接口。其中的iterator()方法需要返回一个Iterator对象,用于遍历该集合中的元素。

### 7.1 Iterator
在Java中,Iterator对象表示一个可以遍历集合的迭代器,它的主要定义是:

```java
public interface Iterator<E> {

  // 如果存在下一个元素,返回true
  boolean hasNext();

  // 返回下一个元素
  E next();
  
  // 移除当前返回的元素
  void remove(); (optional)

  // 更多默认方法如forEachRemaining等
}
```

### 7.2 for-each
只要一个类实现了Iterable接口，就能使用 for-each循环，编译器会把for each循环通过 Iterator 改写为了普通的for循环:

```java
for (String s : list) {
    System.out.println(s);
}

for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
     String s = it.next();
     System.out.println(s);
}
```

## 8. Collections 
Collections是JDK提供的工具类，同样位于java.util包中。它提供了一系列静态方法，能更方便地操作各种集合。

Java Collections工具类主要定义了以下 utility方法:

| 方法 | 作用 |
|-|-|  
| sort(List) | 对List进行排序 |
| reverse(List) | 反转List中的元素顺序 |
| shuffle(List) | 随机重组List中的顺序 |
| rotate(List, k) | 将List循环轮转k步 |
| swap(List, i, j) | 交换List中两个元素位置 |
| min(Collection) | 获取元素最小值 |
| max(Collection) | 获取元素最大值 |
| frequency(Collection, obj) | 获取obj在集合出现次数 |
| disjoint(List1, List2) | 判断集合是否不包含相同元素 |
| binarySearch(List, key) | 对有序List进行二分查找 |
| copy(List dest, List src) | 复制一个List到另一个List |
