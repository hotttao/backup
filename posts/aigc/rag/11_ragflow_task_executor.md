---
weight: 1
title: "RagFlow Task Executor"
date: 2025-08-20T10:00:00+08:00
lastmod: 2025-08-20T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Task Executor"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们介绍了 RagFlow 的框架，启动流程，这一节我们来详细介绍 RagFlow 的核心进程 Task Executor。

## 1. Task Executor
task executor 启动的入口在 `rag/svr/task_executor.py`，启动过程有如下核心步骤:
1. 初始化配置
2. 注册信号量
3. 使用 trio 管理异步任务

在我们详细介绍每一步的使用之前，我们先来简单了解一下 trio。

```python
async def main():
    settings.init_settings()
    print_rag_settings()
    if sys.platform != "win32":
        # 如果不是 Windows 系统，则注册两个自定义信号处理函数
        # SIGUSR1 -> 启动 tracemalloc 并生成内存快照
        # SIGUSR2 -> 停止 tracemalloc
        signal.signal(signal.SIGUSR1, start_tracemalloc_and_snapshot)
        signal.signal(signal.SIGUSR2, stop_tracemalloc)

    # 从环境变量 TRACE_MALLOC_ENABLED 中读取是否启用内存跟踪 (默认 0，即不开启)
    TRACE_MALLOC_ENABLED = int(os.environ.get('TRACE_MALLOC_ENABLED', "0"))
    if TRACE_MALLOC_ENABLED:
        # 如果启用，则立即启动 tracemalloc 并生成一次快照
        start_tracemalloc_and_snapshot(None, None)

    # 注册系统信号处理函数
    # SIGINT  -> 一般是 Ctrl+C 终止程序
    # SIGTERM -> kill 命令发送的终止信号
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 使用 Trio 异步库启动并发任务
    async with trio.open_nursery() as nursery:
        # 启动一个后台任务：周期性上报程序状态
        nursery.start_soon(report_status)
        
        # 主循环：只要 stop_event 未被触发，就持续执行任务
        while not stop_event.is_set():
            # 任务调度控制：获取一个任务执行许可（防止任务过多）
            await task_limiter.acquire()
            # 启动一个新的后台任务：task_manager（负责处理具体任务）
            nursery.start_soon(task_manager)

    # 如果能走到这里，说明逻辑异常（理论上不应该到达）
    logging.error("BUG!!! You should not reach here!!!")

if __name__ == "__main__":
    # 启用 faulthandler，在 Python 崩溃时自动打印 traceback，方便调试
    faulthandler.enable()
    # 初始化日志系统，使用指定的消费者名
    init_root_logger(CONSUMER_NAME)
    # 使用 Trio 事件循环运行 main 协程
    trio.run(main)
```

## 2. Trio 简介

### 2.1 Trio 是什么

* **定义**：Trio 是一个基于 Python `async/await` 语法的异步 I/O 库。
* **设计理念**：提供 *简单*、*可靠*、*符合人类直觉* 的并发模型。
* **目标**：让开发者在写异步代码时 **像写同步代码一样自然**，同时保持健壮性和可维护性。

Trio 的作者是 Nathaniel J. Smith，他的理念是：

> “正确的抽象比追求极限性能更重要，Trio 要让并发编程变得不再痛苦。”

---

### 2.2 Trio 的作用

Trio 主要用于：

1. **高并发任务管理**：比如同时处理大量网络请求、I/O 操作。
2. **后台任务运行**：启动/取消任务更加直观。
3. **受控退出机制**：保证任务可以优雅地结束，不会留“僵尸任务”。
4. **调试/监控**：Trio 在错误传播和异常处理上设计得比 asyncio 更清晰。

---

### 2.3 Trio 相比其他异步库的优势

| 特性       | `asyncio`                     | `gevent`     | `curio`         | **Trio**                     |
| -------- | ----------------------------- | ------------ | --------------- | ---------------------------- |
| **并发模型** | 事件循环 + 任务调度                   | 协程（基于绿色线程）   | 类似 asyncio，但更简洁 | **结构化并发（nursery）**           |
| **错误处理** | 错误可能被吞掉，需要小心                  | 异常传播不自然      | 改进了异常处理         | **异常会自动传播给父任务，防止遗漏**         |
| **任务管理** | `create_task`/`gather` 容易泄露任务 | 协程调度隐式，不透明   | 任务管理简单          | **显式的任务作用域（nursery），防止任务泄露** |
| **易用性**  | 功能多但复杂                        | 语法看似同步，但调试难  | 更轻量，但不活跃        | **API 简洁直观，异常处理更安全**         |
| **生态**   | 内置库，生态最强                      | 在 web 框架中用得多 | 停更趋势            | 社区小众，但越来越被关注                 |

👉 **最大亮点**：

* Trio 提出了 **“结构化并发 (Structured Concurrency)”** 的概念：

  * 任务必须运行在一个明确的作用域（nursery）里。
  * 当作用域退出时，所有子任务必须完成或被取消。
  * 避免了 `asyncio.create_task` 这种“悬空任务”导致的 bug。

---

### 2.4 Trio 的核心用法

#### 基础：运行一个异步函数

```python
import trio

async def hello():
    print("Hello, Trio!")

trio.run(hello)  # 类似 asyncio.run
```

---

#### Nursery：结构化并发

Trio 的核心是 `nursery`（任务托管区）：

```python
import trio

async def child(name, delay):
    await trio.sleep(delay)
    print(f"{name} done")

async def main():
    async with trio.open_nursery() as nursery:
        # 启动两个子任务，它们由 nursery 管理
        nursery.start_soon(child, "task1", 2)
        nursery.start_soon(child, "task2", 1)
    # 退出 with 时，保证所有子任务完成或被取消
    print("All tasks finished")

trio.run(main)
```

