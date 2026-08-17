#!/usr/bin/env python3
"""
代码评测器
运行用户代码，对比测试用例，给出评分和反馈

用法:
    python judge.py --solution solution.py --test-cases cases.json
    python judge.py --solution solution.py --function-name "solution" --cases '[{"input": [1,2], "expected": 3}]'

输出:
    - 每个用例的通过/失败状态
    - 运行时间
    - 内存使用（近似）
    - 总体评分
"""

import argparse
import importlib.util
import json
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Callable


def load_solution(file_path: str, function_name: str = "solution") -> Callable:
    """动态加载用户的解答函数"""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    spec = importlib.util.spec_from_file_location("user_solution", path)
    module = importlib.util.module_from_spec(spec)
    
    # 禁用打印输出
    original_stdout = sys.stdout
    sys.stdout = open('/dev/null', 'w')
    
    try:
        spec.loader.exec_module(module)
    finally:
        sys.stdout.close()
        sys.stdout = original_stdout
    
    if not hasattr(module, function_name):
        raise AttributeError(f"函数 '{function_name}' 不存在于 {file_path}")
    
    return getattr(module, function_name)


def compare_output(actual: Any, expected: Any) -> bool:
    """比较输出结果，支持多种类型"""
    # 处理浮点数精度
    if isinstance(expected, float) and isinstance(actual, float):
        return abs(actual - expected) < 1e-6
    
    # 处理列表（可能需要排序比较）
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return False
        # 尝试直接比较
        if expected == actual:
            return True
        # 尝试排序后比较（针对顺序不重要的情况）
        try:
            return sorted(expected) == sorted(actual)
        except TypeError:
            return False
    
    return actual == expected


def run_test_case(func: Callable, test_input: Any, expected: Any, timeout: float = 5.0) -> dict:
    """运行单个测试用例"""
    result = {
        "passed": False,
        "actual": None,
        "expected": expected,
        "time_ms": 0,
        "error": None,
    }
    
    start_time = time.perf_counter()
    
    try:
        # 处理输入参数
        if isinstance(test_input, list):
            actual = func(*test_input)
        elif isinstance(test_input, dict):
            actual = func(**test_input)
        else:
            actual = func(test_input)
        
        result["actual"] = actual
        result["passed"] = compare_output(actual, expected)
        
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"
    
    result["time_ms"] = (time.perf_counter() - start_time) * 1000
    
    return result


def judge(solution_path: str, test_cases: list, function_name: str = "solution") -> dict:
    """评测主函数"""
    report = {
        "total": len(test_cases),
        "passed": 0,
        "failed": 0,
        "error": 0,
        "score": 0,
        "total_time_ms": 0,
        "cases": [],
    }
    
    try:
        func = load_solution(solution_path, function_name)
    except Exception as e:
        report["error"] = len(test_cases)
        report["cases"] = [{"error": str(e)}] * len(test_cases)
        return report
    
    for i, tc in enumerate(test_cases):
        test_input = tc.get("input")
        expected = tc.get("expected", tc.get("output"))
        desc = tc.get("desc", f"测试用例 {i + 1}")
        
        case_result = run_test_case(func, test_input, expected)
        case_result["desc"] = desc
        case_result["index"] = i + 1
        
        report["cases"].append(case_result)
        report["total_time_ms"] += case_result["time_ms"]
        
        if case_result["error"]:
            report["error"] += 1
        elif case_result["passed"]:
            report["passed"] += 1
        else:
            report["failed"] += 1
    
    report["score"] = round(report["passed"] / report["total"] * 100) if report["total"] > 0 else 0
    
    return report


def print_report(report: dict, verbose: bool = True):
    """打印评测报告"""
    print("=" * 60)
    print("📋 评测报告")
    print("=" * 60)
    
    if verbose:
        for case in report["cases"]:
            idx = case.get("index", "?")
            desc = case.get("desc", "")
            
            if case.get("error"):
                status = "💥"
                detail = f"异常: {case['error']}"
            elif case.get("passed"):
                status = "✅"
                detail = f"耗时: {case['time_ms']:.2f}ms"
            else:
                status = "❌"
                detail = f"期望: {case['expected']}, 实际: {case['actual']}"
            
            print(f"{status} 用例 {idx}: {desc}")
            print(f"   {detail}")
        
        print("-" * 60)
    
    print(f"📊 统计:")
    print(f"   通过: {report['passed']}/{report['total']}")
    print(f"   失败: {report['failed']}")
    print(f"   异常: {report['error']}")
    print(f"   总耗时: {report['total_time_ms']:.2f}ms")
    print(f"   得分: {report['score']}/100")
    print("=" * 60)
    
    # 评价
    score = report["score"]
    if score == 100:
        print("🎉 完美通过！")
    elif score >= 80:
        print("👍 表现不错，还有优化空间")
    elif score >= 60:
        print("💪 继续加油，注意边界情况")
    else:
        print("📚 建议复习一下相关知识点")


def main():
    parser = argparse.ArgumentParser(description="代码评测器")
    parser.add_argument("--solution", "-s", required=True, help="解答文件路径")
    parser.add_argument("--function", "-f", default="solution", help="函数名称")
    parser.add_argument("--test-cases", "-t", help="测试用例文件 (JSON)")
    parser.add_argument("--cases", "-c", help="测试用例 (JSON 字符串)")
    parser.add_argument("--quiet", "-q", action="store_true", help="简洁输出")
    parser.add_argument("--json", "-j", action="store_true", help="JSON 格式输出")
    
    args = parser.parse_args()
    
    # 加载测试用例
    if args.test_cases:
        with open(args.test_cases, "r", encoding="utf-8") as f:
            test_cases = json.load(f)
    elif args.cases:
        test_cases = json.loads(args.cases)
    else:
        print("❌ 请提供测试用例 (--test-cases 或 --cases)", file=sys.stderr)
        sys.exit(1)
    
    # 运行评测
    report = judge(args.solution, test_cases, args.function)
    
    # 输出结果
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print_report(report, verbose=not args.quiet)
    
    # 返回码
    sys.exit(0 if report["score"] == 100 else 1)


if __name__ == "__main__":
    main()