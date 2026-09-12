# Apache Iceberg 学习路线

这组文章沿用 `spark` 目录的叙述逻辑：先建立整体架构，再跟踪一次查询和一次写入，随后理解长期演进与生产实践。

1. [Iceberg 整体架构与表格式](./001_Iceberg整体架构与表格式.md)：Iceberg 位于哪一层，Catalog、Snapshot、Manifest 和数据文件是什么关系。
2. [元数据树与查询规划](./002_元数据树与查询规划.md)：查询谓词怎样逐层剪枝，hidden partitioning、field id 和 Scan Task 怎样工作。
3. [写入事务与行级更新](./003_写入事务与行级更新.md)：原子提交、乐观并发、Copy-on-Write、Merge-on-Read 和 Delete Files。
4. [表演进与性能维护](./004_表演进与性能维护.md)：Schema/Partition/Sort Evolution，以及 compaction、snapshot expiration 和 orphan cleanup。
5. [Spark 与 Flink 实践](./005_Spark与Flink实践.md)：Catalog 配置、DDL、MERGE、Metadata Tables、维护 procedures 和流式写入。

推荐先掌握两条主线：

```text
读：表名 → Metadata → Snapshot → Manifest List → Manifest → Data/Delete Files

写：生成文件 → 构造新 Snapshot → 验证冲突 → 原子切换 Metadata 指针
```

其余能力都建立在这两条主线之上。

