#!/usr/bin/env python3
"""
笔试题生成器
从模板生成可执行的编程练习文件

用法:
    python generate_problem.py --lang python --output /path/to/output.py --config problem.json
    
    或通过参数直接指定:
    python generate_problem.py --lang python \
        --company "字节跳动" \
        --position "后端工程师" \
        --title "两数之和" \
        --difficulty 2 \
        --time-limit 30 \
        --description "给定一个整数数组和目标值，找出和为目标值的两个数的索引" \
        --output /mnt/user-data/outputs/bytedance_twosum.py
"""

import argparse
import json
import os
import sys
from pathlib import Path


# 模板目录（相对于脚本位置）
SCRIPT_DIR = Path(__file__).parent.parent
ASSETS_DIR = SCRIPT_DIR / "assets"

TEMPLATE_MAP = {
    "python": "coding-python.py",
    "javascript": "coding-javascript.js",
    "js": "coding-javascript.js",
    "sql": "coding-sql.sql",
    "exam": "exam-paper.md",
}


def load_template(lang: str) -> str:
    """加载对应语言的模板"""
    template_file = TEMPLATE_MAP.get(lang.lower())
    if not template_file:
        raise ValueError(f"不支持的语言: {lang}，可选: {list(TEMPLATE_MAP.keys())}")
    
    template_path = ASSETS_DIR / template_file
    if not template_path.exists():
        raise FileNotFoundError(f"模板文件不存在: {template_path}")
    
    return template_path.read_text(encoding="utf-8")


def fill_template(template: str, config: dict) -> str:
    """填充模板占位符"""
    result = template
    
    # 基础字段
    basic_fields = {
        "company": config.get("company", "未指定公司"),
        "position": config.get("position", "未指定岗位"),
        "title": config.get("title", "未命名题目"),
        "difficulty": "⭐" * config.get("difficulty", 1),
        "time_limit": str(config.get("time_limit", 30)),
        "description": config.get("description", "题目描述待填写"),
    }
    
    for key, value in basic_fields.items():
        result = result.replace(f"{{{key}}}", str(value))
    
    # 示例
    example = config.get("example", {})
    result = result.replace("{example_input}", str(example.get("input", "[]")))
    result = result.replace("{example_output}", str(example.get("output", "[]")))
    result = result.replace("{example_explanation}", example.get("explanation", ""))
    
    # 约束条件
    constraints = config.get("constraints", [])
    if isinstance(constraints, list):
        constraints = "\n".join(f"- {c}" for c in constraints)
    result = result.replace("{constraints}", constraints)
    
    # 函数签名
    params = config.get("params", "nums, target")
    result = result.replace("{params}", params)
    result = result.replace("{param_docs}", config.get("param_docs", "参数说明"))
    result = result.replace("{return_doc}", config.get("return_doc", "返回值说明"))
    result = result.replace("{param_types}", config.get("param_types", "any"))
    result = result.replace("{return_type}", config.get("return_type", "any"))
    
    # 测试用例
    test_cases = config.get("test_cases", [])
    for i, tc in enumerate(test_cases[:3], 1):
        result = result.replace(f"{{test_input_{i}}}", str(tc.get("input", "None")))
        result = result.replace(f"{{test_output_{i}}}", str(tc.get("output", "None")))
    
    # 参考答案
    result = result.replace("{hint}", config.get("hint", "思路提示待填写"))
    result = result.replace("{reference_solution}", config.get("solution", "# 参考解法待填写"))
    result = result.replace("{time_complexity}", config.get("time_complexity", "O(?)"))
    result = result.replace("{space_complexity}", config.get("space_complexity", "O(?)"))
    
    return result


def generate_problem(lang: str, config: dict, output_path: str) -> str:
    """生成题目文件"""
    template = load_template(lang)
    content = fill_template(template, config)
    
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    
    return str(output.absolute())


def main():
    parser = argparse.ArgumentParser(description="笔试题生成器")
    parser.add_argument("--lang", "-l", required=True, help="语言: python/javascript/sql/exam")
    parser.add_argument("--output", "-o", required=True, help="输出文件路径")
    parser.add_argument("--config", "-c", help="配置文件路径 (JSON)")
    
    # 直接参数（优先级低于配置文件）
    parser.add_argument("--company", help="公司名称")
    parser.add_argument("--position", help="岗位名称")
    parser.add_argument("--title", help="题目标题")
    parser.add_argument("--difficulty", type=int, default=2, help="难度 1-5")
    parser.add_argument("--time-limit", type=int, default=30, help="时间限制（分钟）")
    parser.add_argument("--description", help="题目描述")
    
    args = parser.parse_args()
    
    # 构建配置
    if args.config:
        with open(args.config, "r", encoding="utf-8") as f:
            config = json.load(f)
    else:
        config = {}
    
    # 命令行参数覆盖配置文件
    if args.company:
        config["company"] = args.company
    if args.position:
        config["position"] = args.position
    if args.title:
        config["title"] = args.title
    if args.difficulty:
        config["difficulty"] = args.difficulty
    if args.time_limit:
        config["time_limit"] = args.time_limit
    if args.description:
        config["description"] = args.description
    
    try:
        output_file = generate_problem(args.lang, config, args.output)
        print(f"✅ 题目已生成: {output_file}")
    except Exception as e:
        print(f"❌ 生成失败: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()