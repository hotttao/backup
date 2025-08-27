---
weight: 1
title: "RagFlow NLP Tokenizer"

date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow NLP Tokenizer"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

RagTokenizer 是 Ragflow 实现的分词器，这一节我们来介绍它的实现。

## 1. Tokenizer
NLP 我了解的不多，所以我向 ChatGPT 提了以下问题:

```bash
1. 什么是 Tokenizer 
2. 传统的 Tokenizer 与 基于 LLM 的 Tokenizer 有什么区别 
3. 开源项目中，使用最多的传统 Tokenizer 和 LLM Tokenizer 分别是什么，请给出使用示例
```

下面是 ChatGPT 的回答，基本上能帮助我们理解分词器到底是什么。

### 1️⃣ Tokenizer 是什么
Tokenizer（分词器）**是将文本拆分为**最小单元（tokens）的工具，这些单元可以是单词、子词、字符或其他符号。

* **作用**：

  1. 将原始文本转换为模型可以理解的数字序列（通常是 token id）。
  2. 支持模型训练和推理过程中的文本处理。

* **举例**：

```python
text = "我爱自然语言处理"
tokens = ["我", "爱", "自然", "语言", "处理"]
```

在 NLP 模型中，这些 tokens 会进一步映射成 id 供模型使用。

---

### 2️⃣ 传统 Tokenizer 与 基于 LLM 的 Tokenizer 的区别

| 特性    | 传统 Tokenizer                                | 基于 LLM 的 Tokenizer                          |
| ----- | ------------------------------------------- | ------------------------------------------- |
| 分词策略  | 通常规则或统计方法，如空格分词、BPE、WordPiece、SentencePiece | 由 LLM 训练中学习到的 subword 或 context-aware token |
| 上下文意识 | 无，完全根据规则或字典                                 | 有，能根据上下文调整 token 划分                         |
| 适应性   | 固定字典，新增词需要重新训练或扩充                           | 可动态适应输入文本和模型需求                              |
| 精度    | 对常见语言表现好，但对新词、错别字、外文可能差                     | 对复杂、多语种、混合文本表现更好                            |
| 计算开销  | 较低                                          | 较高（因为可能调用 LLM 本身进行编码）                       |

**举例：**

传统 BPE 分词器对英文句子：

```python
from transformers import RobertaTokenizer

tokenizer = RobertaTokenizer.from_pretrained("roberta-base")
tokens = tokenizer.tokenize("I love NLP")
print(tokens)
# 输出: ['I', 'Ġlove', 'ĠN', 'L', 'P']
```

LLM Tokenizer（如 ChatGLM 使用的 tokenizer，可以对中文更智能分词）：

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("THUDM/chatglm-6b", trust_remote_code=True)
tokens = tokenizer.tokenize("我爱自然语言处理")
print(tokens)
# 输出可能为: ['我', '爱', '自然语言', '处理']
```

区别在于 LLM Tokenizer 更能理解词语组合的语义，不仅仅是字符拆分。

---

### 3️⃣ 开源项目中最常用的 Tokenizer

#### 🔹 传统 Tokenizer

* **BPE（Byte-Pair Encoding）**: GPT 系列早期使用
* **WordPiece**: BERT 系列使用
* **SentencePiece**: 多语种模型常用（如 mBERT, T5）

**示例（BERT WordPiece）：**

```python
from transformers import BertTokenizer

tokenizer = BertTokenizer.from_pretrained("bert-base-chinese")
text = "我爱自然语言处理"
tokens = tokenizer.tokenize(text)
ids = tokenizer.convert_tokens_to_ids(tokens)
print(tokens, ids)
```

---

#### 🔹 LLM Tokenizer

* **HuggingFace 的 `AutoTokenizer` + trust_remote_code=True** 可以加载大部分基于 LLM 的 tokenizer（如 ChatGLM, LLaMA, MPT）
* 优势：能更好处理长文本、多语种、特殊符号和上下文相关分词

**示例（ChatGLM tokenizer）：**

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("THUDM/chatglm-6b", trust_remote_code=True)
text = "我爱自然语言处理"
tokens = tokenizer.tokenize(text)
ids = tokenizer.encode(text)
print(tokens, ids)
```

---

总结：

* **传统 tokenizer**：规则/统计驱动，快速、稳定，但对上下文和新词能力有限。
* **LLM tokenizer**：上下文敏感，能处理复杂、多语种场景，但开销较大。
* **开源最常用**：

  * 传统：BPE、WordPiece、SentencePiece
  * LLM：HuggingFace AutoTokenizer + 模型自带 tokenizer

RagFlow 实现的 RagTokenizer 是传统 tokenizer。在 RagTokenizer 的实现中用到了 NLTK 和 datrie，我们先来了解一下这两个工具。


## 2. NLTK

### 2.1 NLTK 是什么？

**NLTK (Natural Language Toolkit)** 是一个经典的 Python 自然语言处理（NLP）库。
它提供了很多 NLP 工具，比如：

* 分词（把句子拆成单词/标点）
* 词干提取（提取单词的“词根”）
* 词形还原（把单词变成标准词典里的形式）
* 语料库（常见的英文文本数据）
* 词性标注、句法分析等等

