---
weight: 1
title: "Codec、Codec Factory"
date: 2023-03-03T22:00:00+08:00
lastmod: 2023-03-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Pod 使用进阶"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. codec/codec factory
前面我们介绍了 API 对象序列化与反序列化的操作，如果是我们自己开发，接下来我们就会遇到下面这些问题:
1. 我们有多种序列化的协议完成 API 的编码和解码，我们需要一个类似 map 的结构来维护当前支持的所有协议
2. kubernetes 里面的 API 对象是有内部版本和外部版的，如何完成内外部版本之间的转换

k8s 中完成上面操作的抽象就是 codec 和 codec factory

### 1.1 codec 实现
codec 实现了 Serializer 接口(Encoder + Decoder):
1. Encode: 外部版本 -> 内部版本
2. Decode: 内部版本 -> 外部版本

![codec 实现](/images/k8s/k8s_use/codec.png)

codec 定义如下:

```go
// k8s.io/apimachinery/pkg/runtime/serializer/versioning/versioning.go
type codec struct {
  encoder   runtime.Encoder
  decoder   runtime.Decoder
  convertor runtime.ObjectConvertor
  creater   runtime.ObjectCreater
  typer     runtime.ObjectTyper
  defaulter runtime.ObjectDefaulter
  
  encodeVersion runtime.GroupVersioner
  decodeVersion runtime.GroupVersioner
  
  identifier runtime.Identifier
  originalSchemeName string
}
```

在 codec 的结构中:
1. encoder/decoder: 完成正常版本下资源的某种格式序列化和反序列化，比如 json.Serializer
2. ObjectConveror: 完成资源的正常版本和内部版本之间的相互转化。
2. ObjectCreater 和 ObjectDefaulter 完成在 decode 操作中正常版本的创建和赋默认值
3. ObjectTyper: 以用来确定资源的类型，即 GVK
4. encodeVersion/decodeVersion 用于定义资源转化的版本，正常版本或者内部版本

后面我们会看到 ObjectConveror/ObjectCreater/ObjectDefaulter/ObjectTyper 由 Schema 对象实现。

### 1.2 codec factory 实现
codec factory 主要作用是生成 codec 组件用来完成 decode 和 encode 操作。一个 serializer 对应一个 codec，factory 维护了所有 serializer/codec 的集合。从图中可以看到 CodeFactory 实现了 NegotiatedSerializer 和 StorageSerializer 接口

![codec factory 实现](/images/k8s/k8s_use/codec_factory.png)

```go
type CodecFactory struct {
	scheme    *runtime.Scheme
	universal runtime.Decoder
	accepts   []runtime.SerializerInfo

	legacySerializer runtime.Serializer
}

// DecoderToVersion returns a decoder that targets the provided group version.
func (f CodecFactory) DecoderToVersion(decoder runtime.Decoder, gv runtime.GroupVersioner) runtime.Decoder {
	return f.CodecForVersions(nil, decoder, nil, gv)
}

// EncoderForVersion returns an encoder that targets the provided group version.
func (f CodecFactory) EncoderForVersion(encoder runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return f.CodecForVersions(encoder, nil, gv, nil)
}
```

在 codec factory 的实现中:
1. SupportedMediaTypes: 输出可支持的序列化数据格式
2. EncoderForVersion 和 DecoderForVersion 都是调用的 CodecForVersions 方法返回一个 Codec
3. accepts 是 SerializerInfo 的列表，维护了可以支持的序列化协议集合
4. universal 是 recognizer.NewDecoder 对象，其包装了 json.Serializer yaml.Serializer ... 的集合
5. legacySerializer 默认的 Serializer，目的应该是为了向前兼容，json 协议存在时，就是 json.Serializer

#### Serializerinfo
每一个序列化的协议在 Code Factory 中就是一个 Serializerinfo 对象，Serializerinfo 中保存了各种 Serializer，Serializer 是 Codec 的别名。所以一个 Serializerinfo 完整的定义了一个序列化协议支持的输入输出格式、具体实现。

