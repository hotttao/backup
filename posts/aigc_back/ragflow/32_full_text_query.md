---
weight: 1
title: "RagFlow Full Text Query"
date: 2025-08-20T21:00:00+08:00
lastmod: 2025-08-20T21:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Full Text Query"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

`rag\nlp` 模块提供了 NLP 相关的功能，如分词、查询构造器等。前面我们已经介绍了 NLP 中的 RagTokenizer 分词器的实现。这一节我们来讲解与检索相关的功能实现。

## 1. NLP 模块
在具体讲解检索实现之前，我们先来看一下 NLP 这个模块的整体结构。

```
rag/nlp/
├── __init__.py           # 模块初始化文件，包含通用NLP工具函数
├── query.py             # 查询处理模块
├── rag_tokenizer.py     # RAG专用分词器
├── search.py            # 搜索引擎核心模块
├── surname.py           # 中文姓氏识别模块
├── synonym.py           # 同义词处理模块
└── term_weight.py       # 词语权重计算模块
```

### 1.1 `__init__.py` - NLP工具集合
**核心功能：**
- **编码检测与转换**：自动检测文本编码格式，支持多种字符集
- **文档结构分析**：
  - 问题项目符号识别（如"第一问"、"第二条"等）
  - 章节标题层次结构识别
  - 目录页面自动移除
- **文本分块策略**：
  - `naive_merge`: 朴素合并策略，按token数量分块
  - `hierarchical_merge`: 层次化合并，基于文档结构分块
  - `naive_merge_with_images`: 支持图像的文本分块
- **多语言支持**：中英文识别和处理
- **图像处理**：图像拼接和文档位置信息处理

### 1.2 `rag_tokenizer.py` - 智能分词器
**核心功能：**
- **中文分词**：基于词典和统计的混合分词算法
- **英文处理**：词干提取和词形还原
- **多语言融合**：中英文混合文本的智能切分
- **细粒度分词**：`fine_grained_tokenize` 提供更精细的分词结果
- **词典管理**：
  - 支持用户自定义词典
  - 词频统计和词性标注
  - 动态词典加载


### 1.3 `search.py` - 搜索引擎核心
**核心功能：**
- **检索策略**：
  - 向量检索 + 全文检索融合
  - 重排序算法支持
  - 分页和结果聚合
- **搜索结果处理**：
  - 高亮显示匹配内容
  - 文档聚合统计
  - 相似度得分计算
- **标签系统**：
  - 文档标签提取和匹配
  - 查询标签分析
  - 标签权重计算
- **SQL查询**：支持直接SQL检索

### 1.4 `query.py` - 查询处理引擎
**核心功能：**
- **查询解析**：
  - 去除无关疑问词（"什么"、"如何"等）
  - 中英文混合查询处理
  - 查询词权重计算
- **混合检索**：
  - 文本匹配 + 向量相似度计算
  - 多字段查询支持（标题、内容、关键词等）
  - 同义词扩展查询
- **相似度计算**：
  - `hybrid_similarity`: 文本+向量混合相似度
  - `token_similarity`: 基于词汇的相似度
- **引用插入**：自动为生成答案插入文档引用标记

### 1.5 `synonym.py` - 同义词管理
**核心功能：**
- **同义词扩展**：基于预构建词典的同义词查找
- **英文同义词**：集成WordNet进行英文同义词扩展
- **动态更新**：支持Redis实时同义词更新
- **查询增强**：为搜索查询自动添加同义词，提高召回率

### 1.6 `term_weight.py` - 查询权重计算
**核心功能：**
- **TF-IDF计算**：基于词频和逆文档频率的权重计算
- **命名实体识别**：识别公司名、地名、学校名等实体类型
- **停用词过滤**：移除无意义的常用词
- **词汇合并**：将相关的短词合并为完整术语
- **权重标准化**：对计算出的权重进行归一化处理

### 1.7 `surname.py` - 姓氏识别
**核心功能：**
- **中文姓氏库**：包含常见单姓和复姓
- **姓氏判断**：`isit()` 函数判断给定文本是否为中文姓氏
- **命名实体支持**：为人名识别提供基础支持

从导入关系可以看到模块之间的依赖关系:
1. search 依赖:
  - query
2. query 依赖:
  - rag_tokenizer
  - term_weight
  - synonym
3. term_weight 依赖:
  - rag_tokenizer

从语义和依赖关系可以看到，ragflow 检索分成了两个模块:
1. query
2. search

这一节我们来学习 query 部分。


## 2. surname
 
surname 有一个包含常见姓名的词典，并提供了一个 isit 查询函数。

```python
m = set(["赵","钱","孙","李",
"周","吴","郑","王",...])

def isit(n):return n.strip() in m
```

## 3. synonym
synonym 主要用于同义词扩展。英文同义词扩展使用 wordnet。