---

### 2.2 代码中的三个模块

#### (1) `word_tokenize`

* 功能：把英文句子分割成单词和标点。
* 例子：

  ```python
  from nltk import word_tokenize
  sentence = "Cats are running faster than dogs."
  tokens = word_tokenize(sentence)
  print(tokens)
  ```

  输出：

  ```python
  ['Cats', 'are', 'running', 'faster', 'than', 'dogs', '.']
  ```

  👉 就是一个个“词元”。

---

#### (2) `PorterStemmer`

* 功能：**词干提取 (stemming)**，把单词“削减”成一个基础形式（不一定是真正的词，只是统一成一个根形式）。
* 例子：

  ```python
  from nltk.stem import PorterStemmer
  stemmer = PorterStemmer()
  print(stemmer.stem("running"))   # run
  print(stemmer.stem("better"))    # better （没有变化）
  ```

  👉 `running → run`，但 `better` 还是 `better`，因为它只是简单规则，不查字典。

---

#### (3) `WordNetLemmatizer`

* 功能：**词形还原 (lemmatization)**，把单词转化成字典里标准的形式（需要词典支持）。
* 例子：

  ```python
  from nltk.stem import WordNetLemmatizer
  lemmatizer = WordNetLemmatizer()
  print(lemmatizer.lemmatize("running", pos="v"))  # run
  print(lemmatizer.lemmatize("better", pos="a"))   # good
  ```

  👉 这个比 stemming 更智能，比如 `better → good`。

---

### 2.3 区别总结

| 工具                  | 作用         | 示例                                            |
| ------------------- | ---------- | --------------------------------------------- |
| `word_tokenize`     | 分词         | `"I like cats." → ['I', 'like', 'cats', '.']` |
| `PorterStemmer`     | 词干化（简单规则）  | `"running" → "run"`，`"studies" → "studi"`     |
| `WordNetLemmatizer` | 词形还原（基于词典） | `"running" → "run"`，`"better" → "good"`       |


## 3. datrie

`datrie` 是 Python 的一个 **双数组 Trie（Double-Array Trie）** 实现，用于高效的**前缀匹配**和**字符串查找**。

* **Trie**（字典树）是一种树形结构，适合存储大量字符串，支持：

  * 快速查找字符串是否存在
  * 查找所有以某个前缀开头的字符串
  * 可以存储字符串对应的值（权重、ID 等）

* **双数组 Trie** 是 Trie 的一种高效存储实现：

  * 内存占用小
  * 查找速度非常快
  * 特别适合中文分词词典、拼写检查、搜索引擎词表等场景

---

### 3.1 `datrie` 的特点

1. **支持 Unicode**

   * 可以直接处理中文、日文、英文等多语言字符

2. **支持前缀搜索**

   * 可以快速找出所有以某个前缀开头的词条

3. **支持键值存储**

   * 每个字符串可以关联一个整数或对象
   * 常用于词典存储词频、词性、ID 等

4. **高效**

   * 查找时间复杂度接近 O(1)（相比普通 Python dict 还是有优势，尤其是前缀匹配）

---

### 3.2 常用方法

```python
import datrie

# 构建一个 Trie，只支持 a-z 字符
trie = datrie.Trie("abcdefghijklmnopqrstuvwxyz")

# 插入
trie["apple"] = 5
trie["app"] = 10
trie["banana"] = 3

# 查找
print(trie["apple"])  # 5

# 判断键是否存在
print("app" in trie)  # True

# 前缀搜索
print(list(trie.keys(prefix="ap")))  # ['app', 'apple']

# 删除
del trie["app"]
```

> ⚠ 注意：
>
> * `datrie` 构建时必须指定字符集（`alphabet`），比如 `"abcdefghijklmnopqrstuvwxyz"`
> * 如果是中文，可以用 Unicode 范围，例如：
>
>   ```python
>   trie = datrie.Trie(ranges=[(u'\u4e00', u'\u9fff')])  # 中文汉字
>   ```
> * string.printable 是 Python 内置的字符串，包含了所有“可打印字符”：
---

### 3.3 使用场景

* **中文分词词典**：存储词条和权重，快速查找和匹配前缀
* **拼写检查**：检查输入是否在词典中
* **搜索引擎**：前缀匹配、自动补全
* **RAG / NLP 系统**：存储词典 ID、词频、词性


## 4. RagTokenizer

