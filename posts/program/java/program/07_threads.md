---
weight: 1
title: "Java 多线程"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 多线程"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Thread
### 1.1 Thread 的定义

```java
public class Thread implements Runnable {
    // 构造函数
    public Thread();
    public Thread(String name);
    public Thread(Runnable target);
    public Thread(Runnable target, String name);

    // 启动线程
    public synchronized void start();

    // 线程执行的主体方法，需要在子类中实现
    public void run();

    // 休眠当前线程指定的毫秒数
    public static void sleep(long millis) throws InterruptedException;

    // 等待线程执行结束
    public final void join() throws InterruptedException;

    // 中断线程的执行
    public void interrupt();

    // 判断线程是否处于活动状态
    public final boolean isAlive();

    // 获取线程的名称
    public final String getName();

    // 获取线程的优先级
    public final int getPriority();

    // 设置线程的优先级
    public final void setPriority(int newPriority);

    // 获取当前正在执行的线程对象的引用
    public static Thread currentThread();

    // ...
    // 其他方法和内部实现省略
}
```

### 1.2 Thread 的构造函数
在 Java 中，`Thread` 类提供了几个不同的构造函数，用于创建新的线程。以下是 `Thread` 类的几种常用的构造函数：

1. `Thread()`
   - 创建一个新的线程对象，没有指定线程名称，默认使用"Thread-X"（X 是线程的序号）作为名称。

2. `Thread(String name)`
   - 创建一个新的线程对象，并指定线程名称为给定的名称。

3. `Thread(Runnable target)`
   - 创建一个新的线程对象，并将给定的 `Runnable` 对象作为线程的执行目标。线程的名称由默认分配。

4. `Thread(Runnable target, String name)`
   - 创建一个新的线程对象，并将给定的 `Runnable` 对象作为线程的执行目标，同时指定线程名称。

5. `Thread(ThreadGroup group, Runnable target)`
   - 创建一个新的线程对象，并将给定的 `Runnable` 对象作为线程的执行目标，同时指定线程所属的线程组。

6. `Thread(ThreadGroup group, Runnable target, String name)`
   - 创建一个新的线程对象，并将给定的 `Runnable` 对象作为线程的执行目标，指定线程所属的线程组，以及线程名称。

7. `Thread(ThreadGroup group, Runnable target, String name, long stackSize)`
   - 创建一个新的线程对象，将给定的 `Runnable` 对象作为线程的执行目标，指定线程所属的线程组，线程名称，以及线程的堆栈大小。

注意：在 Java 中，推荐使用实现 `Runnable` 接口的方式来创建线程，以避免单继承的限制，提高代码的灵活性。

以下是一个示例，展示如何使用不同的构造函数创建线程：

```java
// 从Thread派生一个自定义类，然后覆写run()方法
class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("start new thread!");
    }
}

// 创建Thread实例时，传入一个Runnable实例：
public class MyRunnable implements Runnable {
    public void run() {
        System.out.println(Thread.currentThread().getName() + " is running.");
    }
}

public class Main {
    public static void main(String[] args) {
        Thread thread1 = new Thread();
        Thread thread2 = new Thread("CustomThread");
        Thread thread3 = new Thread(new MyRunnable());
        Thread thread4 = new Thread(new MyRunnable(), "RunnableThread");

        thread1.start();
        thread2.start();
        thread3.start();
        thread4.start();
    }
}
```

### 1.3 线程状态
用一个状态转移图表示如下：
```java

         ┌─────────────┐
         │     New     │
         └─────────────┘
                │
                ▼
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
 ┌─────────────┐ ┌─────────────┐
││  Runnable   │ │   Blocked   ││
 └─────────────┘ └─────────────┘
│┌─────────────┐ ┌─────────────┐│
 │   Waiting   │ │Timed Waiting│
│└─────────────┘ └─────────────┘│
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                │
                ▼
         ┌─────────────┐
         │ Terminated  │
         └─────────────┘
```

1. New：新创建的线程，尚未执行；
2. Runnable：运行中的线程，正在执行run()方法的Java代码；
3. Blocked：运行中的线程，因为某些操作被阻塞而挂起；
4. Waiting：运行中的线程，因为某些操作在等待中；
5. Timed Waiting：运行中的线程，因为执行sleep()方法正在计时等待；
6. Terminated：线程已终止，因为run()方法执行完毕。