```go
type Serializer interface {
	Encoder
	Decoder
}

// Codec is a Serializer that deals with the details of versioning objects. It offers the same
// interface as Serializer, so this is a marker to consumers that care about the version of the objects
// they receive.
type Codec Serializer

// SerializerInfo contains information about a specific serialization format
type SerializerInfo struct {
	// MediaType is the value that represents this serializer over the wire.
	MediaType string
	// MediaTypeType is the first part of the MediaType ("application" in "application/json").
	MediaTypeType string
	// MediaTypeSubType is the second part of the MediaType ("json" in "application/json").
	MediaTypeSubType string
	// EncodesAsText indicates this serializer can be encoded to UTF-8 safely.
	EncodesAsText bool
	// Serializer is the individual object serializer for this media type.
	Serializer Serializer
	// PrettySerializer, if set, can serialize this object in a form biased towards
	// readability.
	PrettySerializer Serializer
	// StrictSerializer, if set, deserializes this object strictly,
	// erring on unknown fields.
	StrictSerializer Serializer
	// StreamSerializer, if set, describes the streaming serialization format
	// for this media type.
	StreamSerializer *StreamSerializerInfo
}
```

## 2. Code/Code Factory 创建
从 Code/Code Factory 的创建过程，我就可以清楚的理清楚上面这些对象的关系了。

### 2.1 Code Factory 创建

```go
func NewCodecFactory(scheme *runtime.Scheme, mutators ...CodecFactoryOptionsMutator) CodecFactory {
	options := CodecFactoryOptions{Pretty: true}
	for _, fn := range mutators {
		fn(&options)
	}
    // 1. 将 json/yaml等序列化协议的实现实例化为 serializerType 对象
	serializers := newSerializersForScheme(scheme, json.DefaultMetaFactory, options)
	// 2. 创建 CodecFactory
    return newCodecFactory(scheme, serializers)
}
```

#### 将序列化协议实现实例化为 serializerType
newSerializersForScheme 用于创建 []serializerType，serializerType 会用来初始化 Serializerinfo

```go
func newSerializersForScheme(scheme *runtime.Scheme, mf json.MetaFactory, options CodecFactoryOptions) []serializerType {
    // 1. 创建 json.Serializer，从调用入口看，MetaFactory 就是 json.DefaultMetaFactory
	jsonSerializer := json.NewSerializerWithOptions(
		mf, scheme, scheme,
		json.SerializerOptions{Yaml: false, Pretty: false, Strict: options.Strict},
	)
    // 2. 为了创建 Serializerinfo，函数内使用了一个内置对象 serializerType 目的应该是为了扩展性
	jsonSerializerType := serializerType{
		AcceptContentTypes: []string{runtime.ContentTypeJSON},
		ContentType:        runtime.ContentTypeJSON,
		FileExtensions:     []string{"json"},
		EncodesAsText:      true,
		Serializer:         jsonSerializer,

		Framer:           json.Framer,
		StreamSerializer: jsonSerializer,
	}
	if options.Pretty {
		jsonSerializerType.PrettySerializer = json.NewSerializerWithOptions(
			mf, scheme, scheme,
			json.SerializerOptions{Yaml: false, Pretty: true, Strict: options.Strict},
		)
	}

	strictJSONSerializer := json.NewSerializerWithOptions(
		mf, scheme, scheme,
		json.SerializerOptions{Yaml: false, Pretty: false, Strict: true},
	)
	jsonSerializerType.StrictSerializer = strictJSONSerializer

	yamlSerializer := json.NewSerializerWithOptions(
		mf, scheme, scheme,
		json.SerializerOptions{Yaml: true, Pretty: false, Strict: options.Strict},
	)
	strictYAMLSerializer := json.NewSerializerWithOptions(
		mf, scheme, scheme,
		json.SerializerOptions{Yaml: true, Pretty: false, Strict: true},
	)
	protoSerializer := protobuf.NewSerializer(scheme, scheme)
	protoRawSerializer := protobuf.NewRawSerializer(scheme, scheme)

    // 3. 返回 []serializerType 
	serializers := []serializerType{
		jsonSerializerType,
		{
			AcceptContentTypes: []string{runtime.ContentTypeYAML},
			ContentType:        runtime.ContentTypeYAML,
			FileExtensions:     []string{"yaml"},
			EncodesAsText:      true,
			Serializer:         yamlSerializer,
			StrictSerializer:   strictYAMLSerializer,
		},
		{
			AcceptContentTypes: []string{runtime.ContentTypeProtobuf},
			ContentType:        runtime.ContentTypeProtobuf,
			FileExtensions:     []string{"pb"},
			Serializer:         protoSerializer,
			// note, strict decoding is unsupported for protobuf,
			// fall back to regular serializing
			StrictSerializer: protoSerializer,

			Framer:           protobuf.LengthDelimitedFramer,
			StreamSerializer: protoRawSerializer,
		},
	}
    // 4. 从 Scheme 生成 serializerType，这里应该是为了提供扩展性
	for _, fn := range serializerExtensions {
		if serializer, ok := fn(scheme); ok {
			serializers = append(serializers, serializer)
		}
	}
	return serializers
}

var serializerExtensions = []func(*runtime.Scheme) (serializerType, bool){}
```