```python
import logging
import json
import os
import time
import re
from nltk.corpus import wordnet
from api.utils.file_utils import get_project_base_directory



class Dealer:
    def __init__(self, redis=None):
        # 构造函数，redis 为可选参数；如果传入 redis 连接，则支持实时从 redis 拉取同义词表

        # lookup_num 用于控制何时触发从 redis 拉取更新（参见 load() 中的判断）
        # 初始设为很大，目的是在构造时不受 "<100" 的保护逻辑阻断（使得首次 load() 能通过 lookup_num 条件）。
        self.lookup_num = 100000000

        # load_tm 记录上次加载时间。这里初始化为一个很久以前的时间（time.time() - 1000000），
        # 目的是使得第一次调用 load() 时可以通过时间间隔的判断（tm - load_tm < 3600）。
        self.load_tm = time.time() - 1000000

        # 本地缓存的同义词字典（内存缓存），默认 None，稍后尝试从文件加载为 dict
        self.dictionary = None

        # synonym.json 是同义词的映射，默认是股票和股票代码的映射
        # {"阿为特": "873693",
        # "873693": "阿为特",}
        path = os.path.join(get_project_base_directory(), "rag/res", "synonym.json")
        try:
            self.dictionary = json.load(open(path, 'r'))
        except Exception:
            logging.warning("Missing synonym.json")
            self.dictionary = {}

        if not redis:
            logging.warning(
                "Realtime synonym is disabled, since no redis connection.")
        if not len(self.dictionary.keys()):
            logging.warning("Fail to load synonym")

        self.redis = redis
        # 触发一次 load()，尝试基于 redis 做更新（load() 内部有一系列判断，会决定是否实际去拉取）
        self.load()

    def load(self):
        # 从 redis 热更新同义词字典的逻辑（带节流）

        # 若没有 redis 连接，直接返回（不能热更新）
        if not self.redis:
            return

        # lookup_num 用作 "请求计数" 或节流阈值，若小于 100 则表示最近调用不够多，跳过频繁拉取
        # 这样可避免每次 lookup 时都触发 redis 读取，起到缓存节流的作用
        if self.lookup_num < 100:
            return

        # 基于时间判断：如果距离上次 load 小于 3600 秒（1 小时），也跳过
        tm = time.time()
        if tm - self.load_tm < 3600:
            return

        # 满足触发条件后，记录本次加载时间并重置 lookup 计数（从 0 开始统计下一轮）
        self.load_tm = time.time()
        self.lookup_num = 0

        # 从 redis 中读取 key 为 "kevin_synonyms" 的值，期望是一个 JSON 字符串
        d = self.redis.get("kevin_synonyms")
        if not d:
            # redis 中没有该键或值为空，直接返回（保持原有本地字典不变）
            return
        try:
            d = json.loads(d)
            # 将 redis 中的同义词数据替换掉本地缓存（原子替换）
            self.dictionary = d
        except Exception as e:
            logging.error("Fail to load synonym!" + str(e))

    def lookup(self, tk, topn=8):
        """
        查询同义词：当输入纯英文字母单词时，走 wordnet 路径；否则从本地/redis 字典查表。
        返回不超过 topn 个同义词（顺序由字典或 wordnet 决定）。
        """

        # 1) 如果 tk 完全由小写英文字母构成（^[a-z]+$），则使用 wordnet 查找同义词
        #    这里的正则只允许小写英文字母（没有数字/大写/下划线），因此若要兼容其它情况，
        #    调用方应在传入前做 tk = tk.lower() 或扩展匹配规则
        if re.match(r"[a-z]+$", tk):
            # wordnet.synsets(tk) 返回若干 Synset 对象；syn.name() 返回诸如 'dog.n.01' 的字符串
            res = list(set([re.sub("_", " ", syn.name().split(".")[0]) for syn in wordnet.synsets(tk)]) - set([tk]))
            # 返回非空字符串项，保留原顺序不可保证（set 之后顺序会被打乱）
            return [t for t in res if t]

        # 2) 非纯英文字时，采用字典查找路径（本地文件优先 + redis 热更新在 load() 中合并）
        # 每次 lookup 都会自增 lookup_num 并尝试调用 load()，load() 内会根据 lookup_num 和时间判断是否实际去 redis 拉取
        self.lookup_num += 1
        self.load()

        # 在字典中查找：先把 tk 转为小写并把连续空白转换为单空格，作为字典的 key
        key = re.sub(r"[ \t]+", " ", tk.lower())
        res = self.dictionary.get(key, [])

        if isinstance(res, str):
            res = [res]

        # 取前 topn 项返回（原字典顺序/wordnet 顺序决定最终优先级）
        return res[:topn]
```

### 3.1 wordnet
`wordnet` 是 **NLTK**（自然语言工具包，Natural Language Toolkit）中最重要的词汇资源之一，它本身是一个由普林斯顿大学维护的 **WordNet 词汇数据库**的 Python 接口。

#### 数据结构：同义词集（Synset）

* **Synset（同义词集）** 是 WordNet 的核心单元，每个 Synset 表示一组意义相同或相近的词。
* 例如：`wordnet.synsets("dog")` 会返回多个 Synset，因为 “dog” 既可以指动物、也可以指俚语“卑鄙的人”等。

```python
from nltk.corpus import wordnet as wn
synsets = wn.synsets("dog")
print(synsets)
# [Synset('dog.n.01'), Synset('frump.n.01'), Synset('dog.n.03'), ...]
```

以 **`frump.n.01`** 为例：

1. **`frump`**

   * **词元（lemma name）**，即同义词集中最典型的一个单词。
   * 这里就是单词 **frump**（意为“邋遢的人”）。

2. **`.n`**

   * **词性（part of speech, POS）** 缩写：

     * `n` → noun（名词）
     * `v` → verb（动词）
     * `a` → adjective（形容词）
     * `s` → adjective satellite（形容词卫星，修饰性形容词，依附于某些形容词）
     * `r` → adverb（副词）

3. **`.01`**

   * **义项编号（sense number）**，表示这是该词在该词性下的第几个含义。
   * `01` 就是第一个含义，`02` 就是第二个，以此类推。
   * 例如 `dog.n.01` 表示“家犬”，而 `dog.n.02` 则可能表示“讨厌的人”。

#### 词义和定义

每个 Synset 提供：

* **定义**（`definition()`）
* **例句**（`examples()`）
* **词元（lemma）**，即该同义词集中的所有单词（`lemmas()`）

```python
dog = wn.synset('dog.n.01')
print(dog.definition())   # "a member of the genus Canis..."
print(dog.examples())     # ["the dog barked all night"]
print(dog.lemmas())       # [Lemma('dog.n.01.dog'), Lemma('dog.n.01.domestic_dog'), ...]
```

---

#### 语义关系（WordNet 的亮点）

WordNet 不只是同义词库，还存储了丰富的语义网络：

* **同义词**（synonyms）：在一个 synset 内
* **反义词**（antonyms）：通过 `lemma.antonyms()`
* **上位词**（hypernyms）：更一般的概念
  例：dog → animal
* **下位词**（hyponyms）：更具体的概念
  例：dog → retriever
* **部分整体关系**（meronyms / holonyms）
  例：wheel 是 car 的部分（meronym）

```python
print(dog.hypernyms())   # [Synset('canine.n.02'), Synset('domestic_animal.n.01')]
print(dog.hyponyms()[:5]) # [Synset('basenji.n.01'), Synset('corgi.n.01'), ...]
```

---

#### 词形变换

可以把单词还原到 **原型形式（lemma form）**：

```python
from nltk.stem import WordNetLemmatizer
lemmatizer = WordNetLemmatizer()
print(lemmatizer.lemmatize("running", pos="v"))  # run
```

---

#### 相似度计算

WordNet 允许基于 **层级结构**计算词语的相似度：

* 路径相似度（path_similarity）
* Wu-Palmer 相似度（wup_similarity）

```python
dog = wn.synset('dog.n.01')
cat = wn.synset('cat.n.01')
print(dog.wup_similarity(cat))  # 0.857...

```

## 4. term_weight
term_weight 用于:
- **TF-IDF计算**：基于词频和逆文档频率的权重计算
- **命名实体识别**：识别公司名、地名、学校名等实体类型
- **停用词过滤**：移除无意义的常用词
- **词汇合并**：将相关的短词合并为完整术语
- **权重标准化**：对计算出的权重进行归一化处理