```python
# -*- coding: utf-8 -*-
# 这份文件实现了一个中英文混合分词器 RagTokenizer：
# - 通过 datrie（双数组 Trie）加载词典，支持前缀/反向前缀匹配
# - 中文：正向/反向最大匹配 + DFS 穷举 + 打分 解决歧义
# - 英文：NLTK 分词 + Lemmatize + Stem
# - 预处理：全角转半角、繁体转简体、统一小写、去掉非单词字符
# - 支持加载用户词典（可缓存为 .trie 文件以加速下次启动）

import logging         # 标准库日志，用于记录信息/调试/异常
import copy            # 提供 deepcopy 等深拷贝操作，DFS 时复制路径用
import datrie          # 双数组 trie，支持快速前缀查询/持久化到磁盘
import math            # 数学库，用于 log/exp/四舍五入等
import os              # 与文件路径/存在性检查相关
import re              # 正则表达式，广泛用于清洗/切分
import string          # 常见字符集合（如 string.printable）
import sys             # 系统接口（此处未直接使用）
from hanziconv import HanziConv                        # 用于繁体转简体
from nltk import word_tokenize                         # 英文分词
from nltk.stem import PorterStemmer, WordNetLemmatizer # 英文词干化/词形还原
from api.utils.file_utils import get_project_base_directory  # 获取项目根目录（项目内工具）


class RagTokenizer:
    """
    RagTokenizer：面向 RAG 的中英文混合分词器。

    主要职责：
    - 维护一个 datrie.Trie 作为词典容器（含正向 key 和反向 key）
    - 对输入文本进行清洗（全角->半角、繁->简、小写、去非单词字符）
    - 根据中/英不同语言段落选择不同分词策略
      * 中文：最大正/反向匹配 -> 若冲突则 DFS 穷举所有可切分路径并打分择优
      * 英文：nltk 分词 + 词形还原 + 词干化
    - 支持用户词典加载/追加 + Trie 文件缓存
    """

    def key_(self, line):
        """
        将字符串标准化为 trie 的正向 key：
        - 转为小写
        - 以 UTF-8 编码得到 bytes
        - 再转为形如 "b'xxx'" 的字符串并去掉前后 "b'" 和 "'"，得到裸字节表示
        """
        return str(line.lower().encode("utf-8"))[2:-1]

    def rkey_(self, line):
        """
        构造反向 key（用于后向最大匹配）：
        - 将字符串反转并小写
        - 在前面加上前缀 "DD"（避免与正常正向 key 冲突；也可作为命名空间）
        - 同样做 UTF-8 编码并去掉 "b'...'" 包装
        """
        return str(("DD" + (line[::-1].lower())).encode("utf-8"))[2:-1]

    def loadDict_(self, fnm):
        """
        从文本词典文件加载词条到 trie，并落盘为 .trie 缓存文件。
        词典每行格式约定：word<空白>freq<空白>tag

        存储策略：
        - 正向 key：存 (F, tag)，其中 F = round(log(freq / DENOMINATOR))
        - 反向 key：存一个存在性标记 1（用于 has_keys_with_prefix 的后向检查）
        """
        logging.info(f"[HUQIE]:Build trie from {fnm}")
        try:
            of = open(fnm, "r", encoding='utf-8')  # 以 UTF-8 打开词典文件
            while True:
                line = of.readline()               # 逐行读取
                if not line:                       # EOF 退出
                    break
                line = re.sub(r"[\r\n]+", "", line)          # 去掉换行符
                line = re.split(r"[ \t]", line)              # 按空格/Tab 分列 -> [word, freq, tag]
                k = self.key_(line[0])                       # 标准化正向 key
                # 对词频做对数变换并四舍五入 -> 压缩频率范围，避免极端值影响
                F = int(math.log(float(line[1]) / self.DENOMINATOR) + .5)
                # 正向 key 若不存在或已有 freq 更小，则更新为更大的 freq（保留更可信的频率）
                if k not in self.trie_ or self.trie_[k][0] < F:
                    self.trie_[self.key_(line[0])] = (F, line[2])  # 存 (对数频率, 词性/标签)
                # 同时写入反向 key 标记，用于后向最大匹配时的前缀检查
                self.trie_[self.rkey_(line[0])] = 1

            dict_file_cache = fnm + ".trie"                  # 缓存文件名
            logging.info(f"[HUQIE]:Build trie cache to {dict_file_cache}")
            self.trie_.save(dict_file_cache)                 # 将 trie 持久化为二进制文件
            of.close()
        except Exception:
            # 若有异常（如文件不存在/格式不对），打印堆栈方便排查
            logging.exception(f"[HUQIE]:Build trie {fnm} failed")

    def __init__(self, debug=False):
        """
        初始化：
        - 设置 DEBUG 开关、频率归一化分母、词典目录
        - 初始化英文词干化/词形还原器
        - 定义用于语言切段的分隔正则（标点/空白/英数等）
        - 若存在 .trie 缓存则直接加载，否则创建空 trie 并从 .txt 词典构建
        """
        self.DEBUG = debug
        self.DENOMINATOR = 1000000
        # 词典基本路径：<project>/rag/res/huqie
        self.DIR_ = os.path.join(get_project_base_directory(), "rag/res", "huqie")

        # 英文词形处理：lemmatize 归一化词形，再用 stemmer 取词干（二者组合避免漏召）
        self.stemmer = PorterStemmer()
        self.lemmatizer = WordNetLemmatizer()

        # 语言切段/分隔正则：
        # - 第一部分：各种标点/空白/中文标点
        # - 第二部分：成段的英数/连字符/点号等（作为不可再细分的一段）
        self.SPLIT_CHAR = r"([ ,\.<>/?;:'\[\]\\`!@#$%^&*\(\)\{\}\|_+=《》，。？、；‘’：“”【】~！￥%……（）——-]+|[a-zA-Z0-9,\.-]+)"

        trie_file_name = self.DIR_ + ".txt.trie"  # 词典缓存文件全路径
        # 优先尝试加载已有缓存，以避免每次启动都重建 Trie（性能更好）
        if os.path.exists(trie_file_name):
            try:
                # datrie.Trie.load 会根据构建时的 alphabet 自动还原
                self.trie_ = datrie.Trie.load(trie_file_name)
                return  # 加载成功则直接返回
            except Exception:
                # 若缓存损坏或版本不兼容，则记录异常并回退到空 Trie（使用 string.printable 作为 alphabet）
                logging.exception(f"[HUQIE]:Fail to load trie file {trie_file_name}, build the default trie file")
                self.trie_ = datrie.Trie(string.printable)
        else:
            # 首次运行或缓存未生成：创建空 Trie（alphabet 指定可接受的字符集；此处取 printable）
            logging.info(f"[HUQIE]:Trie file {trie_file_name} not found, build the default trie file")
            self.trie_ = datrie.Trie(string.printable)

        # 若上面没有 return，说明需要从原始 .txt 构建 Trie，并在构建完落盘 .trie
        self.loadDict_(self.DIR_ + ".txt")

    def loadUserDict(self, fnm):
        """
        加载用户词典：
        - 优先尝试直接加载 fnm.trie（缓存）
        - 若失败，则新建空 Trie 并从 fnm 文本词典构建
        """
        try:
            self.trie_ = datrie.Trie.load(fnm + ".trie")  # 直接读缓存
            return
        except Exception:
            # 缓存不存在或损坏，则创建空 trie 并用文本词典构建
            self.trie_ = datrie.Trie(string.printable)
        self.loadDict_(fnm)

    def addUserDict(self, fnm):
        """
        在当前 Trie 基础上追加加载新的用户词典（可多次调用叠加新词）。
        """
        self.loadDict_(fnm)

    def _strQ2B(self, ustring):
        """Convert full-width characters to half-width characters（全角->半角）"""
        rstring = ""
        for uchar in ustring:
            inside_code = ord(uchar)           # 获取字符的 Unicode 码位
            if inside_code == 0x3000:          # 全角空格特殊处理
                inside_code = 0x0020
            else:
                inside_code -= 0xfee0          # 全角字符与半角字符间的固定偏移
            # 如果转换后不在可打印 ASCII 范围，则保持原字符（避免误转）
            if inside_code < 0x0020 or inside_code > 0x7e:
                rstring += uchar
            else:
                rstring += chr(inside_code)    # 否则写入转换后的半角字符
        return rstring

    def _tradi2simp(self, line):
        """繁体 -> 简体（借助 hanziconv）"""
        return HanziConv.toSimplified(line)

    def dfs_(self, chars, s, preTks, tkslist, _depth=0, _memo=None):
        """
        对给定字符数组 chars 从位置 s 开始做 DFS 切分，将所有可能切分路径加入 tkslist。

        参数：
        - chars: list[str]，字符列表
        - s: int，当前搜索起点
        - preTks: list[(token, (freq, tag))]，到目前为止的切分序列（路径）
        - tkslist: list[list[(token, (freq, tag))]]，收集所有完整切分的容器
        - _depth: 当前递归深度（用于设定上限防止爆栈）
        - _memo: 记忆化缓存，key=(s, tuple(已有 token 序列)) -> 最远可达位置；避免重复子问题

        逻辑：
        - 超过 MAX_DEPTH：将剩余字符视作一个整体 token（打低分 freq=-12），收束并返回
        - 若 s 已到结尾：把已有路径加入结果，返回
        - 重复字符快速路径：连续相同字符（如 "——" 或 "......"）合并处理，减少分支
        - 主流程：尝试从 s 向后扩展，优先使用 trie 的 has_keys_with_prefix 做剪枝
        - 如无法扩展（res == s），则按单字切分推进（保底）
        """
        if _memo is None:
            _memo = {}
        MAX_DEPTH = 10
        if _depth > MAX_DEPTH:
            if s < len(chars):
                copy_pretks = copy.deepcopy(preTks)     # 复制路径以免后续污染
                remaining = "".join(chars[s:])          # 将剩余部分合成一个 token
                copy_pretks.append((remaining, (-12, '')))  # 频率给很低值表示退化路径
                tkslist.append(copy_pretks)             # 收集为一种切分
            return s
    
        # 记忆化 key：当前位置 + 路径的 token 串（只取 token 字符，不取元信息）
        state_key = (s, tuple(tk[0] for tk in preTks)) if preTks else (s, None)
        if state_key in _memo:
            return _memo[state_key]
        
        res = s
        if s >= len(chars):
            # 到达末尾，当前路径是一个完整切分，记入 tkslist
            tkslist.append(preTks)
            _memo[state_key] = s
            return s

        # 快速路径：检测是否有 >=5 个相同字符连串，若有则批量吞掉（减少递归深度）
        if s < len(chars) - 4:
            is_repetitive = True
            char_to_check = chars[s]
            for i in range(1, 5):
                if s + i >= len(chars) or chars[s + i] != char_to_check:
                    is_repetitive = False
                    break
            if is_repetitive:
                # end 指向重复段尾，mid 取最多 10 个字符作为 token
                end = s
                while end < len(chars) and chars[end] == char_to_check:
                    end += 1
                mid = s + min(10, end - s)
                t = "".join(chars[s:mid])               # 重复段的前缀作为一个 token
                k = self.key_(t)
                copy_pretks = copy.deepcopy(preTks)
                if k in self.trie_:
                    copy_pretks.append((t, self.trie_[k]))
                else:
                    copy_pretks.append((t, (-12, '')))
                # 传入 mid，减少递归
                next_res = self.dfs_(chars, mid, copy_pretks, tkslist, _depth + 1, _memo)
                res = max(res, next_res)                # 记录最远推进位置
                _memo[state_key] = res
                return res
    
        # S 是起始可尝试的最短终点（用于剪枝，尽量避免 1 字节步进的爆炸）
        S = s + 1
        if s + 2 <= len(chars):
            t1 = "".join(chars[s:s + 1])                                # 取 1 字符
            t2 = "".join(chars[s:s + 2])                                # 取 2 字符
            # 如果前缀有 1 字符词前缀，但没有 2 字符前缀，则直接跳过一个字符
            if self.trie_.has_keys_with_prefix(self.key_(t1)) and not self.trie_.has_keys_with_prefix(self.key_(t2)):
                S = s + 2
        # 降低连续 1 字符 token 的概率：若前面连续 3 个 1 字符 token 且下一个与其可前缀拼接，则 S 跳 2
        if len(preTks) > 2 and len(preTks[-1][0]) == 1 and len(preTks[-2][0]) == 1 and len(preTks[-3][0]) == 1:
            t1 = preTks[-1][0] + "".join(chars[s:s + 1])
            if self.trie_.has_keys_with_prefix(self.key_(t1)):
                S = s + 2
    
        # 主循环：尝试从 s 向右扩展到 e，尽量走前缀存在的路径（否则 break）
        for e in range(S, len(chars) + 1):
            t = "".join(chars[s:e])                 # 候选 token
            k = self.key_(t)
            if e > s + 1 and not self.trie_.has_keys_with_prefix(k):
                break                               # 一旦前缀不存在，直接停止扩展
            if k in self.trie_:                     # 命中词典则作为一个备选分支
                pretks = copy.deepcopy(preTks)
                pretks.append((t, self.trie_[k]))
                # 递归继续向后搜索，并尝试更新最远推进位置
                res = max(res, self.dfs_(chars, e, pretks, tkslist, _depth + 1, _memo))
        
        # 若至少有一个分支推进了（res > s），记录记忆化并返回
        if res > s:
            _memo[state_key] = res
            return res
    
        # 否则退化为按单字切分（保证能前进）
        t = "".join(chars[s:s + 1])
        k = self.key_(t)
        copy_pretks = copy.deepcopy(preTks)
        if k in self.trie_:
            copy_pretks.append((t, self.trie_[k]))
        else:
            copy_pretks.append((t, (-12, '')))
        result = self.dfs_(chars, s + 1, copy_pretks, tkslist, _depth + 1, _memo)
        _memo[state_key] = result
        return result

    def freq(self, tk):
        """
        查询词频（将存储的对数频率还原为近似原频率）：
        - 若不在 trie，返回 0
        - 在 trie：exp(F) * DENOMINATOR，四舍五入为 int
        """
        k = self.key_(tk)
        if k not in self.trie_:
            return 0
        return int(math.exp(self.trie_[k][0]) * self.DENOMINATOR + 0.5)

    def tag(self, tk):
        """返回词性/标签；不在 trie 返回空串"""
        k = self.key_(tk)
        if k not in self.trie_:
            return ""
        return self.trie_[k][1]

    def score_(self, tfts):
        """
        对一个切分序列（含每个 token 的 (freq, tag)）打分：
        - F：累加所有 token 的对数频率
        - L：长度>1 的 token 占比（偏好更长的词）
        - 惩罚项 B=30：序列越长 B/len 越小（鼓励较少的切分）
        返回：(token 列表, 分数)
        """
        B = 30
        F, L, tks = 0, 0, []
        for tk, (freq, tag) in tfts:
            F += freq
            L += 0 if len(tk) < 2 else 1
            tks.append(tk)
        #F /= len(tks)   # 如需平均频率，可打开；当前策略直接累加
        L /= len(tks)
        logging.debug("[SC] {} {} {} {} {}".format(tks, len(tks), L, F, B / len(tks) + L + F))
        return tks, B / len(tks) + L + F

    def sortTks_(self, tkslist):
        """
        对多条候选切分（list of token-with-meta）打分排序，分数高的在前。
        返回：[ (token_str_list, score), ... ]
        """
        res = []
        for tfts in tkslist:
            tks, s = self.score_(tfts)
            res.append((tks, s))
        return sorted(res, key=lambda x: x[1], reverse=True)

    def merge_(self, tks):
        """
        将空格分割的 token 串做合并优化：
        - 先归一连续空格
        - 以最多 5 个 token 的滑窗，尝试把 [s:e] 合并为更长的 token
          * 仅当合并后字符串匹配 SPLIT_CHAR（即“像一个合理片段”）
            且在词典中 freq(tk) > 0 时才合并
        - 返回合并后的字符串（仍以空格分割 token）
        """
        res = []
        tks = re.sub(r"[ ]+", " ", tks).split()  # 归一空格后按空格切
        s = 0
        while True:
            if s >= len(tks):
                break
            E = s + 1
            # 最多尝试合并到 s+5
            for e in range(s + 2, min(len(tks) + 2, s + 6)):
                tk = "".join(tks[s:e])                    # 尝试合并为无空格字符串
                if re.search(self.SPLIT_CHAR, tk) and self.freq(tk):
                    E = e                                 # 满足条件则延长可合并窗口
            res.append("".join(tks[s:E]))                 # 将 [s:E) 合并加入结果
            s = E

        return " ".join(res)

    def maxForward_(self, line):
        """
        正向最大匹配：
        - 从左到右扩展 e，直到前缀不存在再回退
        - 命中词典则取 (token, meta)，否则 freq=0 作为未知词
        - 最终对得到的序列打分，返回 (token_list, score)
        """
        res = []
        s = 0
        while s < len(line):
            e = s + 1
            t = line[s:e]
            # 只要前缀存在就持续扩展
            while e < len(line) and self.trie_.has_keys_with_prefix(
                    self.key_(t)):
                e += 1
                t = line[s:e]

            # 回退到最后一个在词典中的位置（或单字符）
            while e - 1 > s and self.key_(t) not in self.trie_:
                e -= 1
                t = line[s:e]

            # 记录命中或未知 token
            if self.key_(t) in self.trie_:
                res.append((t, self.trie_[self.key_(t)]))
            else:
                res.append((t, (0, '')))

            s = e

        return self.score_(res)

    def maxBackward_(self, line):
        """
        反向最大匹配：
        - 从右到左扩展 s，直到反向前缀不存在再回退
        - 命中词典则取 (token, meta)，否则 freq=0
        - 返回时将 token 序列反转为从左到右，并打分
        """
        res = []
        s = len(line) - 1
        while s >= 0:
            e = s + 1
            t = line[s:e]
            # 使用反向 key 做前缀检查（rkey_）
            while s > 0 and self.trie_.has_keys_with_prefix(self.rkey_(t)):
                s -= 1
                t = line[s:e]

            # 回退到字典中存在的位置
            while s + 1 < e and self.key_(t) not in self.trie_:
                s += 1
                t = line[s:e]

            # 记录命中或未知 token
            if self.key_(t) in self.trie_:
                res.append((t, self.trie_[self.key_(t)]))
            else:
                res.append((t, (0, '')))

            s -= 1

        return self.score_(res[::-1])  # 还原为从左到右

    def english_normalize_(self, tks):
        """
        对英文 token 做词形归一：先 lemmatize 再 stem。
        仅对匹配 [a-zA-Z_-]+ 的 token 应用，其余原样返回。
        """
        return [self.stemmer.stem(self.lemmatizer.lemmatize(t)) if re.match(r"[a-zA-Z_-]+$", t) else t for t in tks]

    def _split_by_lang(self, line):
        """
        将输入字符串按语言块拆分为 (片段文本, 是否中文) 的列表：
        - 先按 SPLIT_CHAR 切出“块”（标点/英数段会独立成块）
        - 在每个块内部，再按中文/非中文的切换拆分成更细粒度的 (txt, zh_flag)
        eg: line = "今天天气很好, hello world! 3.14"
            arr = ['今天天气很好', ',', 'hello', 'world', '!', '3.14']
        """
        txt_lang_pairs = []
        arr = re.split(self.SPLIT_CHAR, line)  # 使用捕获组，分隔符也会出现在结果中（保留结构）
        for a in arr:
            if not a:
                continue
            s = 0
            e = s + 1
            zh = is_chinese(a[s])  # 以首字符判断中文/非中文
            while e < len(a):
                _zh = is_chinese(a[e])
                if _zh == zh:
                    e += 1
                    continue
                txt_lang_pairs.append((a[s: e], zh))  # 语言状态切换处截断
                s = e
                e = s + 1
                zh = _zh
            if s >= len(a):
                continue
            txt_lang_pairs.append((a[s: e], zh))
        return txt_lang_pairs

    def tokenize(self, line):
        """
        对输入字符串进行完整分词流程：
        1) 清洗：去非单词字符 -> 全角转半角 -> 小写 -> 繁转简
        2) 语言切段：中文/英文分别处理
           - 英文：nltk.word_tokenize + lemmatize + stem
           - 中文：正向/反向最大匹配；若出现不一致区间，则对该区间用 DFS 穷举并打分选最优
        3) 合并策略：merge_ 对英文粘连/可合并片段进行合并
        4) 返回以空格分隔的一串 token
        """
        line = re.sub(r"\W+", " ", line)   # 将非单词字符替换为空格（先粗清洗）
        line = self._strQ2B(line).lower()  # 全角->半角 + 全部小写
        line = self._tradi2simp(line)      # 繁体->简体

        arr = self._split_by_lang(line)    # 拆成若干 (文本片段, 是否中文)
        res = []
        for L,lang in arr:
            if not lang:
                # 英文/非中文路径：直接用 nltk 分词，再做词形归一
                res.extend([self.stemmer.stem(self.lemmatizer.lemmatize(t)) for t in word_tokenize(L)])
                continue
            # 中文路径：对很短或明显是英数的，直接原样加入
            if len(L) < 2 or re.match(
                    r"[a-z\.-]+$", L) or re.match(r"[0-9\.-]+$", L):
                res.append(L)
                continue

            # 先做一次正向/反向最大匹配
            tks, s = self.maxForward_(L)
            tks1, s1 = self.maxBackward_(L)
            if self.DEBUG:
                logging.debug("[FW] {} {}".format(tks, s))
                logging.debug("[BW] {} {}".format(tks1, s1))

            # 合并两种切分：从两者共同的前缀开始，遇到不一致区间时使用 DFS 穷举并选高分方案
            i, j, _i, _j = 0, 0, 0, 0
            same = 0
            while i + same < len(tks1) and j + same < len(tks) and tks1[i + same] == tks[j + same]:
                same += 1
            if same > 0:
                # 两者开头的一段是相同的，先放入结果
                res.append(" ".join(tks[j: j + same]))
            _i = i + same
            _j = j + same
            j = _j + 1
            i = _i + 1

            # 在不一致的区间里，滑动窗口比较，直到对齐
            while i < len(tks1) and j < len(tks):
                tk1, tk = "".join(tks1[_i:i]), "".join(tks[_j:j])
                if tk1 != tk:
                    # 尚未对齐：伸长较短一方以尝试对齐
                    if len(tk1) > len(tk):
                        j += 1
                    else:
                        i += 1
                    continue

                if tks1[i] != tks[j]:
                    # 虽然拼接字符串一致，但单个 token 边界不同 -> 继续伸长尝试更稳定对齐
                    i += 1
                    j += 1
                    continue

                # 到此说明 [ _i:i ) 与 [ _j:j ) 范围对应同一串字符，但 token 边界不同
                # 对该不一致区间用 DFS 穷举所有切分并打分，选最优加入结果
                tkslist = []
                self.dfs_("".join(tks[_j:j]), 0, [], tkslist)
                res.append(" ".join(self.sortTks_(tkslist)[0][0]))

                # 之后再次跳过两者新的相同前缀
                same = 1
                while i + same < len(tks1) and j + same < len(tks) and tks1[i + same] == tks[j + same]:
                    same += 1
                res.append(" ".join(tks[j: j + same]))
                _i = i + same
                _j = j + same
                j = _j + 1
                i = _i + 1
            
            # _i 表示已经达成匹配的开始点
            # 若还有尾部未处理（两者从 _i/_j 起应等长且字符相同），对尾部再做一次 DFS 优化
            if _i < len(tks1):
                assert _j < len(tks)
                assert "".join(tks1[_i:]) == "".join(tks[_j:])
                tkslist = []
                self.dfs_("".join(tks[_j:]), 0, [], tkslist)
                res.append(" ".join(self.sortTks_(tkslist)[0][0]))

        res = " ".join(res)                 # 将所有片段拼成空格分隔的 token 串
        logging.debug("[TKS] {}".format(self.merge_(res)))
        return self.merge_(res)             # 最后做一次合并优化并返回

    def fine_grained_tokenize(self, tks):
        """
        对 tokenize 的结果再做细粒度处理：
        - 若中文 token 占比较低（<20%），则对英文 token 进一步以 "/" 切分子词
        - 对中文 token：
          * 短长度（<3）或纯数字直接保留
          * 否则用 DFS 尝试更细切分（长度>10 的直接视为整体，避免爆炸）
        - 最终对英文做 english_normalize_（lemma+stem）
        """
        tks = tks.split()
        zh_num = len([1 for c in tks if c and is_chinese(c[0])])
        if zh_num < len(tks) * 0.2:
            # 英文占多：把包含 '/' 的 token 进一步拆开
            res = []
            for tk in tks:
                res.extend(tk.split("/"))
            return " ".join(res)

        res = []
        for tk in tks:
            if len(tk) < 3 or re.match(r"[0-9,\.-]+$", tk):
                # 短 token 或数字：直接保留
                res.append(tk)
                continue
            tkslist = []
            if len(tk) > 10:
                # 很长的 token 不 DFS（控制复杂度），直接保留原样
                tkslist.append(tk)
            else:
                # 对较短的中文 token 用 DFS 尝试更细粒度切分
                self.dfs_(tk, 0, [], tkslist)
            if len(tkslist) < 2:
                # 没有产生可对比的候选：原样保留
                res.append(tk)
                continue
            # 选第 2 高分（索引 1）的方案（实现者主观策略，避免过度合并）
            stk = self.sortTks_(tkslist)[1][0]
            if len(stk) == len(tk):
                # 若切分后长度等于原长度（本质没切开），退回原 token
                stk = tk
            else:
                if re.match(r"[a-z\.-]+$", tk):
                    # 英文 token：若有短子词（<3），则退回原 token；否则以空格连接子词
                    for t in stk:
                        if len(t) < 3:
                            stk = tk
                            break
                    else:
                        stk = " ".join(stk)
                else:
                    # 中文 token：子词直接用空格连接
                    stk = " ".join(stk)

            res.append(stk)

        # 最后对英文 token 做词形归一（lemma+stem）
        return " ".join(self.english_normalize_(res))