这里简单对比一下 serializerType/Serializerinfo， 需要 serializerType 主要是为了降低 Serializerinfo 接口面积，而且 serializerType 可以为其他对象提供初始化信息，提高了封装性。

|serializerType|Serializerinfo|
|:---|:---|
|![serializerType](/images/k8s/k8s_use/serializerType.png)|![Serializerinfo](/images/k8s/k8s_use/serializerInfo.png)|

#### 创建 CodecFactory

```go
// newCodecFactory is a helper for testing that allows a different metafactory to be specified.
func newCodecFactory(scheme *runtime.Scheme, serializers []serializerType) CodecFactory {
	decoders := make([]runtime.Decoder, 0, len(serializers))
	var accepts []runtime.SerializerInfo
	alreadyAccepted := make(map[string]struct{})

	var legacySerializer runtime.Serializer
	for _, d := range serializers {
		// 1. d.Serializer 就是 json.Serializer 
		decoders = append(decoders, d.Serializer)
		for _, mediaType := range d.AcceptContentTypes {
			if _, ok := alreadyAccepted[mediaType]; ok {
				continue
			}
			alreadyAccepted[mediaType] = struct{}{}
			// 2. 用 serializerType 示例化 SerializerInfo
			info := runtime.SerializerInfo{
				MediaType:        d.ContentType,
				EncodesAsText:    d.EncodesAsText,
				Serializer:       d.Serializer,
				PrettySerializer: d.PrettySerializer,
				StrictSerializer: d.StrictSerializer,
			}

			mediaType, _, err := mime.ParseMediaType(info.MediaType)
			if err != nil {
				panic(err)
			}
			parts := strings.SplitN(mediaType, "/", 2)
			info.MediaTypeType = parts[0]
			info.MediaTypeSubType = parts[1]

			if d.StreamSerializer != nil {
				info.StreamSerializer = &runtime.StreamSerializerInfo{
					Serializer:    d.StreamSerializer,
					EncodesAsText: d.EncodesAsText,
					Framer:        d.Framer,
				}
			}
			// 收集所有的 SerializerInfo
			accepts = append(accepts, info)
			if mediaType == runtime.ContentTypeJSON {
				legacySerializer = d.Serializer
			}
		}
	}
	if legacySerializer == nil {
		legacySerializer = serializers[0].Serializer
	}

	return CodecFactory{
		scheme:    scheme,
		// recognizer.NewDecoder 包装了 json.Serializer yaml.Serializer ... 的集合
		universal: recognizer.NewDecoder(decoders...),
		// SerializerInfo 的集合
		accepts: accepts,
		// json SerializerInfo
		legacySerializer: legacySerializer,
	}
}
```

#### recognizer.NewDecoder
CodecFactory 的成员 universal 调用了 recognizer.NewDecoder 函数，返回了一个包含了所有序列化协议实现 Serializer 的集合的内置对象 decoder。decoder 实现了 RecognizingDecoder 接口:
1. RecognizesData 方法，尝试用所有输入的 Decoder 解码器，去识别输入数据格式
2. Decode 方法，会尝试用所有的 Decoder 解码数据