### 1.4 中断线程
中断线程有两种方法:
1. 对目标线程调用 interrupt() 方法
2. 通过线程共享变量，设置标志位

#### interrupt
下面是使用 interrupt 的示例：

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread t = new MyThread();
        t.start();
        Thread.sleep(1000);
        t.interrupt(); // 中断t线程
        t.join(); // 等待t线程结束
        System.out.println("end");
    }
}

class MyThread extends Thread {
    public void run() {
        Thread hello = new HelloThread();
        hello.start(); 
        try {
            // 注意点 1
            hello.join(); // MyThread 已经阻塞
        } catch (InterruptedException e) {
            System.out.println("interrupted!");
        }
       // 注意点 3: 在 MyThread 线程结束前，对 hello 线程也进行了interrupt()调用通知其中断
        hello.interrupt();
    }
}

class HelloThread extends Thread {
    public void run() {
        int n = 0;
        // 注意点二
        while (!isInterrupted()) {
            n++;
            System.out.println(n + " hello!");
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                break;
            }
        }
    }
}

```

在使用 interrupt 方法时有几个注意点:
1. MyThread 被 hello.join() 方法阻塞，调用 MyThread.interrupt() 方法，hello.join() 方法会立刻抛出 InterruptedException 
2. 线程要正常中断，目标线程需要反复检测自身状态是否是 interrupted 状态，如果是，就立刻结束运行
3. 在 MyThread 线程结束前，对 hello 线程也需要调用 interrupt() 通知其中断

#### 共享变量
另一个常用的中断线程的方法是设置标志位:

```java
public class Main {
    public static void main(String[] args)  throws InterruptedException {
        HelloThread t = new HelloThread();
        t.start();
        Thread.sleep(1);
        t.running = false; // 标志位置为false
    }
}

class HelloThread extends Thread {
    public volatile boolean running = true;
    public void run() {
        int n = 0;
      // 线程内也需要检测标志位
        while (running) {
            n ++;
            System.out.println(n + " hello!");
        }
        System.out.println("end!");
    }
}
```

线程间共享变量，需要使用 使用 volatile 关键字标记。在Java中,volatile是一种变量修饰符,它具有以下特点:

1. volatile变量会强制从主内存读取值,而不是缓存一份副本。
2. 对volatile变量的写操作会立即刷新到主内存。
3. 可以避免线程从本地缓存中读取脏数据。
4. 可以保证可见性和有序性,但不提供原子性。
5. 适用于一个写线程,多个读线程的场景。

具体来说,使用volatile能够:
- 保证多线程变量的可见性,一个线程修改了某变量,其他线程立即可见。
- 禁止指令重排序优化,保证有序性。
- 保证不会读取到旧的数据值。

但volatile不会保证操作的原子性。对于需要原子读写的场景,仍需使用synchronized或原子类来保证。所以volatile是轻量级的同步机制,它在保证可见性、有序性方面有一定的作用,但不能替代synchronized互斥锁的同步功能。

## 2. 线程同步
### 2.1 synchronized
Java 程序使用 synchronized 实现多线程之间的同步互斥。按照同步的粒度 synchronized 有如下几种使用方式:

1. 对象锁,作用于实例方法: 

```java
public class MyClass {

  public synchronized void method() {
    // 临界区 
  } 

}
```

2. 代码块锁,作用于同步代码块: 

```java 
public void method() {

  synchronized(this) {
    // 同步代码块
  }

}
```

3. 静态方法锁: 

```java
public synchronized static void method() {
  // 静态方法同步 
}
``` 

4. Class锁:

```java
synchronized(MyClass.class) {
  // 对整个MyClass互斥
} 
```

最后，JVM允许同一个线程重复获取同一个锁，这种能被同一个线程反复获取的锁，就叫做可重入锁。

#### 不需要 synchronized 的操作
JVM规范定义了几种原子操作：
1. 基本类型（long和double除外）赋值，例如：`int n = m`；
2. 引用类型赋值，例如：`List<String> list = anotherList`

long 和 double 是64位数据，JVM 没有明确规定64位赋值操作是不是一个原子操作，不过在x64平台的JVM是把long和double的赋值作为原子操作实现的。

### 2.2 wait/notify
在Java中,wait()和notify/notifyAll()是Object类的两个重要方法,用于线程之间的协调通信。

- wait():使当前线程等待,直到另一个线程调用notify/notifyAll()唤醒。
- notify():唤醒正在该对象监视器上等待的单个线程。
- notifyAll():唤醒正在该对象监视器上等待的所有线程。

它们的使用注意点包括:

- 需要在同步块(synchronized)或者方法中使用,并持有对象锁。
- 调用wait()的线程会释放对象锁,进入等待队列。
- 调用notify/notifyAll()的线程必须拥有对象锁。
- notify只会唤醒单个等待线程,不确定是哪个。
- wait()/notify()依赖于对象监视器,仅针对同一个对象锁有效。
- 等待线程被唤醒后需要重新获取对象锁才能继续执行。

它们都是线程间协作的基础,可以用来实现生产者-消费者等模式。但需要配合对象锁使用,才能避免虚假唤醒等问题。

```java
class TaskQueue {
    Queue<String> queue = new LinkedList<>();