def is_chinese(s):
    """
    判断单个字符是否是常用 CJK 汉字区间（\u4e00-\u9fa5）。
    注意：这不是严格意义上所有中文字符的全集，仅覆盖常见汉字。
    """
    if s >= u'\u4e00' and s <= u'\u9fa5':
        return True
    else:
        return False


def is_number(s):
    """判断单个字符是否是阿拉伯数字（0-9，对应 \u0030-\u0039）"""
    if s >= u'\u0030' and s <= u'\u0039':
        return True
    else:
        return False


def is_alphabet(s):
    """判断单个字符是否是英文字母（A-Z 或 a-z）"""
    if (s >= u'\u0041' and s <= u'\u005a') or (
            s >= u'\u0061' and s <= u'\u007a'):
        return True
    else:
        return False


def naiveQie(txt):
    """
    朴素切词器：
    - 先按空格切为若干片段
    - 若相邻两个片段都以英文字母结尾/开头（实际上是“末 token 末尾是字母 + 当前 token 末尾是字母”的判断），
      在它们之间插入一个独立的空格 token，确保展示时英文之间有空格
    - 返回一个包含字符串和空格 token 的列表（如 ["Deep", " ", "Learning"]）
    """
    tks = []
    for t in txt.split():
        # 如果上一个 token 和当前 token 都以英文字母结尾，则在它们之间插入空格 token
        if tks and re.match(r".*[a-zA-Z]$", tks[-1]
                            ) and re.match(r".*[a-zA-Z]$", t):
            tks.append(" ")
        tks.append(t)
    return tks