```go
// staging/src/k8s.io/apimachinery/pkg/runtime/serializer/recognizer/recognizer.go
type RecognizingDecoder interface {
	runtime.Decoder
	// RecognizesData should return true if the input provided in the provided reader
	// belongs to this decoder, or an error if the data could not be read or is ambiguous.
	// Unknown is true if the data could not be determined to match the decoder type.
	// Decoders should assume that they can read as much of peek as they need (as the caller
	// provides) and may return unknown if the data provided is not sufficient to make a
	// a determination. When peek returns EOF that may mean the end of the input or the
	// end of buffered input - recognizers should return the best guess at that time.
	RecognizesData(peek []byte) (ok, unknown bool, err error)
}

// NewDecoder creates a decoder that will attempt multiple decoders in an order defined
// by:
//
// 1. The decoder implements RecognizingDecoder and identifies the data
// 2. All other decoders, and any decoder that returned true for unknown.
//
// The order passed to the constructor is preserved within those priorities.
func NewDecoder(decoders ...runtime.Decoder) runtime.Decoder {
	return &decoder{
		decoders: decoders,
	}
}

type decoder struct {
	decoders []runtime.Decoder
}

var _ RecognizingDecoder = &decoder{}

func (d *decoder) RecognizesData(data []byte) (bool, bool, error) {
	var (
		lastErr    error
		anyUnknown bool
	)
	for _, r := range d.decoders {
		switch t := r.(type) {
		case RecognizingDecoder:
			ok, unknown, err := t.RecognizesData(data)
			if err != nil {
				lastErr = err
				continue
			}
			anyUnknown = anyUnknown || unknown
			if !ok {
				continue
			}
			return true, false, nil
		}
	}
	return false, anyUnknown, lastErr
}

func (d *decoder) Decode(data []byte, gvk *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	var (
		lastErr error
		skipped []runtime.Decoder
	)

	// try recognizers, record any decoders we need to give a chance later
	for _, r := range d.decoders {
		switch t := r.(type) {
		case RecognizingDecoder:
			ok, unknown, err := t.RecognizesData(data)
			if err != nil {
				lastErr = err
				continue
			}
			if unknown {
				skipped = append(skipped, t)
				continue
			}
			if !ok {
				continue
			}
			return r.Decode(data, gvk, into)
		default:
			skipped = append(skipped, t)
		}
	}

	// try recognizers that returned unknown or didn't recognize their data
	for _, r := range skipped {
		out, actual, err := r.Decode(data, gvk, into)
		if err != nil {
			// if we got an object back from the decoder, and the
			// error was a strict decoding error (e.g. unknown or
			// duplicate fields), we still consider the recognizer
			// to have understood the object
			if out == nil || !runtime.IsStrictDecodingError(err) {
				lastErr = err
				continue
			}
		}
		return out, actual, err
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("no serialization format matched the provided data")
	}
	return nil, nil, lastErr
}
```

### 2.2 Codec 创建
Codec 由 CodeFactory 的 DecoderToVersion() 和 EncoderForVersion() 方法创建，这两个方法最终调用的都是相同的 NewDefaultingCodecForScheme() 方法。

```go
// DecoderToVersion 返回一个与 GVK 对应的解码器
// DecoderToVersion returns a decoder that targets the provided group version.
func (f CodecFactory) DecoderToVersion(decoder runtime.Decoder, gv runtime.GroupVersioner) runtime.Decoder {
	return f.CodecForVersions(nil, decoder, nil, gv)
}

// EncoderForVersion 返回一个与 GVK 对应的编码器
// EncoderForVersion returns an encoder that targets the provided group version.
func (f CodecFactory) EncoderForVersion(encoder runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return f.CodecForVersions(encoder, nil, gv, nil)
}

// CodecForVersions creates a codec with the provided serializer.
// If an object is decoded and its group is not in the list, it will default to runtime.APIVersionInternal. 
// If encode is not specified for an object's group, the object is not converted. 
// If encode or decode are nil, no conversion is performed.
func (f CodecFactory) CodecForVersions(encoder runtime.Encoder, decoder runtime.Decoder, encode runtime.GroupVersioner, decode runtime.GroupVersioner) runtime.Codec {
	// TODO: these are for backcompat, remove them in the future
	if encode == nil {
		encode = runtime.DisabledGroupVersioner
	}
	if decode == nil {
		decode = runtime.InternalGroupVersioner
	}
	return versioning.NewDefaultingCodecForScheme(f.scheme, encoder, decoder, encode, decode)
}
```