```python
import logging
import math
import json
import re
import os
import numpy as np
from rag.nlp import rag_tokenizer
from api.utils.file_utils import get_project_base_directory


class Dealer:
    def __init__(self):
        # 初始化停止词集合（用于预处理过滤）
        # 这些词在问答检索中信息量较低，常作为停用词被移除
        self.stop_words = set(["请问",
                               "您",
                               "你",
                               "我",
                               "他",
                               "是",
                               "的",
                               "就",
                               "有",
                               "于",
                               "及",
                               "即",
                               "在",
                               "为",
                               "最",
                               "有",
                               "从",
                               "以",
                               "了",
                               "将",
                               "与",
                               "吗",
                               "吧",
                               "中",
                               "#",
                               "什么",
                               "怎么",
                               "哪个",
                               "哪些",
                               "啥",
                               "相关"])

        # 内部函数：从磁盘加载一个 "term.freq" 格式的文件
        # 文件每行预期: token \t count
        # 返回值: 如果所有 token 的计数之和为0，则返回 token 的集合 (set(keys))，
        # 否则返回 {token: int(count)} 的字典。
        def load_dict(fnm):
            res = {}
            f = open(fnm, "r")
            while True:
                line = f.readline()
                if not line:
                    break
                arr = line.replace("\n", "").split("\t")
                # 若只有 token 一列，则默认为频次 0
                if len(arr) < 2:
                    res[arr[0]] = 0
                else:
                    res[arr[0]] = int(arr[1])

            # 计算总频次
            c = 0
            for _, v in res.items():
                c += v
            # 如果没有任何频次信息，则返回仅包含 token 的集合（表示无法用频次评分）
            if c == 0:
                return set(res.keys())
            return res

        fnm = os.path.join(get_project_base_directory(), "rag/res")
        self.ne, self.df = {}, {}
        # 尝试加载命名实体词典 ner.json（用于 ner() 映射）
        # {"873693": "stock", "阿为特": "stock","任": "firstnm"}
        try:
            self.ne = json.load(open(os.path.join(fnm, "ner.json"), "r"))
        except Exception:
            logging.warning("Load ner.json FAIL!")
        # 尝试加载词频表 term.freq（用于 df 函数）
        try:
            self.df = load_dict(os.path.join(fnm, "term.freq"))
        except Exception:
            logging.warning("Load term.freq FAIL!")

    def pretoken(self, txt, num=False, stpwd=True):
        """
        对原始文本做粗粒度清洗和分词（调用 rag_tokenizer.tokenize），并做停用词/标点过滤。

        参数:
          - txt: 原始字符串
          - num: 布尔。若 False，则单字符数字 token 会被过滤掉
          - stpwd: 布尔。是否启用 stop_words 过滤

        返回:
          - token 列表（字符串），不包含被替换成特殊占位符 "#" 的项
        """
        # 一类用于匹配各种标点符号与特殊字符的正则（用于把这些 token 统一替换为 '#')
        patt = [
            r"[~—\t @#%!<>,\.\?\":;'\{\}\[\]_=(\)\|，。？》•●○↓《；‘’：“”【¥ 】…￥！、·（）×`&\\/「」\\]"
        ]

        # 提供一个可配置替换表 rewt，目前为空（保留位置以便将来扩展）
        rewt = [
        ]
        for p, r in rewt:
            txt = re.sub(p, r, txt)

        res = []
        # 使用项目的 rag_tokenizer 进行分词，tokenize 返回字符串，随后 split 得到 token 列表
        for t in rag_tokenizer.tokenize(txt).split():
            tk = t
            # 过滤停用词或单个数字（当 num=False 时）
            if (stpwd and tk in self.stop_words) or (
                    re.match(r"[0-9]$", tk) and not num):
                continue
            # 将匹配到标点/特殊符号的 token 替换为 "#"
            for p in patt:
                if re.match(p, t):
                    tk = "#"
                    break
            # 将被替换为 '#' 的项或空字符串都忽略
            if tk != "#" and tk:
                res.append(tk)
        return res

    def tokenMerge(self, tks):
        """
        将一系列 token 进行合并，以便把可能的短 token（单字或短字母串）合成一个具有更高信息量的短语。

        规则要点：
         - oneTerm 判断一个 token 是否被视为“短项”（len==1 或者 由 1-2 个小写字母/数字组成）
         - 连续的短项会被合并：若长度 <5 则全部合并，否则只合并前两个
         - 对首位的特殊处理：当第一个 token 很短且第二个 token 是非英数字且长度>1 时，把两者合并

        返回值：合并后的 token 列表（保留原顺序）
        """
        def oneTerm(t): return len(t) == 1 or re.match(r"[0-9a-z]{1,2}$", t)

        res, i = [], 0
        while i < len(tks):
            j = i
            # 特殊首位合并场景：例如输入 ['多', '工位', ...]，将合并为 ['多 工位', ...]
            # 条件：首项为短项，且第二项长度>1 且第二项首字符不是字母/数字（例如中文），
            # 注意：此处使用 re.match(r"[0-9a-zA-Z]", tks[i+1]) 检查首字符是否是英文字母或数字
            if i == 0 and oneTerm(tks[i]) and len(
                    tks) > 1 and (len(tks[i + 1]) > 1 and not re.match(r"[0-9a-zA-Z]", tks[i + 1])):  # 多 工位
                res.append(" ".join(tks[0:2]))
                i = 2
                continue

            # 向后扫描：只要下一个 token 存在且是短项且不在 stop_words，就继续扩展
            while j < len(
                    tks) and tks[j] and tks[j] not in self.stop_words and oneTerm(tks[j]):
                j += 1
            # 如果连续短项数量 > 1，做合并；合并长度策略：若 <5 则全部合并，否则只合并前两个
            if j - i > 1:
                if j - i < 5:
                    res.append(" ".join(tks[i:j]))
                    i = j
                else:
                    res.append(" ".join(tks[i:i + 2]))
                    i = i + 2
            else:
                # 单个 token 不合并，直接放入结果
                if len(tks[i]) > 0:
                    res.append(tks[i])
                i += 1
        # 过滤掉空字符串
        return [t for t in res if t]

    def ner(self, t):
        """
        命名实体映射查询。
        """
        if not self.ne:
            return ""
        res = self.ne.get(t, "")
        if res:
            return res

    def split(self, txt):
        """
        将一个以空格分隔的 token 序列做轻量级后处理，合并相邻的英文字母结尾 token：
        如果当前 token 与前一个 token 都以英文字符结尾，并且二者在命名实体映射里都不是 "func"，
        则把它们合并为一个以空格连接的 token（例如把两个单词视作短语）。

        这个函数主要用于修复 rag_tokenizer 在某些场景把短英文拆分开的情况。
        """
        tks = []
        for t in re.sub(r"[ \t]+", " ", txt).split():
            if tks and re.match(r".*[a-zA-Z]$", tks[-1]) and \
               re.match(r".*[a-zA-Z]$", t) and tks and \
               self.ne.get(t, "") != "func" and self.ne.get(tks[-1], "") != "func":
                # 前后两个 token 最后都是字母，且都不是被标注为 func 的词，则合并
                tks[-1] = tks[-1] + " " + t
            else:
                tks.append(t)
        return tks

    def weights(self, tks, preprocess=True):
        """
        这是本类的核心：计算传入 token 序列的权重分布。

        参数:
          - tks: 可为 token 列表或字符串（若 preprocess=True，tks 语义上可能代表多个查询片段）
          - preprocess: 是否对每个输入 token 做预处理（tokenize + merge）后再计算权重

        返回:
          - 列表 [(token, normalized_weight), ...]，权重归一化为和为 1

        下面将逐个说明内部使用的辅助函数及计算公式。
        """
        # skill 函数尝试根据某个 self.sk 字典判定技能类 token 的额外权重倍增；
        # 但注意：在本代码片段中 self.sk 并未被定义，这里会抛出 AttributeError。
        # 这可能是用户代码在其他地方设置 self.sk 的约定，或是个遗漏（潜在 bug）。
        def skill(t):
            if t not in self.sk:
                return 1
            return 6

        # ner 函数对 token 给出一个基于命名实体类型的放缩因子
        def ner(t):
            # 若 token 为纯数字/小数/连接符序列，认为信息量高，返回2
            if re.match(r"[0-9,.]{2,}$", t):
                return 2
            # 若 token 为 1-2 个小写英文字母，返回一个非常小的权重(0.01)，认为信息量非常低
            if re.match(r"[a-z]{1,2}$", t):
                return 0.01
            # 若没有命名实体字典，则默认 1
            if not self.ne or t not in self.ne:
                return 1
            # 否则根据命名实体的类别返回对应权重
            m = {"toxic": 2, "func": 1, "corp": 3, "loca": 3, "sch": 3, "stock": 3,
                 "firstnm": 1}
            # 注意：如果 self.ne[t] 的值不在 m 中，这里会 KeyError；实际使用时应做好容错
            return m[self.ne[t]]

        # postag 使用分词器的词性标注结果，为不同词性分配不同权重因子
        def postag(t):
            t = rag_tokenizer.tag(t)
            # 副词/连词/副词? 给予较低权重
            if t in set(["r", "c", "d"]):
                return 0.3
            # 地名/机构等特殊名词更重要
            if t in set(["ns", "nt"]):
                return 3
            if t in set(["n"]):
                return 2
            # 数字类也重要
            if re.match(r"[0-9-]+", t):
                return 2
            return 1

        # freq: 估计 token 在语料/语言模型中的频次
        # 该函数尝试从 rag_tokenizer.freq 获取频次（若不可用再做细分），并做了若干启发式处理
        def freq(t):
            # 数字类 token 的频次设为 3（经验值）
            if re.match(r"[0-9. -]{2,}$", t):
                return 3
            s = rag_tokenizer.freq(t)
            # 如果分词器未返回频次并且 token 属于英文字母/点/空格/短横线的组合，则认为是英文 token，给予非常高的 "频次" 300
            # 这样做可能是为了让英文 token 在 idf 计算中被视为低信息量（较大频次 -> 低 idf）或反之，需结合 idf 公式理解
            if not s and re.match(r"[a-z. -]+$", t):
                return 300
            if not s:
                s = 0

            # 若没有直接频次并且 token 较长，尝试做细粒度切分并对子 token 递归计算频次
            if not s and len(t) >= 4:
                s = [tt for tt in rag_tokenizer.fine_grained_tokenize(t).split() if len(tt) > 1]
                if len(s) > 1:
                    # 若能切出多个子 token，则取子 token 的最小 freq 并缩放为 1/6
                    s = np.min([freq(tt) for tt in s]) / 6.
                else:
                    s = 0

            # 最低频次下限为 10（避免 idf 过大）
            return max(s, 10)

        # df: 文档频次/全库频次估计（用于第二种 idf 计算）
        def df(t):
            if re.match(r"[0-9. -]{2,}$", t):
                return 5
            if t in self.df:
                # 如果在预加载的 df 字典中有值，则在其基础上加 3 作为平滑
                return self.df[t] + 3
            elif re.match(r"[a-z. -]+$", t):
                # 英文 token 的默认 df 值为 300
                return 300
            elif len(t) >= 4:
                s = [tt for tt in rag_tokenizer.fine_grained_tokenize(t).split() if len(tt) > 1]
                if len(s) > 1:
                    # 与 freq 类似，对长 token 做细粒度拆分并对其 df 做递归计算
                    return max(3, np.min([df(tt) for tt in s]) / 6.)

            # 默认 df 值为 3（经验值）
            return 3

        # idf 计算公式（经验性）：
        # idf(s, N) = log10(10 + ((N - s + 0.5) / (s + 0.5)))
        # 说明：这里在 log 内加了常数 10，和常见 idf 公式不同，目的是使得 idf 值更加平滑并避免负值。
        def idf(s, N): return math.log10(10 + ((N - s + 0.5) / (s + 0.5)))

        tw = []  # 临时保存 (token, weight) 对
        # preprocess=False 表示传入的 tks 已经是按 token 拆分好并预处理过，直接计算权重
        if not preprocess:
            # 使用两个不同的语料规模常数来分别计算两套 idf（idf1、idf2），随后按 0.3/0.7 加权
            idf1 = np.array([idf(freq(t), 10000000) for t in tks])
            idf2 = np.array([idf(df(t), 1000000000) for t in tks])
            # 将命名实体因子与词性因子相乘作为放缩因子
            wts = (0.3 * idf1 + 0.7 * idf2) * \
                np.array([ner(t) * postag(t) for t in tks])
            wts = [s for s in wts]
            tw = list(zip(tks, wts))
        else:
            # preprocess=True：对传入的每个片段做 pretoken -> tokenMerge，然后计算每个子 token 权重并展开
            for tk in tks:
                # 先做粗分词并去停用词，接着对短项做合并，得到最终子 token 列表 tt
                tt = self.tokenMerge(self.pretoken(tk, True))
                # 计算每个子 token 的两种 idf
                idf1 = np.array([idf(freq(t), 10000000) for t in tt])
                idf2 = np.array([idf(df(t), 1000000000) for t in tt])
                # 组合 idf 并乘以 ner 与 postag 因子
                wts = (0.3 * idf1 + 0.7 * idf2) * \
                    np.array([ner(t) * postag(t) for t in tt])
                wts = [s for s in wts]
                tw.extend(zip(tt, wts))

        # 归一化：将所有权重求和 S，然后返回 (token, weight/S)
        S = np.sum([s for _, s in tw])
        # 为避免除以 0 的情况，若 S==0 则此处会抛出警告/异常；一般而言 S 不应为 0
        return [(t, s / S) for t, s in tw]