```

### 4.1 key_/rkey_

为什么要单独定义 `self.key_` 和 `self.rkey_` 两个方法，并把转换结果存到 trie 里。

`datrie.Trie` 是 **双数组 Trie**，它有几个特点：

1. **只能存储字符串 key**，不能直接存储 Unicode 或字节数组。
2. **前缀匹配效率高**，可以用 `has_keys_with_prefix` 做快速搜索。
3. 因为底层是数组索引实现，**key 中的字符必须在 alphabet 范围内**（比如 `string.printable`）。

所以我们不能直接把中文、全角字符或者 UTF-8 字节序列直接当 key 存。必须先“编码”成可以放进 trie 的 ASCII-safe 字符串。


### 4.2 dfs_ 

```python
def dfs_(self, chars, s, preTks, tkslist, _depth=0, _memo=None):
    pass
```
参数:
* **chars**：待切分的字符列表或字符串，例如 `"今天天气很好"` → `['今','天','天','气','很','好']`
* **s**：当前切分起始位置（索引）
* **preTks**：当前已经切好的 token 列表（例如 `[("今天", freq_tag)]`）
* **tkslist**：DFS 搜索得到的切分结果列表（最终输出）
* **_depth**：递归深度，防止无限递归
* **_memo**：记忆化缓存，避免重复计算

**核心目标**：

* 对给定字符串做 **多种可能的切分组合**。
* 使用 trie 判断哪些子串是词典中的合法 token。
* 对歧义区域（例如 `"今天天"`）尝试所有可能切分，保存到 `tkslist`。

---

### 2️⃣ 举例说明

假设我们有一个 trie 中存了这些词：

```text
今天
天气
很好
天
```

文本是：

```
chars = list("今天天气很好")  # ['今','天','天','气','很','好']
```

调用：

```python
tkslist = []
tokenizer.dfs_(chars, 0, [], tkslist)
```

---

DFS 递归过程:

1. **从索引 0 开始**：

   * 尝试切 `"今"` → 不在 trie 中，记作 (`今`, (-12, ''))
   * 尝试切 `"今天"` → 在 trie 中，记作 (`今天`, freq_tag)
   * 尝试切 `"今天天"` → `"今天天"` 不在 trie 中，停止继续扩展
   * 递归下一步从索引 2（`天`）开始

2. **索引 2**：

   * 尝试切 `"天"` → 在 trie 中 (`天`, freq_tag)
   * 尝试切 `"天气"` → 在 trie 中 (`天气`, freq_tag)
   * 尝试切 `"天气很"` → 不在 trie 中 → 停止

3. **索引 4**：

   * `"很"` → 不在 trie 中 → 记作 (`很`, (-12,''))
   * `"很好"` → 在 trie 中 → (`很好`, freq_tag)

4. **DFS 会穷举所有可能切分组合**：

   * `[("今天", "天气", "很好")]`
   * `[("今天", "天", "气", "很好")]`
   * `[("今", "天", "天", "气", "很好")]`

最终 `tkslist` 就是包含多种切分方案的列表。