CodecForVersions 的定义中需要四个参数
|参数|DecoderToVersion|EncoderForVersion|
|:---|:---|:---|
|encoder runtime.Encoder|nil|encoder|
|decoder runtime.Decoder|decoder|nil|
|encode runtime.GroupVersioner|nil -> DisabledGroupVersioner|gv|
|decode runtime.GroupVersioner|gv|nil -> InternalGroupVersioner|

CodecForVersions 调用 NewDefaultingCodecForScheme 创建 Codec，从调用关系可以看到，schema 提供创建 Codec 所需要的:
1. convertor runtime.ObjectConvertor
2. creater runtime.ObjectCreater
3. typer runtime.ObjectTyper
4. defaulter runtime.ObjectDefaulter

```go
// NewDefaultingCodecForScheme is a convenience method for callers that are using a scheme.
func NewDefaultingCodecForScheme(
	// TODO: I should be a scheme interface?
	scheme *runtime.Scheme,
	encoder runtime.Encoder,
	decoder runtime.Decoder,
	encodeVersion runtime.GroupVersioner,
	decodeVersion runtime.GroupVersioner,
) runtime.Codec {
	return NewCodec(encoder, decoder, runtime.UnsafeObjectConvertor(scheme), scheme, scheme, scheme, encodeVersion, decodeVersion, scheme.Name())
}

// NewCodec takes objects in their internal versions and converts them to external versions before
// serializing them. It assumes the serializer provided to it only deals with external versions.
// This class is also a serializer, but is generally used with a specific version.
func NewCodec(
	encoder runtime.Encoder,
	decoder runtime.Decoder,

	convertor runtime.ObjectConvertor,
	creater runtime.ObjectCreater,
	typer runtime.ObjectTyper,
	defaulter runtime.ObjectDefaulter,
	
	encodeVersion runtime.GroupVersioner,
	decodeVersion runtime.GroupVersioner,
	originalSchemeName string,
) runtime.Codec {
	internal := &codec{
		encoder:   encoder,
		decoder:   decoder,
		convertor: convertor,
		creater:   creater,
		typer:     typer,
		defaulter: defaulter,

		encodeVersion: encodeVersion,
		decodeVersion: decodeVersion,

		identifier: identifier(encodeVersion, encoder),

		originalSchemeName: originalSchemeName,
	}
	return internal
}
```

创建 Codc 需要提前传入 Encoder 和 Decoder，所以 Codec 的创建还缺一个根据序列化协议选择对应的编解码器的过程。这个目前在 CodecFactory 没有找到，另一种方法是使用 CodecFactory 的 universal 实现的通用解码器:

```go
// UniversalDeserializer can convert any stored data recognized by this factory into a Go object that satisfies
// runtime.Object. It does not perform conversion. It does not perform defaulting.
func (f CodecFactory) UniversalDeserializer() runtime.Decoder {
	return f.universal
}

// UniversalDecoder returns a runtime.Decoder capable of decoding all known API objects in all known formats. Used
// by clients that do not need to encode objects but want to deserialize API objects stored on disk. Only decodes
// objects in groups registered with the scheme. The GroupVersions passed may be used to select alternate
// versions of objects to return - by default, runtime.APIVersionInternal is used. If any versions are specified,
// unrecognized groups will be returned in the version they are encoded as (no conversion). This decoder performs
// defaulting.
//
// TODO: the decoder will eventually be removed in favor of dealing with objects in their versioned form
// TODO: only accept a group versioner
func (f CodecFactory) UniversalDecoder(versions ...schema.GroupVersion) runtime.Decoder {
	var versioner runtime.GroupVersioner
	if len(versions) == 0 {
		versioner = runtime.InternalGroupVersioner
	} else {
		versioner = schema.GroupVersions(versions)
	}
	return f.CodecForVersions(nil, f.universal, nil, versioner)
}
```

