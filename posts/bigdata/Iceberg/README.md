# Apache Iceberg 学习路线

这组文章先通过具体数据认识 Iceberg 的存储体系，再建立整体架构，然后跟踪一次查询和一次写入，最后理解长期演进与生产实践。

1. [Iceberg 存储体系与整体架构](./001_Iceberg存储体系入门.md)：从六条订单出发，认识 Data File、Delete File、Manifest、Snapshot、Metadata、Catalog，以及 Iceberg 在完整架构中的位置。
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