✅ **优点**：

* 子任务的生命周期和 `with` 块绑定，防止任务泄露。
* 如果一个子任务报错，错误会传递到 nursery，并取消所有其他子任务。

---

#### 并发通信（通道）

Trio 提供内建的 **高效通道 (Channel)** 来做任务间通信。

```python
import trio

async def sender(send_channel):
    for i in range(3):
        await send_channel.send(i)
    send_channel.close()

async def receiver(receive_channel):
    async for value in receive_channel:
        print("Received:", value)

async def main():
    send_channel, receive_channel = trio.open_memory_channel(0)
    async with trio.open_nursery() as nursery:
        nursery.start_soon(sender, send_channel)
        nursery.start_soon(receiver, receive_channel)

trio.run(main)
```

---

#### 取消和超时控制

Trio 的取消机制非常直观，结合 **CancelScope** 使用：

```python
import trio

async def slow_task():
    await trio.sleep(5)
    print("Done")

async def main():
    with trio.move_on_after(2):  # 超过 2 秒自动取消
        await slow_task()
    print("Task was cancelled")

trio.run(main)
```

---

#### 错误传播

Trio 的 nursery 会自动把子任务错误传播给父任务，保证你不会遗漏异常：

```python
import trio

async def broken():
    raise RuntimeError("Boom!")

async def main():
    async with trio.open_nursery() as nursery:
        nursery.start_soon(broken)
        # 这里不会无限挂起，而是立即收到异常
    print("This will not run")

trio.run(main)  # 会报错 RuntimeError: Boom!
```

---

### 2.5 Trio 的适用场景

* 需要 **高可靠性** 的异步任务管理（比如服务端、后台 worker）
* 对 **调试、异常处理、安全退出** 有要求的项目
* 不想被 asyncio 的“隐式任务”坑到
* 学习结构化并发的最佳选择

---

📌 **一句话总结**：

> Trio 的核心优势是 **结构化并发 + 简洁 API + 强异常安全**，比 asyncio 更直观、更安全，适合需要长期维护、稳定可靠的异步应用。


## 3. Trio 管理的任务
task scheduler 中使用 trio 启动了如下任务:
1. `report_status`: 上报任务执行状态
2. `task_manager`: 从 redis 队列获取 task，执行 task 的处理

ragflow 使用 redis 作为消息中间件:
1. 使用 stream 队列来传递 task
2. 使用 zset 收集和统计任务状态
3. 使用 redis 分布式锁，保证只有一个节点，完成过期状态的清理

### 3.1 redis 队列
我们先回顾一下 redis stream、zset、list 的操作

#### 基于 List 的队列操作（Valkey）

| Redis 命令                      | 作用     | 说明            | Valkey Redis client 对应方法     |
| ----------------------------- | ------ | ------------- | ---------------------------- |
| `LPUSH key value`             | 左端入队   | 将元素插入列表左端（队头） | `r.lpush(key, value)`        |
| `RPUSH key value`             | 右端入队   | 将元素插入列表右端（队尾） | `r.rpush(key, value)`        |
| `LPOP key`                    | 左端出队   | 移除并返回左端元素     | `r.lpop(key)`                |
| `RPOP key`                    | 右端出队   | 移除并返回右端元素     | `r.rpop(key)`                |
| `BLPOP key [key ...] timeout` | 阻塞左端出队 | 阻塞等待元素        | `r.blpop(keys, timeout)`     |
| `BRPOP key [key ...] timeout` | 阻塞右端出队 | 阻塞等待元素        | `r.brpop(keys, timeout)`     |
| `LLEN key`                    | 获取长度   | 列表元素数量        | `r.llen(key)`                |
| `LRANGE key start stop`       | 获取范围   | 查看队列内容        | `r.lrange(key, start, stop)` |

---

#### 基于 Stream 的队列操作（Valkey）

| Redis 命令                                                     | 作用        | 说明            | Valkey Redis client 对应方法                                        |
| ------------------------------------------------------------ | --------- | ------------- | --------------------------------------------------------------- |
| `XADD key * field value`                                     | 写入消息      | 向 Stream 追加消息 | `r.xadd(key, message_dict)`                                     |
| `XREAD COUNT n STREAMS key id`                               | 读取消息      | 从指定 ID 之后读取   | `r.xread(streams={key: id}, count=n)`                           |
| `XREAD BLOCK milliseconds STREAMS key id`                    | 阻塞读取      | 阻塞等待新消息       | `r.xread(streams={key: id}, block=ms)`                          |
| `XGROUP CREATE key groupname id`                             | 创建消费者组    | 用于多消费者共享      | `r.xgroup_create(key, groupname, id)`                           |
| `XREADGROUP GROUP groupname consumer COUNT n STREAMS key id` | 消费消息      | 消费者组读取        | `r.xreadgroup(groupname, consumer, streams={key: id}, count=n)` |
| `XACK key groupname id [id ...]`                             | 确认消息      | 消费完成确认        | `r.xack(key, groupname, ids)`                                   |
| `XPENDING key groupname [start end count] [consumer]`        | 查看待确认     | 未确认消息状态       | `r.xpending(key, groupname)`                                    |
| `XDEL key id [id ...]`                                       | 删除消息      | 删除 Stream 消息  | `r.xdel(key, *ids)`                                             |
| `XTRIM key MAXLEN ~ n`                                       | 修剪 Stream | 保持长度上限        | `r.xtrim(key, maxlen=n, approximate=True)`                      |

---

#### 基于 Sorted Set 的延迟队列（Valkey）