## 3. Codec 编解码过程
### 3.1 Decode
codec 对象的 Decode() 方法完成 decode 操作，数据解码之后会使用 Schema 实现的 ObjectConvertor 来做 GVK 不同版本之间的转换。

```go
// Decode attempts a decode of the object, then tries to convert it to the internal version. If into is provided and the decoding is
// successful, the returned runtime.Object will be the value passed as into. Note that this may bypass conversion if you pass an
// into that matches the serialized version.
func (c *codec) Decode(data []byte, defaultGVK *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	// If the into object is unstructured and expresses an opinion about its group/version,
	// create a new instance of the type so we always exercise the conversion path (skips short-circuiting on `into == obj`)
	decodeInto := into
	if into != nil {
		if _, ok := into.(runtime.Unstructured); ok && !into.GetObjectKind().GroupVersionKind().GroupVersion().Empty() {
			decodeInto = reflect.New(reflect.TypeOf(into).Elem()).Interface().(runtime.Object)
		}
	}

	var strictDecodingErrs []error
	// 1. obj 是从数据中解码出来的 GVK 对象，into 是我们要转换的目标对象
	obj, gvk, err := c.decoder.Decode(data, defaultGVK, decodeInto)
	if err != nil {
		if strictErr, ok := runtime.AsStrictDecodingError(err); obj != nil && ok {
			// save the strictDecodingError and let the caller decide what to do with it
			strictDecodingErrs = append(strictDecodingErrs, strictErr.Errors()...)
		} else {
			return nil, gvk, err
		}
	}
	// 2. 一个扩展接口，让 obj 解码自己内部的 RawExtensions 对象
	// NestedObjectDecoder是一个可选接口，对象可以实现在序列化期间解码任何嵌套对象 RawExtensions 的机会。
	// DecodeNestedObjects有可能返回一个非nil错误，但在严格的解码错误(例如未知/重复字段)的情况下解码成功。
	// 因此，对于DecodeNestedObjects的调用者来说，检查以确认错误是否是运行时是很重要的
	if d, ok := obj.(runtime.NestedObjectDecoder); ok {
		if err := d.DecodeNestedObjects(runtime.WithoutVersionDecoder{c.decoder}); err != nil {
			if strictErr, ok := runtime.AsStrictDecodingError(err); ok {
				// save the strictDecodingError let and the caller decide what to do with it
				strictDecodingErrs = append(strictDecodingErrs, strictErr.Errors()...)
			} else {
				return nil, gvk, err

			}
		}
	}

	// aggregate the strict decoding errors into one
	var strictDecodingErr error
	if len(strictDecodingErrs) > 0 {
		strictDecodingErr = runtime.NewStrictDecodingError(strictDecodingErrs)
	}
	// 3. 如果目标 GVK 对象不为空，做一个版本转换
	// if we specify a target, use generic conversion.
	if into != nil {
		// perform defaulting if requested
		if c.defaulter != nil {
			c.defaulter.Default(obj)
		}

		// Short-circuit conversion if the into object is same object
		if into == obj {
			return into, gvk, strictDecodingErr
		}
		// decodeVersion 可能的解码集合，到 Schema 再看其实现
		if err := c.convertor.Convert(obj, into, c.decodeVersion); err != nil {
			return nil, gvk, err
		}

		return into, gvk, strictDecodingErr
	}
	// 2. 执行 decodeVersion 默认版本的转换
	// perform defaulting if requested
	if c.defaulter != nil {
		c.defaulter.Default(obj)
	}

	out, err := c.convertor.ConvertToVersion(obj, c.decodeVersion)
	if err != nil {
		return nil, gvk, err
	}
	return out, gvk, strictDecodingErr
}
```

### 3.1 Encode
codec 对象的 Encode() 方法完成 encode 操作。Encode 的逻辑比较简单，长串的逻辑基本都是在为 Unknown、Unstructured、isUnversioned 这些特殊情况做错误检查和默认值设置。