```

### 3.1 权重计算

`weights()` 函数的目的是计算 **query term weighting**（查询词加权），类似 **BM25 / TF-IDF 的思想**，结合了 NLP 特征（NER、词性、词频等），目的是衡量每个 token 对查询或检索的重要性。
* 输入一组 token（tks），
* 给每个 token 计算一个 **权重**（数值），
* 这些权重归一化（归一化后总和=1），作为词的重要性分布。

这和搜索引擎里 **查询词加权** 是一样的思想：哪些词更关键、应该更大程度影响匹配。


#### (1) `idf(s, N)`

```python
def idf(s, N): 
    return math.log10(10 + ((N - s + 0.5) / (s + 0.5)))
```

* **原理**：典型 **Inverse Document Frequency**(逆文档频率)。
* **语义**：如果某词在很多文档出现（频率高），它的信息量低 → 权重应该小；如果很少出现，区分度强 → 权重应该大。
* **这里加了 10 平滑**，避免值太小/为负。

---

#### (2) `freq(t)`

* 基于 **token 的出现频率**（可能是全局词表里的 term frequency 或 tokenizer 提供的频率）。
* 高频词 → 信息量小 → 最后权重会降低。
* 如果没查到频率，还做了 **fine-grained tokenization**（进一步拆词），用子词的频率估计。

> 这保证了：稀有词、长词（低频） → 权重提升。

---

#### (3) `df(t)`

* 类似文档频率（document frequency）。
* 如果词在很多文档里都出现过 → 权重低。
* 如果是英文短词（like "the", "is"）→ 默认权重给到很低（300，表示非常常见）。
* 如果是长词但不在词典里，会拆成子词，取子词的 DF。

> 这就是 **逆文档频率**的近似。

---

#### (4) `ner(t)`

* 用命名实体识别标签（NER）来调整权重。
* 例如：

  * 人名（`firstnm`）权重低（1），
  * 公司、地名、股票、学校（`corp/loca/sch/stock`）权重高（3），
  * 数字（`[0-9,.]{2,}`）→ 2。

**语义**：实体通常是关键信息，尤其是机构、地点，比停用词或功能词更重要。

---

#### (5) `postag(t)`

* 基于词性标注（POS tag）。
* 代词、副词 → 权重降低（0.3）。
* 名词、专有名词 → 权重升高（2-3）。
* 数字也提升到 2。

**语义**：符合 IR 经验：名词（尤其实体名词）比虚词更重要。

---

#### 权重计算公式

```python
idf1 = np.array([idf(freq(t), 10000000) for t in tt])
idf2 = np.array([idf(df(t), 1000000000) for t in tt])
wts = (0.3 * idf1 + 0.7 * idf2) * np.array([ner(t) * postag(t) for t in tt])

