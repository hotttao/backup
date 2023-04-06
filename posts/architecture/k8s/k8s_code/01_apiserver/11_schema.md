---
weight: 1
title: "Schema"
date: 2023-03-06T22:00:00+08:00
lastmod: 2023-03-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. ObjectTyper 接口

```go
// ObjectKinds 返回 go 对象的所有可能的组、版本、类型，如果对象被认为是未经版本控制的，则返回 true，
// 如果它不是指针或未注册，则返回错误。
func (s *Scheme) ObjectKinds(obj Object) ([]schema.GroupVersionKind, bool, error) {
	// Unstructured 对象总是被认为具有它们声明的 GVK（GroupVersionKind）。
	if _, ok := obj.(Unstructured); ok {
		// 为了识别对象，我们要求 GVK 必须被填充。
		gvk := obj.GetObjectKind().GroupVersionKind()
		if len(gvk.Kind) == 0 {
			return nil, false, NewMissingKindErr("unstructured object has no kind")
		}
		if len(gvk.Version) == 0 {
			return nil, false, NewMissingVersionErr("unstructured object has no version")
		}
		return []schema.GroupVersionKind{gvk}, false, nil
	}

	v, err := conversion.EnforcePtr(obj)
	if err != nil {
		return nil, false, err
	}
	t := v.Type()
    
    // 根据 typeToGVK 找到 Object 映射的 GVK
	gvks, ok := s.typeToGVK[t]
	if !ok {
		return nil, false, NewNotRegisteredErrForType(s.schemeName, t)
	}
	_, unversionedType := s.unversionedTypes[t]

	return gvks, unversionedType, nil
}

// 如果 Scheme 能够处理对象的给定组、版本、类型（GVK），则 Recognizes 返回 true。
func (s *Scheme) Recognizes(gvk schema.GroupVersionKind) bool {
	_, exists := s.gvkToType[gvk]
	return exists
}
```