    public synchronized void addTask(String s) {
        this.queue.add(s);
        this.notifyAll();
    }

    public synchronized String getTask() throws InterruptedException {
        while (queue.isEmpty()) {
            this.wait();
        }
        return queue.remove();
    }
}

```

### 2.3 Condition
使用Condition对象来实现wait和notify的功能。

```java
class TaskQueue {
    private final Lock lock = new ReentrantLock();
   //  引用的Condition对象必须从Lock实例的newCondition()返回，这样才能获得一个绑定了Lock实例的Condition实例
    private final Condition condition = lock.newCondition();
    private Queue<String> queue = new LinkedList<>();

    public void addTask(String s) {
        lock.lock();
        try {
            queue.add(s);
            condition.signalAll();
        } finally {
            lock.unlock();
        }
    }

    public String getTask() {
        lock.lock();
        try {
            while (queue.isEmpty()) {
               //  wait 之前必须获取锁
                condition.await();
            }
            return queue.remove();
        } finally {
            lock.unlock();
        }
    }
}
```

Java Condition类的主要方法:

| 方法 | 说明 |
|-|-|  
| await() | 使线程等待,释放锁 | 
| awaitUninterruptibly() | 等待,不响应中断 |
| awaitNanos(long nanosTimeout) | 超时等待 |
| awaitUntil(Date deadline) | 截止日期等待 |
| signal() | 唤醒一个等待线程 |
| signalAll() | 唤醒所有等待线程 |
| getWaitQueueLength() | 获取等待队列长度 |
| awaitTermination(long timeout, TimeUnit unit) | 等待condition终止 |

Condition的主要作用就是使线程等待,等待被其他线程的signal/signalAll方法唤醒。

相比object的wait/notify:

- Condition必须与Lock绑定使用。
- 支持多个Condition实例。  
- 条件等待和唤醒更加灵活。

Condition使线程协调通信变得更高级和灵活。但也需要更小心的处理锁的获取与释放。

### 2.4 ReadWriteLock
```java
public class Counter {
    private final ReadWriteLock rwlock = new ReentrantReadWriteLock();
    private final Lock rlock = rwlock.readLock();
    private final Lock wlock = rwlock.writeLock();
    private int[] counts = new int[10];
}
```

### 2.5 StampedLock
在Java中,StampedLock是一种新的乐观读写锁,主要有以下特点:

1. StampedLock支持三种模式的锁:写锁、读锁和乐观读。
2. 获取读锁或乐观读锁时,不会阻塞其他线程获取读锁,提高了并发读性能。
3. 获取写锁时,会排他阻塞其他写锁和读锁。
4. 获取乐观读锁时,会返回一个stamp戳,可以用来校验数据一致性。
5. 支持tryOptimisticRead()方法获取乐观读锁,如果校验失败可以升级为读锁或写锁。
6. 可以将读锁转成写锁,提高写入并发能力。

StampedLock API:
- readLock()/unlockRead() 获取读锁
- writeLock()/unlockWrite() 获取写锁
- tryOptimisticRead() 获取乐观读锁
- validate(stamp) 校验stamp 
- tryConvertToWriteLock(stamp) 将读锁转为写锁

StampedLock通过分离读写锁,以及增加乐观读提供了一种更加灵活的锁机制。在读多写少的场景中可以大大提高并发性能。

```java
public class Point {
    private final StampedLock stampedLock = new StampedLock();

    private double x;
    private double y;