# 归一化
S = np.sum([s for _, s in tw])
return [(t, s / S) for t, s in tw]
```

* **分两部分**：

  * `idf1`: 基于词频 (freq) 的逆频率
  * `idf2`: 基于文档频率 (df) 的逆频率
  * 混合：`0.3 * idf1 + 0.7 * idf2`（文档频率更重要）

* **再乘上 NER 与 POS 权重**

  * 保证实体/名词更突出，虚词/高频词更弱。

* 归一化

  * 把所有权重加起来再归一化。
  * 这样保证返回结果是个概率分布，方便后续计算（比如句子相似度时做加权）。

---

#### 总结

`weights()` 是一个 **混合启发式的 term weighting 方案**：

1. **低频稀有词 → 权重高**（信息量大）。
2. **高频常见词/停用词 → 权重低**（信息量小）。
3. **命名实体 → 权重高**（通常是关键信息）。
4. **名词/数字 → 权重高**；虚词 → 权重低。
5. **归一化为概率分布** → 方便做向量组合或相似度计算。

它结合了 **IR（TF-IDF / BM25 思想）** 和 **NLP（NER+POS 特征）**，使得 query 或文本表示更符合语义检索的需要。


## 5. query
`query.py` 实现查询处理引擎，**核心功能：**
- **查询解析**：
  - 去除无关疑问词（"什么"、"如何"等）
  - 中英文混合查询处理
  - 查询词权重计算
- **混合检索**：
  - 文本匹配 + 向量相似度计算
  - 多字段查询支持（标题、内容、关键词等）
  - 同义词扩展查询
- **相似度计算**：
  - `hybrid_similarity`: 文本+向量混合相似度
  - `token_similarity`: 基于词汇的相似度
- **引用插入**：自动为生成答案插入文档引用标记


```python
# -*- coding: utf-8 -*-

import logging  
import json     
import re       
from collections import defaultdict  
from rag.utils.doc_store_conn import MatchTextExpr  # 文本检索表达式（用于底层数据存储，如 ES/OpenSearch 的查询拼装）
from rag.nlp import rag_tokenizer, term_weight, synonym


