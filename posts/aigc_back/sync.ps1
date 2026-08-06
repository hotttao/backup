# 定义目录路径
$s = "D:\Blog\hugo_blog\content\posts\aigc\langgraph"
$d = "D:\Blog\backup\posts\aigc\langgraph"

# 1. 检查并创建 s 目录（如果不存在）
if (-not (Test-Path -Path $s)) {
    New-Item -ItemType Directory -Path $s | Out-Null
    Write-Host "已创建目录: $s"
}

# 2. 删除 s 目录下的所有文件（保留目录结构）
if (Test-Path -Path $s) {
    Remove-Item -Path "$s\*" -Recurse -Force
    Write-Host "已删除 $s 下的所有文件"
} else {
    Write-Host "$s 目录不存在，跳过删除操作"
}

# 3. 将 d 目录下的所有文件复制到 s
if (Test-Path -Path $d) {
    Copy-Item -Path "$d\*" -Destination $s -Recurse -Force
    Write-Host "已将 $d 下的文件复制到 $s"
} else {
    Write-Host "错误：源目录 $d 不存在"
}