| Redis 命令                             | 作用      | 说明            | Valkey Redis client 对应方法                          |
| ------------------------------------ | ------- | ------------- | ------------------------------------------------- |
| `ZADD key score member`              | 添加任务    | score 作为执行时间戳 | `r.zadd(key, {member: score})`                    |
| `ZRANGE key start stop [WITHSCORES]` | 查询任务    | 获取区间内任务       | `r.zrange(key, start, stop, withscores=True)`     |
| `ZRANGEBYSCORE key min max`          | 获取可执行任务 | score ≤ 当前时间  | `r.zrangebyscore(key, min, max, withscores=True)` |
| `ZREM key member`                    | 移除任务    | 执行完成后删除       | `r.zrem(key, member)`                             |

---

#### 总结

| 队列类型       | 优点              | 适用场景       | Valkey client 特点                     |
| ---------- | --------------- | ---------- | ------------------------------------ |
| List       | 简单、低延迟、阻塞操作     | 单生产者-单消费者  | 直接调用 `lpush/rpush/lpop` 等            |
| Stream     | 消息确认、多消费者组、历史记录 | 高可靠消息队列    | 提供完整 `xadd/xread/xack/xgroup` 方法     |
| Sorted Set | 可延迟、按优先级消费      | 延迟任务、优先级队列 | `zadd/zrangebyscore/zrem` 支持时间/优先级操作 |



### 3.1 report_status

这段代码的主要功能是：

1. **心跳上报**
   * 使用 redis zset 保存心跳信息
   * 周期性把消费者状态（待处理、落后、当前任务等）写入 Redis，方便监控。

2. **过期数据清理**
   * 使用 RedisDistributedLock 去报只有一个进程执行清理操作
   * 删除超过 30 分钟未更新的心跳信息。
   * 删除已经不活跃的任务执行器（基于分布式锁保证不会冲突）。

```python
async def report_status():
    # 声明使用的一些全局变量
    global CONSUMER_NAME, BOOT_AT, PENDING_TASKS, LAG_TASKS, DONE_TASKS, FAILED_TASKS

    # 将当前消费者名称加入 Redis 的集合(set) "TASKEXE"，表示这是活跃的任务执行器之一
    REDIS_CONN.sadd("TASKEXE", CONSUMER_NAME)

    # 创建一个分布式锁，用于在多进程/多机器环境下清理过期任务执行器
    redis_lock = RedisDistributedLock(
        "clean_task_executor", lock_value=CONSUMER_NAME, timeout=60
    )

    # 主循环：每隔一段时间上报状态
    while True:
        try:
            # 获取当前时间
            now = datetime.now()

            # 查询消息队列中该消费者组的状态信息（pending 和 lag）
            group_info = REDIS_CONN.queue_info(get_svr_queue_name(0), SVR_CONSUMER_GROUP_NAME)
            if group_info is not None:
                PENDING_TASKS = int(group_info.get("pending", 0))  # 待处理任务数
                LAG_TASKS = int(group_info.get("lag", 0))          # 消费落后任务数

            # 复制当前正在处理的任务列表，避免修改共享对象
            current = copy.deepcopy(CURRENT_TASKS)

            # 构建心跳信息（JSON），包含消费者状态和统计信息
            heartbeat = json.dumps({
                "name": CONSUMER_NAME,
                "now": now.astimezone().isoformat(timespec="milliseconds"),
                "boot_at": BOOT_AT,
                "pending": PENDING_TASKS,
                "lag": LAG_TASKS,
                "done": DONE_TASKS,
                "failed": FAILED_TASKS,
                "current": current,
            })

            # 将心跳信息存入 Redis zset，score 为当前时间戳
            REDIS_CONN.zadd(CONSUMER_NAME, heartbeat, now.timestamp())
            logging.info(f"{CONSUMER_NAME} reported heartbeat: {heartbeat}")

            # 清理过期心跳信息（超过 30 分钟未更新的记录）
            expired = REDIS_CONN.zcount(CONSUMER_NAME, 0, now.timestamp() - 60 * 30)
            if expired > 0:
                REDIS_CONN.zpopmin(CONSUMER_NAME, expired)

            # 清理过期的任务执行器
            # 先尝试获取分布式锁，保证只有一个消费者在清理
            if redis_lock.acquire():
                # 获取所有活跃的任务执行器
                task_executors = REDIS_CONN.smembers("TASKEXE")
                for consumer_name in task_executors:
                    if consumer_name == CONSUMER_NAME:
                        continue  # 跳过自己
                    # 通过超时间内的心跳次数，如果为 0，表示超时时间内没上报过心跳
                    expired = REDIS_CONN.zcount(
                        consumer_name,
                        now.timestamp() - WORKER_HEARTBEAT_TIMEOUT,  # 超时时间之前
                        now.timestamp() + 10                         # 当前时间稍微宽容一点
                    )
                    if expired == 0:
                        # 如果没有心跳，认为该执行器已过期，删除记录
                        logging.info(f"{consumer_name} expired, removed")
                        REDIS_CONN.srem("TASKEXE", consumer_name)
                        REDIS_CONN.delete(consumer_name)

        except Exception:
            # 捕获所有异常，防止协程退出，并打印异常日志
            logging.exception("report_status got exception")

        finally:
            # 确保释放分布式锁
            redis_lock.release()

        # 异步休眠 30 秒，周期性上报
        await trio.sleep(30)
```

redis 分布式锁实现如下:
1. acquire 方法，执行前先尝试释放锁，是为了刷新 ttl，并且可以负载均衡么？