class FulltextQueryer:
  def __init__(self):
        self.tw = term_weight.Dealer()  # 词权重计算器（含分词/权重策略）
        self.syn = synonym.Dealer()     # 同义词查询器
        self.query_fields = [           # 默认检索字段与权重（^ 表示字段级 boost）
            "title_tks^10",           # 标题分词权重最高
            "title_sm_tks^5",         # 标题小粒度分词次高
            "important_kwd^30",       # 标注的重要关键词给予更高权重
            "important_tks^20",       # 重要词项
            "question_tks^20",        # 问句中出现的词项
            "content_ltks^2",         # 正文长词分词，较低权重
            "content_sm_ltks",        # 正文小粒度分词，默认权重
        ]

    @staticmethod
    def subSpecialChar(line):
        # 将 Lucene/ES 查询语法中的特殊字符转义，防止被解析为操作符
        return re.sub(r"([:\{\}/\[\]\-\*\"\(\)\|\+~\^])", r"\\\1", line).strip()

    @staticmethod
    def isChinese(line):
        # 粗略判定文本是否可以视为“中文主导”：
        # 1) 若用空白分割后词数 <= 3，直接认为是中文（常见中文短问）
        arr = re.split(r"[ \t]+", line)
        if len(arr) <= 3:
            return True
        # 2) 统计非纯英文字母 token 的比例 >= 0.7 则视为中文
        e = 0
        for t in arr:
            if not re.match(r"[a-zA-Z]+$", t):
                e += 1
        return e * 1.0 / len(arr) >= 0.7

    @staticmethod
    def rmWWW(txt):
        # 规则化去除问句口头语/停用短语（中英双语），便于抽取关键语义
        patts = [
            (
                r"是*(什么样的|哪家|一下|那家|请问|啥样|咋样了|什么时候|何时|何地|何人|是否|是不是|多少|哪里|怎么|哪儿|怎么样|如何|哪些|是啥|啥是|啊|吗|呢|吧|咋|什么|有没有|呀|谁|哪位|哪个)是*",
                "",
            ),
            (r"(^| )(what|who|how|which|where|why)('re|'s)? ", " "),
            (
                r"(^| )('s|'re|is|are|were|was|do|does|did|don't|doesn't|didn't|has|have|be|there|you|me|your|my|mine|just|please|may|i|should|would|wouldn't|will|won't|done|go|for|with|so|the|a|an|by|i'm|it's|he's|she's|they|they're|you're|as|by|on|in|at|up|out|down|of|to|or|and|if) ",
                " ")
        ]
        otxt = txt  # 备份原文，以防清洗后完全为空
        for r, p in patts:
            txt = re.sub(r, p, txt, flags=re.IGNORECASE)  # 忽略大小写替换
        if not txt:
            txt = otxt  # 清洗为空则回退原文
        return txt

    @staticmethod
    def add_space_between_eng_zh(txt):
        # 输入: "我喜欢Python编程"
        # 输出: "我喜欢 Python 编程"
        # 在英文字母/数字 与 中文之间插入空格，便于后续分词
        # (ENG/ENG+NUM) + ZH
        txt = re.sub(r'([A-Za-z]+[0-9]+)([\u4e00-\u9fa5]+)', r'\1 \2', txt)
        # ENG + ZH
        txt = re.sub(r'([A-Za-z])([\u4e00-\u9fa5]+)', r'\1 \2', txt)
        # ZH + (ENG/ENG+NUM)
        txt = re.sub(r'([\u4e00-\u9fa5]+)([A-Za-z]+[0-9]+)', r'\1 \2', txt)
        txt = re.sub(r'([\u4e00-\u9fa5]+)([A-Za-z])', r'\1 \2', txt)
        return txt

    def question(self, txt, tbl="qa", min_match: float = 0.6):
        # 构造“问句级”全文检索表达式；兼容中英文；返回 (MatchTextExpr, keywords)
        txt = FulltextQueryer.add_space_between_eng_zh(txt)  # 先处理中英混排空格
        txt = re.sub(
            r"[ :|\r\n\t,，。？?/`!！&^%%()\[\]{}<>]+",
            " ",
            rag_tokenizer.tradi2simp(rag_tokenizer.strQ2B(txt.lower())),  # 全角->半角，繁体->简体，再转小写
        ).strip()
        otxt = txt                    # 保留清洗后的初值
        txt = FulltextQueryer.rmWWW(txt)  # 去除口头语与停用短语

        if not self.isChinese(txt):  # 非中文主导：按英文策略构造查询
            txt = FulltextQueryer.rmWWW(txt)  # 再清洗一次
            tks = rag_tokenizer.tokenize(txt).split()  # 英文分词
            keywords = [t for t in tks if t]           # 关键词初始为分词结果
            tks_w = self.tw.weights(tks, preprocess=False)  # 计算词权重（不再额外预处理）
            # 清洗每个 token：去掉空白、引号、单字符、前缀 +/- 等，确保能用于查询语法
            tks_w = [(re.sub(r"[ \\\"'^]", "", tk), w) for tk, w in tks_w]
            # 去掉长度为 1 的英文或数字 token，通常没有语义价值，比如 "a"、"3"。
            tks_w = [(re.sub(r"^[a-z0-9]$", "", tk), w) for tk, w in tks_w if tk]
            # 去掉 token 开头的加减号，这类符号通常是文本噪声，例如 +value → value
            tks_w = [(re.sub(r"^[\+-]", "", tk), w) for tk, w in tks_w if tk]
            tks_w = [(tk.strip(), w) for tk, w in tks_w if tk.strip()]
            syns = []  # 每个 token 的同义词查询片段（带字段级权重）
            for tk, w in tks_w[:256]:
                syn = self.syn.lookup(tk)                         # 查同义词
                syn = rag_tokenizer.tokenize(" ".join(syn)).split()  # 对同义词再分词
                keywords.extend(syn)                              # 同义词也加入关键词列表
                syn = ["\"{}\"^{:.4f}".format(s, w / 4.) for s in syn if s.strip()]  # 同义词整体降权
                syns.append(" ".join(syn))

            # 构造主查询：每个 token 带权重，并把其同义词 OR 进来
            q = ["({}^{:.4f}".format(tk, w) + " {})".format(syn) for (tk, w), syn in zip(tks_w, syns) if
                 tk and not re.match(r"[.^+\(\)-]", tk)]  # 过滤 Lucene 特殊字符
            # 相邻 token 形成短语查询，提升相关性（*2 权重）
            for i in range(1, len(tks_w)):
                left, right = tks_w[i - 1][0].strip(), tks_w[i][0].strip()
                if not left or not right:
                    continue
                q.append(
                    '"%s %s"^%.4f'
                    % (
                        tks_w[i - 1][0],
                        tks_w[i][0],
                        max(tks_w[i - 1][1], tks_w[i][1]) * 2,
                    )
                )
            if not q:
                q.append(txt)  # 极端情况下保底用原文本
            query = " ".join(q)
            # (natural^0.4000 ("innate"^0.1000 "essential"^0.1000)) 
            # OR (language^0.3500 ("speech"^0.0875 "tongue"^0.0875)) 
            # OR (processing^0.2500 ("handling"^0.0625 "treatment"^0.0625)) 
            # OR "natural language"^0.8 
            # OR "language processing"^0.7

            return MatchTextExpr(
                self.query_fields, query, 100  # 100 可理解为最大检索条数或内部阈值（依赖实现）
            ), keywords

        # 中文主导：定义一个是否需要细粒度切分的判断（对非纯字母/数字的较长词做二次切分）
        def need_fine_grained_tokenize(tk):
            if len(tk) < 3:
                return False
            if re.match(r"[0-9a-z\.\+#_\*-]+$", tk):
                return False
            return True

        txt = FulltextQueryer.rmWWW(txt)  # 再次清洗
        qs, keywords = [], []
        for tt in self.tw.split(txt)[:256]:  # 将句子按“权重引导”的切分（而非简单空格）
            if not tt:
                continue
            keywords.append(tt)              # 原词加入关键词
            twts = self.tw.weights([tt])     # 计算该片段内部各 token 的权重
            syns = self.syn.lookup(tt)       # 片段级同义词
            if syns and len(keywords) < 32:
                keywords.extend(syns)        # 控制关键词表的上限，避免过长
            logging.debug(json.dumps(twts, ensure_ascii=False))
            tms = []  # 保存 (局部查询表达式, 权重)
            for tk, w in sorted(twts, key=lambda x: x[1] * -1):  # 按权重从高到低
                sm = (
                    rag_tokenizer.fine_grained_tokenize(tk).split()
                    if need_fine_grained_tokenize(tk)
                    else []
                )  # 需要时做细粒度切分（如“上海交通大学” -> 上海/交通/大学）
                sm = [
                    re.sub(
                        r"[ ,\./;'\[\]\\`~!@#$%\^&\*\(\)=\+_<>\?:\"\{\}\|，。；‘’【】、！￥……（）——《》？：“”-]+",
                        "",
                        m,
                    )
                    for m in sm
                ]  # 去除各种中英文标点
                sm = [FulltextQueryer.subSpecialChar(m) for m in sm if len(m) > 1]  # 转义 Lucene 特殊字符
                sm = [m for m in sm if len(m) > 1]  # 过滤长度为1的子词

                if len(keywords) < 32:
                    keywords.append(re.sub(r"[ \\\"']+", "", tk))  # 原 token 的去符号形态加入关键词
                    keywords.extend(sm)  # 子词也作为关键词

                tk_syns = self.syn.lookup(tk)                       # token 级同义词查询
                tk_syns = [FulltextQueryer.subSpecialChar(s) for s in tk_syns]
                if len(keywords) < 32:
                    keywords.extend([s for s in tk_syns if s])     # 同义词也补充到关键词
                tk_syns = [rag_tokenizer.fine_grained_tokenize(s) for s in tk_syns if s]
                tk_syns = [f"\"{s}\"" if s.find(" ") > 0 else s for s in tk_syns]  # 含空格的同义词加引号

                if len(keywords) >= 32:
                    break

                tk = FulltextQueryer.subSpecialChar(tk)  # 转义主 token
                if tk.find(" ") > 0:
                    tk = '"%s"' % tk  # 含空格的 token 作为短语匹配
                if tk_syns:
                    tk = f"({tk} OR (%s)^0.2)" % " ".join(tk_syns)  # 同义词 OR 进来，较低权重
                if sm:
                    tk = f'{tk} OR "%s" OR ("%s"~2)^0.5' % (" ".join(sm), " ".join(sm))  # 子词短语及近邻匹配
                if tk.strip():
                    tms.append((tk, w))  # 记录该 token 的查询子句及其权重

            tms = " ".join([f"({t})^{w}" for t, w in tms])  # 将 token 子句用 OR 连接并加权

            if len(twts) > 1:
                tms += ' ("%s"~2)^1.5' % rag_tokenizer.tokenize(tt)  # 片段整体作为近邻短语再加一条（提升连贯匹配）

            syns = " OR ".join(
                [
                    '"%s"'
                    % rag_tokenizer.tokenize(FulltextQueryer.subSpecialChar(s))
                    for s in syns
                ]
            )  # 片段级同义词短语 OR 起来
            if syns and tms:
                tms = f"({tms})^5 OR ({syns})^0.7"  # 主子句整体高权重，同义词整体低权重

            qs.append(tms)  # 追加该片段的查询表达式

        if qs:
            query = " OR ".join([f"({t})" for t in qs if t])  # 将所有片段用 OR 汇总
            if not query:
                query = otxt  # 兜底：使用清洗后的原文本
            return MatchTextExpr(
                self.query_fields, query, 100, {"minimum_should_match": min_match}  # minimum_should_match 控制布尔匹配下限
            ), keywords
        return None, keywords  # 若无法构造查询，返回空表达式与关键词

    def hybrid_similarity(self, avec, bvecs, atks, btkss, tkweight=0.3, vtweight=0.7):
        # 计算“混合相似度”：向量相似度（余弦）与词项相似度的加权和
        from sklearn.metrics.pairwise import cosine_similarity as CosineSimilarity
        import numpy as np
        # sims = [[ 1.  0. -1.]]
        sims = CosineSimilarity([avec], bvecs)  # 计算 avec 与每个 bvec 的余弦相似度，形状 (1, n)
        tksim = self.token_similarity(atks, btkss)  # 计算基于词权重的相似度（列表，长度 n）
        if np.sum(sims[0]) == 0:
            return np.array(tksim), tksim, sims[0]  # 若全部向量相似度为 0，则仅用词项相似度
        return np.array(sims[0]) * vtweight + np.array(tksim) * tkweight, tksim, sims[0]

    def token_similarity(self, atks, btkss):
        # 词项相似度：将 token 序列映射为 {token: weight}，然后用 similarity 计算
        def toDict(tks):
            if isinstance(tks, str):
                tks = tks.split()  # 字符串按空格切词
            d = defaultdict(int)
            wts = self.tw.weights(tks, preprocess=False)  # 计算每个 token 的权重
            for i, (t, c) in enumerate(wts):
                d[t] += c  # 累加权重（若重复出现）
            return d

        atks = toDict(atks)
        btkss = [toDict(tks) for tks in btkss]
        return [self.similarity(atks, btks) for btks in btkss]  # 对每个文档/段落计算一次

    def similarity(self, qtwt, dtwt):
        # 计算查询与文档的“词权重重合度”：s/q，其中 s 为共同词权重之和，q 为查询权重和
        if isinstance(dtwt, type("")):
            dtwt = {t: w for t, w in self.tw.weights(self.tw.split(dtwt), preprocess=False)}
        if isinstance(qtwt, type("")):
            qtwt = {t: w for t, w in self.tw.weights(self.tw.split(qtwt), preprocess=False)}
        s = 1e-9  # 加上极小值，防止除零
        for k, v in qtwt.items():
            if k in dtwt:
                s += v  # * dtwt[k]  # 注意：这里未乘文档侧权重，表示“命中则按查询权重累加”
        q = 1e-9
        for k, v in qtwt.items():
            q += v  # * v  # 同理，这里没有平方处理，表示简单归一化
        return s/q  # 返回重合度（曾尝试过更复杂的归一化，见注释）

    def paragraph(self, content_tks: str, keywords: list = [], keywords_topn=30):
        # 根据一段内容的“词项+同义词”构造段落级 MatchTextExpr；常用于标签/主题聚合
        if isinstance(content_tks, str):
            # 注意：此处对字符串做的是按“字符”迭代而非按“词”分割，
            # 如果 content_tks 实际是“以空格分隔的 token 字符串”，此写法可能不是预期（可能是个潜在问题）。
            content_tks = [c.strip() for c in content_tks.strip() if c.strip()]
        tks_w = self.tw.weights(content_tks, preprocess=False)  # 计算段落中每个 token 的权重

        keywords = [f'"{k.strip()}"' for k in keywords]  # 现有关键词全部加引号，作为精确短语匹配的起点
        for tk, w in sorted(tks_w, key=lambda x: x[1] * -1)[:keywords_topn]:  # 选取 top-N 高权重 token
            tk_syns = self.syn.lookup(tk)                         # 查 token 的同义词
            tk_syns = [FulltextQueryer.subSpecialChar(s) for s in tk_syns]
            tk_syns = [rag_tokenizer.fine_grained_tokenize(s) for s in tk_syns if s]
            tk_syns = [f"\"{s}\"" if s.find(" ") > 0 else s for s in tk_syns]  # 含空格的同义词短语需加引号
            tk = FulltextQueryer.subSpecialChar(tk)              # 转义主 token
            if tk.find(" ") > 0:
                tk = '"%s"' % tk  # 含空格则当作短语
            if tk_syns:
                tk = f"({tk} OR (%s)^0.2)" % " ".join(tk_syns)  # 同义词 OR 进来，权重较低
            if tk:
                keywords.append(f"{tk}^{w}")  # 主 token 以其权重加入查询

        return MatchTextExpr(self.query_fields, " ".join(keywords), 100,
                             {"minimum_should_match": min(3, len(keywords) // 10)})  # 至少匹配一定比例的子句

```

### 5.1 question
`question` 函数的目标是：

* 接收一个用户的查询文本（`txt`），可能是中文、英文，或中英文混合。
* 输出一个 **搜索引擎能理解的查询表达式**（`MatchTextExpr`）和关键词列表。

核心思路是：**把自然语言查询拆分成关键 token，计算权重，加上同义词扩展，再构建搜索表达式**。

---


#### （1）中英文分开处理

```python
txt = FulltextQueryer.add_space_between_eng_zh(txt)
txt = rag_tokenizer.tradi2simp(rag_tokenizer.strQ2B(txt.lower()))
txt = FulltextQueryer.rmWWW(txt)
```

* **add_space_between_eng_zh**：确保中英文混排的词能被 tokenizer 正确拆分。
* **strQ2B**：全角字符 → 半角，统一字符宽度。
* **tradi2simp**：繁体 → 简体，统一中文字符。
* **rmWWW**：去掉无意义的疑问词/虚词，如 “请问”“吗”“what”等。

> **目的**：把原始查询文本变成干净、标准化的 token 流。

---

#### （2）判断中文或英文

```python
if not self.isChinese(txt):
    # 英文处理逻辑
else:
    # 中文处理逻辑
```

* 英文主要用 **空格分词 + 同义词扩展 + n-gram 短语组合**
* 中文需要 **细粒度分词 + 权重计算 + 同义词扩展**

> 原理：英文本身是空格分隔，中文需要 tokenizer 切分；而且中文同义词、权重对匹配影响更大。

---

#### （3）英文查询构建

```python
tks = rag_tokenizer.tokenize(txt).split()
tks_w = self.tw.weights(tks, preprocess=False)
for tk, w in tks_w[:256]:
    syn = self.syn.lookup(tk)
```

* **tokenize**：把英文句子拆成单词。
* **weights**：给每个单词一个权重（重要性）。
* **syn.lookup**：查找同义词扩展，例如 `"car"` → `"automobile"`。

```python
q = ["({}^{:.4f}".format(tk, w) + " {})".format(syn) for (tk, w), syn in zip(tks_w, syns)]
```

* 构造查询表达式 `(tk^weight OR syns)`
* 每个 token 都有自己的权重，用 **^weight** 来告诉搜索引擎这个词重要性。

> **目的**：增强英文查询的召回能力，让同义词也能匹配。

---

#### （4）中文查询构建


中文逻辑更复杂：

1. **分词 + 细粒度切分**

   ```python
   tt = self.tw.split(txt)[:256]
   ```

   * 使用 `term_weight.Dealer.split` 得到重要词，避免无意义词干扰。
2. **计算 token 权重**

   ```python
   twts = self.tw.weights([tt])
   ```

   * 权重 = 词频 + 文档频率 + NER + 词性等。
   * **目的**：更重要的词在查询中权重更高。
3. **同义词扩展**

   ```python
   tk_syns = self.syn.lookup(tk)
   ```

   * 中文同义词也被加入查询。
4. **组合短语、模糊匹配**

   ```python
   if sm:
       tk = f'{tk} OR "%s" OR ("%s"~2)^0.5' % (" ".join(sm), " ".join(sm))
   ```

   * `"%s"~2`：允许两个词之间有一个词间隔（近似匹配）。
   * 避免精确匹配太严格导致漏匹配。

> **目的**：中文分词的模糊匹配 + 同义词 + 权重组合，让搜索既准确又召回高。

---

#### （5）最终组合查询


```python
query = " OR ".join([f"({t})" for t in qs if t])
return MatchTextExpr(self.query_fields, query, 100, {"minimum_should_match": min_match})
```

* 把每个 token 或 token 组合 OR 起来，构成完整查询表达式。
* **minimum_should_match**：至少匹配多少 token 才算命中，提高精确度。
* **query_fields**：定义查询的索引字段和权重。

> 核心思想：搜索表达式 = **token OR 同义词 OR 短语模糊匹配 + 权重**

---

#### 总结

| 层级        | 原理                           | 作用                  |
| --------- | ---------------------------- | ------------------- |
| 预处理       | 中文简繁转换、全角半角、空格分隔             | 清洗文本，标准化            |
| 分词        | 中文/英文分开处理                    | 得到搜索的最小单元 token     |
| 权重        | 词频、文档频率、NER、词性               | 重要词更优先匹配            |
| 同义词扩展     | 英文 WordNet，中文词典              | 提升召回，覆盖同义表达         |
| 短语 & 模糊匹配 | `"word1 word2"~2`            | 保留上下文顺序信息，允许近似匹配    |
| 组合查询      | OR 拼接，minimum_should_match | 搜索引擎可理解的表达式，提高召回和精度 |

> 总体来说，就是 **把自然语言查询转化为搜索引擎友好的加权 token 查询，并且考虑同义词、短语和模糊匹配**。