    public void move(double deltaX, double deltaY) {
        long stamp = stampedLock.writeLock(); // 获取写锁
        try {
            x += deltaX;
            y += deltaY;
        } finally {
            stampedLock.unlockWrite(stamp); // 释放写锁
        }
    }

    public double distanceFromOrigin() {
        long stamp = stampedLock.tryOptimisticRead(); // 获得一个乐观读锁
        // 注意下面两行代码不是原子操作
        // 假设x,y = (100,200)
        double currentX = x;
        // 此处已读取到x=100，但x,y可能被写线程修改为(300,400)
        double currentY = y;
        // 此处已读取到y，如果没有写入，读取是正确的(100,200)
        // 如果有写入，读取是错误的(100,400)
        if (!stampedLock.validate(stamp)) { // 检查乐观读锁后是否有其他写锁发生
            stamp = stampedLock.readLock(); // 获取一个悲观读锁
            try {
                currentX = x;
                currentY = y;
            } finally {
                stampedLock.unlockRead(stamp); // 释放悲观读锁
            }
        }
        return Math.sqrt(currentX * currentX + currentY * currentY);
    }
}
```

## 3. concurrent
java.util.concurrent包是Java中提供并发编程功能的核心包,它包含了以下常用的并发工具类:

- Executor 框架:线程池相关类,如Executor,ExecutorService,ThreadPoolExecutor等。
- Atomic 原子类:提供原子操作的Integer,Long等原子类。 
- Locks 锁:显式锁相关类,如ReentrantLock,ReentrantReadWriteLock,Condition等。
- Concurrent Collections:并发容器和集合,如ConcurrentHashMap,CopyOnWriteArrayList等。
- Semaphores:信号量Semaphore类,用于控制同时访问的线程个数。
- CountDownLatch:倒计数器,可以实现线程之间的等待通知。
- Callable 和 Future:提交异步任务的接口和表示异步计算结果的类。
- BlockingQueue:阻塞队列,如ArrayBlockingQueue, LinkedBlockingQueue等。
- ThreadLocal:线程局部变量。

### 3.1 线程安全的集合
java.util.concurrent包提供的线程安全的集合:

| 数据结构 | 说明 |
|-|-| 
| ConcurrentHashMap | 线程安全的HashMap |
| CopyOnWriteArrayList | 线程安全的List,适合读多写少场景 |
| CopyOnWriteArraySet | 线程安全的Set |
| ConcurrentLinkedQueue | 线程安全的链表队列 |
| LinkedBlockingQueue | 阻塞链表队列 | 
| ArrayBlockingQueue | 固定大小的阻塞数组队列 |
| PriorityBlockingQueue | 支持优先级的阻塞队列 |
| DelayQueue | 支持延时获取元素的阻塞队列 |
| LinkedTransferQueue | 链表结构的无界阻塞TransferQueue |
| LinkedBlockingDeque | 双端阻塞队列 |
| ConcurrentSkipListMap | 跳表实现的并发Map |
| ConcurrentSkipListSet | 跳表实现的并发Set |

### 3.2 原子操作
java.util.concurrent包提供了原子操作封装类:

| 类名 | 说明 |
|-|-|
| AtomicInteger | 原子化更新整型的类 | 
| AtomicLong | 原子化更新长整型的类 |
| AtomicBoolean | 原子化更新布尔类型的类 |
| AtomicReference | 原子化更新引用类型的类 |
| AtomicMarkableReference | 原子更新带有标记位的引用类型 |
| AtomicStampedReference | 原子更新带有版本号的引用类型 |  
| AtomicIntegerFieldUpdater | 原子更新整型字段的工具类 |
| AtomicLongFieldUpdater | 原子更新长整型字段的工具类 |
| AtomicReferenceFieldUpdater | 原子更新引用类型字段的工具类 |

### 3.3 线程池
Java标准库提供了ExecutorService接口表示线程池。`java.util.concurrent.ExecutorService` 接口是 Java 并发编程中用于管理和执行线程的高级接口之一。它是 `Executor` 接口的子接口，提供了更丰富的功能，允许您管理线程的生命周期以及执行异步任务。`ExecutorService` 接口定义如下：

```java
public interface ExecutorService extends Executor {
    
    // 提交一个任务以供执行，并返回一个表示该任务的未来结果的 Future
    <T> Future<T> submit(Callable<T> task);
    
    // 提交一个可运行任务以供执行，并返回一个表示该任务的未来结果的 Future
    <T> Future<T> submit(Runnable task, T result);
    
