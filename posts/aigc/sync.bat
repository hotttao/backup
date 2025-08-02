@echo off
set s="D:\Blog\hugo_blog\content\posts\aigc\langgraph"
set d="D:\Blog\backup\posts\aigc\langgraph"

:: 创建目录
if not exist %s% mkdir %s%

:: 删除文件（保留目录结构）
del /F /Q %s%\* >nul 2>&1
for /d %%i in (%s%\*) do @rmdir /S /Q "%%i" >nul 2>&1

:: 复制文件
robocopy %d% %s% /E /COPYALL /IS /IT >nul
if %errorlevel% leq 1 (
    echo 复制完成！
) else (
    echo 复制过程中出错
)



@echo off
set s="D:\Blog\hugo_blog\assets\images\langgraph"
set d="D:\Blog\backup\images\langgraph"

:: 创建目录
if not exist %s% mkdir %s%

:: 删除文件（保留目录结构）
del /F /Q %s%\* >nul 2>&1
for /d %%i in (%s%\*) do @rmdir /S /Q "%%i" >nul 2>&1

:: 复制文件
robocopy %d% %s% /E /COPYALL /IS /IT >nul
if %errorlevel% leq 1 (
    echo 复制完成！
) else (
    echo 复制过程中出错
)