```python
class RedisDistributedLock:
    def __init__(self, lock_key, lock_value=None, timeout=10, blocking_timeout=1):
        self.lock_key = lock_key
        if lock_value:
            self.lock_value = lock_value
        else:
            self.lock_value = str(uuid.uuid4())
        self.timeout = timeout
        self.lock = Lock(REDIS_CONN.REDIS, lock_key, timeout=timeout, blocking_timeout=blocking_timeout)

    def acquire(self):
        REDIS_CONN.delete_if_equal(self.lock_key, self.lock_value)
        return self.lock.acquire(token=self.lock_value)

    async def spin_acquire(self):
        REDIS_CONN.delete_if_equal(self.lock_key, self.lock_value)
        while True:
            if self.lock.acquire(token=self.lock_value):
                break
            await trio.sleep(10)

    def release(self):
        REDIS_CONN.delete_if_equal(self.lock_key, self.lock_value)

```

### 3.2 task_manager
task_manager 是任务处理过程:
1. collect 用于从 redis stream 队列中获取任务
2. do_handle_task 执行 task
3. set_progress 用于更新 task 进度
4. redis_msg.ack(): 成功处理消息，消息确认

```python
async def handle_task():
    global DONE_TASKS, FAILED_TASKS
    redis_msg, task = await collect()
    if not task:
        await trio.sleep(5)
        return
    try:
        logging.info(f"handle_task begin for task {json.dumps(task)}")
        CURRENT_TASKS[task["id"]] = copy.deepcopy(task)
        await do_handle_task(task)
        DONE_TASKS += 1
        CURRENT_TASKS.pop(task["id"], None)
        logging.info(f"handle_task done for task {json.dumps(task)}")
    except Exception as e:
        FAILED_TASKS += 1
        CURRENT_TASKS.pop(task["id"], None)
        try:
            err_msg = str(e)
            while isinstance(e, exceptiongroup.ExceptionGroup):
                e = e.exceptions[0]
                err_msg += ' -- ' + str(e)
            # 更新 task 进度
            set_progress(task["id"], prog=-1, msg=f"[Exception]: {err_msg}")
        except Exception:
            pass
        logging.exception(f"handle_task got exception for task {json.dumps(task)}")
    redis_msg.ack()

```

#### collect
task 消费位于 RedisDB 的 get_unacked_iterator 方法，返回一个迭代器，每次 yeild 一个 task。

redis stream 消息队列，比较难理解的是 msg_id 的值。
1. PEL 中的消息会记录所属的消费者
2. msg_id 为 0 时，会从 PEL 中开始读取属于自己的消息，或者是 未 ack 的新消息
3. 正常逻辑每次 msg_id=0 即可，但是 task exector 会启动多个 task_manager, 所以需要传入 msg_id 确保不会重复消费其他 task_manager 正在处理的消息。 

```python
class RedisDB:
    def queue_consumer(self, queue_name, group_name, consumer_name, msg_id=b">") -> RedisMsg:
        """https://redis.io/docs/latest/commands/xreadgroup/"""
        for _ in range(3):
            try:

                try:
                    group_info = self.REDIS.xinfo_groups(queue_name)
                    if not any(gi["name"] == group_name for gi in group_info):
                        # 创建队列和消费者组
                        self.REDIS.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                except redis.exceptions.ResponseError as e:
                    if "no such key" in str(e).lower():
                        self.REDIS.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                    elif "busygroup" in str(e).lower():
                        logging.warning("Group already exists, continue.")
                        pass
                    else:
                        raise

                args = {
                    "groupname": group_name,
                    "consumername": consumer_name,
                    "count": 1,
                    "block": 5,
                    "streams": {queue_name: msg_id},
                }
                # 读取消息队列中的消息, xreadgroup 返回值的类型
                # [
                #     (
                #         "mystream",  # Stream 名称
                #         [
                #             ("1692633600000-0", {"task": "A"})  # 消息列表，数量同 count
                #         ]
                #     )
                # ]
                messages = self.REDIS.xreadgroup(**args)
                if not messages:
                    return None
                stream, element_list = messages[0]
                if not element_list:
                    return None
                msg_id, payload = element_list[0]
                res = RedisMsg(self.REDIS, queue_name, group_name, msg_id, payload)
                return res
            except Exception as e:
                if str(e) == 'no such key':
                    pass
                else:
                    logging.exception(
                        "RedisDB.queue_consumer "
                        + str(queue_name)
                        + " got exception: "
                        + str(e)
                    )
                    self.__open__()
        return None

    def get_unacked_iterator(self, queue_names: list[str], group_name, consumer_name):
        try:
            for queue_name in queue_names:
                try:
                    # 获取队列的消费者组信息
                    group_info = self.REDIS.xinfo_groups(queue_name)
                except Exception as e:
                    if str(e) == 'no such key':
                        logging.warning(f"RedisDB.get_unacked_iterator queue {queue_name} doesn't exist")
                        continue
                # 消费者组不存在
                if not any(gi["name"] == group_name for gi in group_info):
                    logging.warning(f"RedisDB.get_unacked_iterator queue {queue_name} group {group_name} doesn't exist")
                    continue
                current_min = 0
                while True:
                    payload = self.queue_consumer(queue_name, group_name, consumer_name, current_min)
                    if not payload:
                        break
                    current_min = payload.get_msg_id()
                    logging.info(f"RedisDB.get_unacked_iterator {queue_name} {consumer_name} {current_min}")
                    yield payload
        except Exception:
            logging.exception(
                "RedisDB.get_unacked_iterator got exception: "
            )
            self.__open__()

```

理解了消息的消费逻辑，我们来看看 collect 的具体执行流程:
1. UNACKED_ITERATOR 属于全局的迭代器，可以保证消息按顺序消费
2. redis 消息中，只保存了 task_id，要获取任务详细参数，需要通过 `TaskService.get_task(msg["id"])`
2. collect 最终返回redis_msg 和 task

