---
title: flask JWT
date: 2017-09-23
categories:
    - Python
tags:
    - python
---

flask JWT 认证

<!-- more -->

## 1. Flask-JWT 配置参数

|参数|作用|
|:---|:---|
|JWT_DEFAULT_REALM|JWT认证获取 token 错误时，会显示在错误的提示信息中，默认为 Login Required|
|JWT_AUTH_URL_RULE|认证所在的 URL. Defaults to /auth.|
|JWT_AUTH_ENDPOINT|The authentication endpoint name. Defaults to jwt.|
|JWT_AUTH_USERNAME_KEY|The username key in the authentication request payload. Defaults to username.|
|JWT_AUTH_PASSWORD_KEY|The password key in the authentication request payload. Defaults to password.|
|JWT_ALGORITHM|The token algorithm. Defaults to HS256|
|JWT_LEEWAY|Defaults to timedelta(seconds=10).|
|JWT_VERIFY|Flag indicating if all tokens should be verified. Defaults to True. It is not recommended to change this value.|
|JWT_AUTH_HEADER_PREFIX|The Authorization header value prefix. Defaults to JWT as to not conflict with OAuth2 Bearer tokens. This is not a case sensitive value.|
|JWT_VERIFY_EXPIRATION|Flag indicating if all tokens should verify their expiration time. Defaults to True. It is not recommended to change this value.|
|JWT_LEEWAY|A token expiration leeway value. Defaults to 0.|
|JWT_EXPIRATION_DELTA|A datetime.timedelta value indicating how long tokens are valid for. This value is added to the iat (issued at) claim. Defaults to timedelta(seconds=300)|
|JWT_NOT_BEFORE_DELTA|A datetime.timedelta value indicating a relative time from the iat (issued at) claim that the token can begin to be used. This value is added to the iat (issued at) claim. Defaults to timedelta(seconds=0)|
|JWT_VERIFY_CLAIMS|A list of claims to verify when decoding tokens. Defaults to ['signature', 'exp', 'nbf', 'iat'].|
|JWT_REQUIRED_CLAIMS|A list of claims that are required in a token to be considered valid. Defaults to ['exp', 'iat', 'nbf']|