    // 提交一个可运行任务以供执行，并返回一个表示该任务的未来结果的 Future
    Future<?> submit(Runnable task);
    
    // 执行所有提交的任务，并返回一个表示这些任务的 Future 列表
    <T> List<Future<T>> invokeAll(Collection<? extends Callable<T>> tasks)
            throws InterruptedException;
    
    // 执行所有提交的任务，并返回一个表示已成功完成的任务的 Future 列表
    <T> List<Future<T>> invokeAll(Collection<? extends Callable<T>> tasks, long timeout, TimeUnit unit)
            throws InterruptedException;
    
    // 执行提交的任务，并返回一个表示已成功完成的任务的 Future
    <T> T invokeAny(Collection<? extends Callable<T>> tasks)
            throws InterruptedException, ExecutionException;
    
    // 执行提交的任务，并返回一个表示已成功完成的任务的 Future
    <T> T invokeAny(Collection<? extends Callable<T>> tasks, long timeout, TimeUnit unit)
            throws InterruptedException, ExecutionException, TimeoutException;
    
    // 关闭执行器，不再接受新任务，但会等待已经提交的任务执行完成
    void shutdown();
    
    // 关闭执行器，不再接受新任务，试图停止正在执行的任务，不等待它们完成
    List<Runnable> shutdownNow();
    
    // 判断执行器是否已经关闭
    boolean isShutdown();
    
    // 判断所有任务是否已经完成（包括已提交但尚未完成的任务）
    boolean isTerminated();
    
    // 等待所有任务完成（包括已提交但尚未完成的任务）或者等待超时
    boolean awaitTermination(long timeout, TimeUnit unit)
            throws InterruptedException;
}
```

Java 中常用的 ExecutorService 接口实现类:

| 实现类 | 说明 |
|-|-|
| ThreadPoolExecutor | 最常见的线程池,可配置参数最多 |
| ScheduledThreadPoolExecutor | 支持定时和周期任务执行 |  
| ForkJoinPool | 支持“分治”任务的线程池 |
| Executors.newCachedThreadPool() | 无界线程池,可伸缩 |
| Executors.newFixedThreadPool(n) | 固定大小线程池 |
| Executors.newSingleThreadExecutor() | 单线程化的线程池 |
| Executors.newScheduledThreadPool(n) | 创建定时线程池 |  
| CompletionService | 封装任务提交和结果获取 |
| ExecutorCompletionService | CompletionService默认实现 |

### 3.4 Future
线程池中我们提交的任务只需要实现Runnable接口，Runnable接口有个问题，它的方法没有返回值。所以，Java标准库还提供了一个Callable接口，和Runnable接口比，它多了一个返回值：

```java
class Task implements Callable<String> {
    public String call() throws Exception {
        return longTimeCalculation(); 
    }
}
```

`Future<T> submit(Callable<T> task);` 返回一个Future类型:

```java
ExecutorService executor = Executors.newFixedThreadPool(4); 
// 定义任务:
Callable<String> task = new Task();
// 提交任务并获得Future:
Future<String> future = executor.submit(task);
// 从Future获取异步执行返回的结果:
String result = future.get(); // 可能阻塞
```

`Future<V>` 接口表示一个未来可能会返回的结果。`Future` 接口定义如下：

```java
public interface Future<V> {

    // 检查任务是否已经完成
    boolean isDone();

    // 取消任务的执行，如果任务已经开始执行则不会被取消
    boolean cancel(boolean mayInterruptIfRunning);

    // 检查任务是否被取消
    boolean isCancelled();

    // 获取任务的执行结果，如果任务尚未完成则阻塞直到任务完成
    V get() throws InterruptedException, ExecutionException;