```python
async def collect():
    global CONSUMER_NAME, DONE_TASKS, FAILED_TASKS
    global UNACKED_ITERATOR

    svr_queue_names = get_svr_queue_names()
    try:
        if not UNACKED_ITERATOR:
            UNACKED_ITERATOR = REDIS_CONN.get_unacked_iterator(svr_queue_names, SVR_CONSUMER_GROUP_NAME, CONSUMER_NAME)
        try:
            redis_msg = next(UNACKED_ITERATOR)
        except StopIteration:
            for svr_queue_name in svr_queue_names:
                redis_msg = REDIS_CONN.queue_consumer(svr_queue_name, SVR_CONSUMER_GROUP_NAME, CONSUMER_NAME)
                if redis_msg:
                    break
    except Exception:
        logging.exception("collect got exception")
        return None, None

    if not redis_msg:
        return None, None
    # msg 消息负载
    msg = redis_msg.get_message()
    if not msg:
        logging.error(f"collect got empty message of {redis_msg.get_msg_id()}")
        redis_msg.ack()
        return None, None

    canceled = False
    # 获取任务
    task = TaskService.get_task(msg["id"])
    if task:
        # 判断任务是否已经取消
        canceled = has_canceled(task["id"])
    if not task or canceled:
        state = "is unknown" if not task else "has been cancelled"
        FAILED_TASKS += 1
        logging.warning(f"collect task {msg['id']} {state}")
        redis_msg.ack()
        return None, None
    task["task_type"] = msg.get("task_type", "")
    return redis_msg, task

# 任务取消判断
def has_canceled(task_id):
    try:
        if REDIS_CONN.get(f"{task_id}-cancel"):
            return True
    except Exception as e:
        logging.exception(e)
    return False
```

#### do_handle_task
do_handle_task 逻辑比较长，我们放在下一节单独讲解。

## 4. 注册信号量
```python
async def main():
    settings.init_settings()
    print_rag_settings()
    if sys.platform != "win32":
        # 如果不是 Windows 系统，则注册两个自定义信号处理函数
        # SIGUSR1 -> 启动 tracemalloc 并生成内存快照
        # SIGUSR2 -> 停止 tracemalloc
        signal.signal(signal.SIGUSR1, start_tracemalloc_and_snapshot)
        signal.signal(signal.SIGUSR2, stop_tracemalloc)

    # 注册系统信号处理函数
    # SIGINT  -> 一般是 Ctrl+C 终止程序
    # SIGTERM -> kill 命令发送的终止信号
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
```

task_executor 在启动时注册了几个信号量:
1. `signal.SIGINT`, `signal.SIGTERM`: 进程退出的信号量处理
2. `signal.SIGUSR1`, `signal.SIGUSR2`: 调试用信号量，用于生成内存快照

### 4.1 signal_handler
signal_handler 触发任务退出:
1. 触发 stop_event 事件，通知任务执行器退出，nursery 会等待所有协程退出
2. 等待 1s 执行 `sys.exit(0)`

```python
def signal_handler(sig, frame):
    logging.info("Received interrupt signal, shutting down...")
    stop_event.set()
    time.sleep(1)
    sys.exit(0)
```


#### `sys.exit()` 退出流程
`sys.exit(code)` **并不是直接终止进程**。* 它会抛出一个特殊的异常：`SystemExit(code)`。也就是说：

```python
import sys
sys.exit(0)

# 等价于：
raise SystemExit(0)
```

调用 `sys.exit(0)` 时，大致流程如下：

1. **抛出异常**

   * Python 解释器遇到 `sys.exit(0)` → 抛出 `SystemExit(0)`。

2. **异常传播**

   * 如果在当前调用栈里没有被 `try/except` 捕获，异常会层层向上传播。
   * 如果一直没人捕获，最终传递到 Python 主循环（`PyErr_PrintEx`）。

3. **解释器处理 SystemExit**

   * 解释器检测到异常类型是 `SystemExit`：

     * 如果 exit code 是整数 → 作为进程的退出码（`0` 表示成功）。
     * 如果 exit code 是 `None` → 默认退出码为 `0`。
     * 如果 exit code 是字符串 → 打印到 stderr，退出码为 `1`。

4. **执行清理**

   * Python 在退出前会执行清理工作：

     * 调用 `atexit` 注册的函数
     * 清理缓冲区、关闭文件、清理垃圾回收器里的对象
     * 释放模块、执行 `__del__` 方法等

5. **调用底层 C 函数**

   * 最终调用 C 层的 `Py_Exit(status)`，内部会转调到 `os._exit(status)`，真正让操作系统结束进程。


6. **`os._exit()` vs `sys.exit()`**

   * `os._exit()`：立即让进程退出，不做任何清理，不执行 `finally` / `atexit` / 缓冲刷新。
   * `sys.exit()`：先抛异常，允许清理，优雅退出。


### 4.2 tracemalloc
start_tracemalloc_and_snapshot、stop_tracemalloc 用到了 tracemalloc。

`tracemalloc` 是 Python 的内存分析工具:
1. 监控程序中 **内存分配的情况**
2. 找到 **内存泄漏** 或 **异常增长的对象**
3. 定位 **内存占用热点**（哪段代码或哪个函数分配了最多内存）

```python
# SIGUSR1 handler: start tracemalloc and take snapshot
def start_tracemalloc_and_snapshot(signum, frame):
    if not tracemalloc.is_tracing():
        logging.info("start tracemalloc")
        # 开启 tracemalloc 内存跟踪
        tracemalloc.start()
    else:
        logging.info("tracemalloc is already running")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_file = f"snapshot_{timestamp}.trace"
    snapshot_file = os.path.abspath(os.path.join(get_project_base_directory(), "logs", f"{os.getpid()}_snapshot_{timestamp}.trace"))
    # 生成内存快照
    snapshot = tracemalloc.take_snapshot()
    snapshot.dump(snapshot_file)
    # 查看当前内存分配统计
    current, peak = tracemalloc.get_traced_memory()
    if sys.platform == "win32":
        import  psutil
        process = psutil.Process()
        max_rss = process.memory_info().rss / 1024
    else:
        import resource
        max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # rss 是常驻内存包括共享库的大小
    logging.info(f"taken snapshot {snapshot_file}. max RSS={max_rss / 1000:.2f} MB, current memory usage: {current / 10**6:.2f} MB, Peak memory usage: {peak / 10**6:.2f} MB")

# SIGUSR2 handler: stop tracemalloc
def stop_tracemalloc(signum, frame):
    if tracemalloc.is_tracing():
        logging.info("stop tracemalloc")
        # 停止 tracemalloc 内存跟踪
        tracemalloc.stop()
    else:
        logging.info("tracemalloc not running")

```