```go
// Encode ensures the provided object is output in the appropriate group and version, invoking
// conversion if necessary. Unversioned objects (according to the ObjectTyper) are output as is.
func (c *codec) Encode(obj runtime.Object, w io.Writer) error {
	return c.encode(obj, w, nil)
}

func (c *codec) encode(obj runtime.Object, w io.Writer, memAlloc runtime.MemoryAllocator) error {
	// 1. 一个扩展接口
	if co, ok := obj.(runtime.CacheableObject); ok {
		return co.CacheEncode(c.Identifier(), func(obj runtime.Object, w io.Writer) error { return c.doEncode(obj, w, memAlloc) }, w)
	}
	return c.doEncode(obj, w, memAlloc)
}

func (c *codec) doEncode(obj runtime.Object, w io.Writer, memAlloc runtime.MemoryAllocator) error {
	encodeFn := c.encoder.Encode
	if memAlloc != nil {
		if encoder, supportsAllocator := c.encoder.(runtime.EncoderWithAllocator); supportsAllocator {
			encodeFn = func(obj runtime.Object, w io.Writer) error {
				return encoder.EncodeWithAllocator(obj, w, memAlloc)
			}
		} else {
			klog.V(6).Infof("a memory allocator was provided but the encoder %s doesn't implement the runtime.EncoderWithAllocator, using regular encoder.Encode method", c.encoder.Identifier())
		}
	}
	switch obj := obj.(type) {
	case *runtime.Unknown:
		return encodeFn(obj, w)
	case runtime.Unstructured:
		// 非结构化列表可以包含多种组版本类型的对象。不要仅仅因为顶级类型与我们期望的目标类型匹配而短路。
		// 实际上，如果需要，将对象发送给转换器，使其有机会转换 List 中的每一项。
		// An unstructured list can contain objects of multiple group version kinds. don't short-circuit just
		// because the top-level type matches our desired destination type. actually send the object to the converter
		// to give it a chance to convert the list items if needed.
		if _, ok := obj.(*unstructured.UnstructuredList); !ok {
			// avoid conversion roundtrip if GVK is the right one already or is empty (yes, this is a hack, but the old behaviour we rely on in kubectl)
			objGVK := obj.GetObjectKind().GroupVersionKind()
			if len(objGVK.Version) == 0 {
				return encodeFn(obj, w)
			}
			targetGVK, ok := c.encodeVersion.KindForGroupVersionKinds([]schema.GroupVersionKind{objGVK})
			if !ok {
				return runtime.NewNotRegisteredGVKErrForTarget(c.originalSchemeName, objGVK, c.encodeVersion)
			}
			if targetGVK == objGVK {
				return encodeFn(obj, w)
			}
		}
	}
	// 2. 获取 obj 的所有可能类型
	gvks, isUnversioned, err := c.typer.ObjectKinds(obj)
	if err != nil {
		return err
	}

	// 3. obj 对象当前的 GVK
	objectKind := obj.GetObjectKind()
	old := objectKind.GroupVersionKind()
	// restore the old GVK after encoding
	defer objectKind.SetGroupVersionKind(old)

	if c.encodeVersion == nil || isUnversioned {
		// 4. 扩展接口，如果 obj 没有 Version，调用 obj 自身实现的序列化方法完成序列化
		if e, ok := obj.(runtime.NestedObjectEncoder); ok {
			if err := e.EncodeNestedObjects(runtime.WithVersionEncoder{Encoder: c.encoder, ObjectTyper: c.typer}); err != nil {
				return err
			}
		}
		// 5. 设置默认的 GVK，避免返回的响应没有 GVK
		objectKind.SetGroupVersionKind(gvks[0])
		return encodeFn(obj, w)
	}
	// 6. 执行转换
	// Perform a conversion if necessary
	out, err := c.convertor.ConvertToVersion(obj, c.encodeVersion)
	if err != nil {
		return err
	}
	// 7. 同步骤 4 
	if e, ok := out.(runtime.NestedObjectEncoder); ok {
		if err := e.EncodeNestedObjects(runtime.WithVersionEncoder{Version: c.encodeVersion, Encoder: c.encoder, ObjectTyper: c.typer}); err != nil {
			return err
		}
	}

	// Conversion is responsible for setting the proper group, version, and kind onto the outgoing object
	return encodeFn(out, w)
}

// Identifier implements runtime.Encoder interface.
func (c *codec) Identifier() runtime.Identifier {
	return c.identifier
}

```