    // 获取任务的执行结果，如果任务尚未完成则阻塞直到任务完成，或者等待超时
    V get(long timeout, TimeUnit unit) throws InterruptedException, ExecutionException, TimeoutException;
}
```

`Future` 接口提供了以下主要方法：

- `isDone()`：检查任务是否已经完成。如果任务已经完成，无论是正常完成、异常完成还是被取消，都会返回 `true`。
- `cancel(boolean mayInterruptIfRunning)`：取消任务的执行。如果任务已经开始执行，根据 `mayInterruptIfRunning` 参数的值，可能会尝试中断正在执行的任务。如果任务已经完成或已经被取消，取消操作将失败。
- `isCancelled()`：检查任务是否被取消。如果任务被取消，返回 `true`。
- `get()`：获取任务的执行结果。如果任务尚未完成，则该方法会阻塞当前线程，直到任务完成，并返回任务的结果。如果任务抛出异常，`get()` 方法会将异常包装在 `ExecutionException` 中抛出。
- `get(long timeout, TimeUnit unit)`：获取任务的执行结果，可以设置等待的最长时间。如果任务在指定的时间内完成，会返回结果；如果超时，会抛出 `TimeoutException` 异常。

### 3.5 CompletableFuture
使用Future获得异步执行结果时，要么调用阻塞方法get()，要么轮询看isDone()是否为true，这两种方法都不是很好，因为主线程也会被迫等待。从Java 8开始引入了CompletableFuture，可以传入回调对象，当异步任务完成或者发生异常时，自动调用回调对象的回调方法。它主要提供了以下功能:

1. 创建异步任务:可以通过runAsync、supplyAsync工厂方法创建CompletableFuture,在线程池中执行计算任务。
2. 组合任务:可以将独立的异步任务组合起来,形成Complex Workflow。
3. 响应计算结果:可以通过thenApply、thenAccept等方法处理计算结果。
4. 处理异常:可以通过 exceptionally 等方法处理计算过程中的异常。
5. 聚合结果:可以将多个CompletableFuture的计算结果聚合起来。
6. 等待完成:可以通过get方法等待计算结果。

其关键接口方法有:
- runAsync/supplyAsync: 异步执行Runnable或Callable任务。
- thenApply/thenAccept: 处理正常的计算结果。  
- exceptionally: 处理异常结果。
- thenCombine: 合并结果。
- join/get: 等待结果完成。

CompletableFuture实现了异步编排与链式计算,可以构建异步程序,大大简化了异步编程复杂性。

### 3.6 Fork/Join
Java 7开始引入了一种新的Fork/Join线程池，它可以执行一种特殊的任务：把一个大任务拆成多个小任务并行执行。Java标准库提供的java.util.Arrays.parallelSort(array)可以进行并行排序，它的原理就是内部通过Fork/Join对大数组分拆进行并行排序，在多核CPU上就可以大大提高排序的速度。

### 3.7 ThreadLocal
在Java中,ThreadLocal是一个线程局部变量工具类,它可以为每个线程创建独立的变量副本,实现变量访问的线程隔离。ThreadLocal的主要特点是:

1. 每个线程都可以通过ThreadLocal独立地改变自己的副本,而不会影响其他线程的值。
2. 同一个ThreadLocal所存储的不同线程的变量副本是互相隔离的。
3. 通过get()方法读取变量时,获得的是当前线程所保存的副本值。
4. 设置值时通过set()方法设置当前线程的副本,而其他线程的副本不受影响。
5. 提供remove()方法来删除当前线程的副本值。

主要方法有:

- T get(): 返回当前线程的副本值
- void set(T value): 设置当前线程的副本值
- void remove(): 删除当前线程的副本值

ThreadLocal适用于每个线程需要自己独立的实例且变量需要被线程封闭的场景,很好地解决了并发安全问题。

#### ThreadLocal 使用

```java
static ThreadLocal<User> threadLocalUser = new ThreadLocal<>();
void processUser(user) {
    try {
        threadLocalUser.set(user);
        step1();
        step2();
    } finally {
        threadLocalUser.remove();
    }
}

void step1() {
    User u = threadLocalUser.get();
    log();
    printUser();
}

```

因为线程会被复用，ThreadLocal一定要在finally中清除。

#### AutoCloseable 接口
为了保证能释放ThreadLocal关联的实例，我们可以通过AutoCloseable接口配合try (resource) {...}结构，让编译器自动为我们关闭。

```java
public class UserContext implements AutoCloseable {

    static final ThreadLocal<String> ctx = new ThreadLocal<>();

    public UserContext(String user) {
        ctx.set(user);
    }

    public static String currentUser() {
        return ctx.get();
    }

    @Override
    public void close() {
        ctx.remove();
    }
}

try (var ctx = new UserContext("Bob")) {
    // 可任意调用UserContext.currentUser():
    String currentUser = UserContext.currentUser();
} // 在此自动调用UserContext.close()方法释放ThreadLocal关联对象
```

### 3.8 协程