#### tracemalloc 的主要功能

1. **开启/关闭追踪**

   ```python
   import tracemalloc
   tracemalloc.start()  # 开始追踪内存分配
   tracemalloc.stop()   # 停止追踪
   ```

2. **拍摄快照（Snapshot）**

   * 记录程序某一时刻的内存分配状态

   ```python
   snapshot = tracemalloc.take_snapshot()
   ```

3. **比较快照，分析内存变化**

   ```python
   snapshot1 = tracemalloc.take_snapshot()
   # ... 运行一段代码
   snapshot2 = tracemalloc.take_snapshot()

   top_stats = snapshot2.compare_to(snapshot1, 'lineno')
   for stat in top_stats[:10]:
       print(stat)
   ```

4. **查看当前内存分配统计**

   ```python
   import tracemalloc

   tracemalloc.start()
   # ... 执行代码
   current, peak = tracemalloc.get_traced_memory()
   print(f"当前内存: {current / 1024:.1f} KB, 峰值: {peak / 1024:.1f} KB")
   ```

5. **限制追踪深度**

   ```python
   tracemalloc.start(10)  # 只追踪最近 10 层调用栈
   ```

#### SIGUSR1、SIGUSR2 触发

```bash
kill -SIGUSR1 <pid>
kill -SIGUSR2 <pid>
```

## 5. 初始化配置
### 5.1 配置读取
init_settings 执行初始化配置。首先配置的读取位于 `api/utils/__init__.py`。
1. conf_realpath: 会在项目根目录的 conf 目录下查找配置文件。
2. 优先查找 `local.service_conf.yaml`
3. 在查找 `service_conf.yaml`

```python
CONFIGS = read_config()
SERVICE_CONF = "service_conf.yaml"

def conf_realpath(conf_name):
    conf_path = f"conf/{conf_name}"
    return os.path.join(file_utils.get_project_base_directory(), conf_path)

def read_config(conf_name=SERVICE_CONF):
    local_config = {}
    local_path = conf_realpath(f'local.{conf_name}')

    # load local config file
    if os.path.exists(local_path):
        local_config = file_utils.load_yaml_conf(local_path)
        if not isinstance(local_config, dict):
            raise ValueError(f'Invalid config file: "{local_path}".')

    global_config_path = conf_realpath(conf_name)
    global_config = file_utils.load_yaml_conf(global_config_path)

    if not isinstance(global_config, dict):
        raise ValueError(f'Invalid config file: "{global_config_path}".')

    global_config.update(local_config)
    return global_config
```

### 5.2 默认配置
`conf/service_conf.yaml` 是项目提供的默认配置，配置如下，包括:
1. ragflow: 服务启动配置
2. mysql: mysql 数据库配置
3. minio: MinIO 是一个 开源的对象存储系统，兼容 Amazon S3 API
4. es: elasticsearch 服务配置
5. os: opensearch 服务配置，opensearch 是 es 的开源版本
6. infinity: 向量数据库（Vector Database）
7. redis: redis 配置
8. postgres: postgres 配置，与 mysql 二选一
9. s3，oss，azure: 亚马逊、阿里、微软提供的对象存储（Object Storage）服务
10. opendal:
    - opendal 是一个 开源的数据访问层库（Open Data Access Layer）
    - 统一接口：通过一个统一的 API，就能访问各种存储服务。
    - 多种存储后端：支持本地文件系统、Amazon S3、Google Cloud Storage、Azure Blob、HDFS、WebDAV、HTTP(S) 等。
11. user_default_llm: 使用的大模型配置
12. oauth: OAuth 认证
13. authentication: API 访问和 Web UI 登录的身份认证
14. permission: 权限控制，管理用户对资源的访问权限。
14. smtp: 邮箱配置


```yaml
ragflow:
  host: 0.0.0.0
  http_port: 9380
mysql:
  name: 'rag_flow'
  user: 'root'
  password: 'infini_rag_flow'
  host: 'localhost'
  port: 5455
  max_connections: 900
  stale_timeout: 300
  max_allowed_packet: 1073741824
minio:
  user: 'rag_flow'
  password: 'infini_rag_flow'
  host: 'localhost:9000'
es:
  hosts: 'http://localhost:1200'
  username: 'elastic'
  password: 'infini_rag_flow'
os:
  hosts: 'http://localhost:1201'
  username: 'admin'
  password: 'infini_rag_flow_OS_01'
infinity:
  uri: 'localhost:23817'
  db_name: 'default_db'
redis:
  db: 1
  password: 'infini_rag_flow'
  host: 'localhost:6379'
# postgres:
#   name: 'rag_flow'
#   user: 'rag_flow'
#   password: 'infini_rag_flow'
#   host: 'postgres'
#   port: 5432
#   max_connections: 100
#   stale_timeout: 30
# s3:
#   access_key: 'access_key'
#   secret_key: 'secret_key'
#   region: 'region'
# oss:
#   access_key: 'access_key'
#   secret_key: 'secret_key'
#   endpoint_url: 'http://oss-cn-hangzhou.aliyuncs.com'
#   region: 'cn-hangzhou'
#   bucket: 'bucket_name'
# azure:
#   auth_type: 'sas'
#   container_url: 'container_url'
#   sas_token: 'sas_token'
# azure:
#   auth_type: 'spn'
#   account_url: 'account_url'
#   client_id: 'client_id'
#   secret: 'secret'
#   tenant_id: 'tenant_id'
#   container_name: 'container_name'
# The OSS object storage uses the MySQL configuration above by default. If you need to switch to antoher object storage service, please uncomment and configure the following parameters.
# opendal:
#   scheme: 'mysql'  # Storage type, such as s3, oss, azure, etc.
#   config:
#     oss_table: 'opendal_storage'
# user_default_llm:
#   factory: 'BAAI'
#   api_key: 'backup'
#   base_url: 'backup_base_url'
#   default_models:
#     chat_model:
#       name: 'qwen2.5-7b-instruct'
#       factory: 'xxxx'
#       api_key: 'xxxx'
#       base_url: 'https://api.xx.com'
#     embedding_model:
#       name: 'bge-m3'
#     rerank_model: 'bge-reranker-v2'
#     asr_model:
#       model: 'whisper-large-v3' # alias of name
#     image2text_model: ''
# oauth:
#   oauth2:
#     display_name: "OAuth2"
#     client_id: "your_client_id"
#     client_secret: "your_client_secret"
#     authorization_url: "https://your-oauth-provider.com/oauth/authorize"
#     token_url: "https://your-oauth-provider.com/oauth/token"
#     userinfo_url: "https://your-oauth-provider.com/oauth/userinfo"
#     redirect_uri: "https://your-app.com/v1/user/oauth/callback/oauth2"
#   oidc:
#     display_name: "OIDC"
#     client_id: "your_client_id"
#     client_secret: "your_client_secret"
#     issuer: "https://your-oauth-provider.com/oidc"
#     scope: "openid email profile"
#     redirect_uri: "https://your-app.com/v1/user/oauth/callback/oidc"
#   github:
#     type: "github"
#     icon: "github"
#     display_name: "Github"
#     client_id: "your_client_id"
#     client_secret: "your_client_secret"
#     redirect_uri: "https://your-app.com/v1/user/oauth/callback/github"
# authentication:
#   client:
#     switch: false
#     http_app_key:
#     http_secret_key:
#   site:
#     switch: false
# permission:
#   switch: false
#   component: false
#   dataset: false
# smtp:
#   mail_server: ""
#   mail_port: 465
#   mail_use_ssl: true
#   mail_use_tls: false
#   mail_username: ""
#   mail_password: ""
#   mail_default_sender:
#     - "RAGFlow" # display name
#     - "" # sender email address
#   mail_frontend_url: "https://your-frontend.example.com"

```

### 5.3 初始化配置 
配置初始化位于 `api/settings.py`，init_settings 函数代码比较长，我们分块来看

#### 大模型配置
大模型配置对应的配置段是 user_default_llm:

```yaml
user_default_llm:
  factory: 'BAAI'
  api_key: 'backup'
  base_url: 'backup_base_url'
  default_models:
    chat_model:
      name: 'qwen2.5-7b-instruct'
      factory: 'xxxx'
      api_key: 'xxxx'
      base_url: 'https://api.xx.com'
    embedding_model:
      name: 'bge-m3'
    rerank_model: 'bge-reranker-v2'
    asr_model:
      model: 'whisper-large-v3' # alias of name
    image2text_model: ''
```

```python
BUILTIN_EMBEDDING_MODELS = ["BAAI/bge-large-zh-v1.5@BAAI", "maidalun1020/bce-embedding-base_v1@Youdao"]

def init_settings():
    global LLM, LLM_FACTORY, LLM_BASE_URL, LIGHTEN, DATABASE_TYPE, DATABASE, FACTORY_LLM_INFOS, REGISTER_ENABLED
    LIGHTEN = int(os.environ.get("LIGHTEN", "0"))
    # 加载不同厂商提供的大模型元数据信息，位于 conf/llm_factories.json
    try:
        with open(os.path.join(get_project_base_directory(), "conf", "llm_factories.json"), "r") as f:
            FACTORY_LLM_INFOS = json.load(f)["factory_llm_infos"]
    except Exception:
        FACTORY_LLM_INFOS = []
    # 读取 user_default_llm 配置段
    LLM = get_base_config("user_default_llm", {}) or {}
    LLM_DEFAULT_MODELS = LLM.get("default_models", {}) or {}
    LLM_FACTORY = LLM.get("factory", "") or ""
    LLM_BASE_URL = LLM.get("base_url", "") or ""

    global CHAT_MDL, EMBEDDING_MDL, RERANK_MDL, ASR_MDL, IMAGE2TEXT_MDL
    global CHAT_CFG, EMBEDDING_CFG, RERANK_CFG, ASR_CFG, IMAGE2TEXT_CFG
    if not LIGHTEN:
        EMBEDDING_MDL = BUILTIN_EMBEDDING_MODELS[0]

    # 加载 default_models 不同模型的配置
    chat_entry = _parse_model_entry(LLM_DEFAULT_MODELS.get("chat_model", CHAT_MDL))
    embedding_entry = _parse_model_entry(LLM_DEFAULT_MODELS.get("embedding_model", EMBEDDING_MDL))
    rerank_entry = _parse_model_entry(LLM_DEFAULT_MODELS.get("rerank_model", RERANK_MDL))
    asr_entry = _parse_model_entry(LLM_DEFAULT_MODELS.get("asr_model", ASR_MDL))
    image2text_entry = _parse_model_entry(LLM_DEFAULT_MODELS.get("image2text_model", IMAGE2TEXT_MDL))

    # 使用 user_default_llm 下的根配置，作为默认配置合并模型配置
    global API_KEY, PARSERS, HOST_IP, HOST_PORT, SECRET_KEY
    API_KEY = LLM.get("api_key")
    PARSERS = LLM.get(
        "parsers", "naive:General,qa:Q&A,resume:Resume,manual:Manual,table:Table,paper:Paper,book:Book,laws:Laws,presentation:Presentation,picture:Picture,one:One,audio:Audio,email:Email,tag:Tag"
    )
    CHAT_CFG = _resolve_per_model_config(chat_entry, LLM_FACTORY, API_KEY, LLM_BASE_URL)
    EMBEDDING_CFG = _resolve_per_model_config(embedding_entry, LLM_FACTORY, API_KEY, LLM_BASE_URL)
    RERANK_CFG = _resolve_per_model_config(rerank_entry, LLM_FACTORY, API_KEY, LLM_BASE_URL)
    ASR_CFG = _resolve_per_model_config(asr_entry, LLM_FACTORY, API_KEY, LLM_BASE_URL)
    IMAGE2TEXT_CFG = _resolve_per_model_config(image2text_entry, LLM_FACTORY, API_KEY, LLM_BASE_URL)

    # 相当于按照 1. default_models、2. 代码中配置的常量、3. user_default_llm 根下默认配置的优先级，获取模型配置
    CHAT_MDL = CHAT_CFG.get("model", "") or ""
    EMBEDDING_MDL = EMBEDDING_CFG.get("model", "") or ""
    RERANK_MDL = RERANK_CFG.get("model", "") or ""
    ASR_MDL = ASR_CFG.get("model", "") or ""
    IMAGE2TEXT_MDL = IMAGE2TEXT_CFG.get("model", "") or ""
```

#### 数据库配置
数据库配置，主要:
1. mysql/postgresql 的选择
2. es/opensearch 的选择
3. retriever 的初始化

```python
def init_settings():
    # mysql/postgresql 的选择
    DATABASE_TYPE = os.getenv("DB_TYPE", "mysql")
    DATABASE = decrypt_database_config(name=DATABASE_TYPE)
    
    global DOC_ENGINE, docStoreConn, retrievaler, kg_retrievaler
    DOC_ENGINE = os.environ.get("DOC_ENGINE", "elasticsearch")
    # DOC_ENGINE = os.environ.get('DOC_ENGINE', "opensearch")
    lower_case_doc_engine = DOC_ENGINE.lower()
    if lower_case_doc_engine == "elasticsearch":
        docStoreConn = rag.utils.es_conn.ESConnection()
    elif lower_case_doc_engine == "infinity":
        docStoreConn = rag.utils.infinity_conn.InfinityConnection()
    elif lower_case_doc_engine == "opensearch":
        docStoreConn = rag.utils.opensearch_conn.OSConnection()
    else:
        raise Exception(f"Not supported doc engine: {DOC_ENGINE}")

    retrievaler = search.Dealer(docStoreConn)
    from graphrag import search as kg_search

    kg_retrievaler = kg_search.KGSearch(docStoreConn)
```

#### 其他配置项

```python
def init_settings():
    # 服务启动配置
    try:
        REGISTER_ENABLED = int(os.environ.get("REGISTER_ENABLED", "1"))
    except Exception:
        pass

    global API_KEY, PARSERS, HOST_IP, HOST_PORT, SECRET_KEY
    
    HOST_IP = get_base_config(RAG_FLOW_SERVICE_NAME, {}).get("host", "127.0.0.1")
    HOST_PORT = get_base_config(RAG_FLOW_SERVICE_NAME, {}).get("http_port")

    SECRET_KEY = get_or_create_secret_key()

    # 客户端认证配置
    global AUTHENTICATION_CONF, CLIENT_AUTHENTICATION, HTTP_APP_KEY, GITHUB_OAUTH, FEISHU_OAUTH, OAUTH_CONFIG
    # authentication
    AUTHENTICATION_CONF = get_base_config("authentication", {})

    CLIENT_AUTHENTICATION = AUTHENTICATION_CONF.get("client", {}).get("switch", False)
    HTTP_APP_KEY = AUTHENTICATION_CONF.get("client", {}).get("http_app_key")
    GITHUB_OAUTH = get_base_config("oauth", {}).get("github")
    FEISHU_OAUTH = get_base_config("oauth", {}).get("feishu")

    OAUTH_CONFIG = get_base_config("oauth", {})

    if int(os.environ.get("SANDBOX_ENABLED", "0")):
        global SANDBOX_HOST
        SANDBOX_HOST = os.environ.get("SANDBOX_HOST", "sandbox-executor-manager")

    # 邮箱服务配置
    global SMTP_CONF, MAIL_SERVER, MAIL_PORT, MAIL_USE_SSL, MAIL_USE_TLS
    global MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER, MAIL_FRONTEND_URL
    SMTP_CONF = get_base_config("smtp", {})

    MAIL_SERVER = SMTP_CONF.get("mail_server", "")
    MAIL_PORT = SMTP_CONF.get("mail_port", 000)
    MAIL_USE_SSL = SMTP_CONF.get("mail_use_ssl", True)
    MAIL_USE_TLS = SMTP_CONF.get("mail_use_tls", False)
    MAIL_USERNAME = SMTP_CONF.get("mail_username", "")
    MAIL_PASSWORD = SMTP_CONF.get("mail_password", "")
    mail_default_sender = SMTP_CONF.get("mail_default_sender", [])
    if mail_default_sender and len(mail_default_sender) >= 2:
        MAIL_DEFAULT_SENDER = (mail_default_sender[0], mail_default_sender[1])
    MAIL_FRONTEND_URL = SMTP_CONF.get("mail_frontend_url", "")
```