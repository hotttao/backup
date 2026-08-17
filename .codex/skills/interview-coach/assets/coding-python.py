"""
================================================================================
笔试编程题 - Python
================================================================================
公司: {company}
岗位: {position}
题目: {title}
难度: {difficulty} ⭐
时间: {time_limit} 分钟
================================================================================
"""

# ===== 题目描述 =====
"""
{description}

示例:
    输入: {example_input}
    输出: {example_output}
    解释: {example_explanation}

约束条件:
{constraints}
"""


def solution({params}):
    """
    TODO: 在这里实现你的解答
    
    Args:
        {param_docs}
    
    Returns:
        {return_doc}
    """
    pass


# ===== 测试用例 =====
if __name__ == "__main__":
    test_cases = [
        # (输入, 期望输出, 说明)
        ({test_input_1}, {test_output_1}, "基础用例"),
        ({test_input_2}, {test_output_2}, "边界用例"),
        ({test_input_3}, {test_output_3}, "特殊用例"),
    ]
    
    print("=" * 50)
    print(f"开始测试: {title}")
    print("=" * 50)
    
    passed = 0
    for i, (inp, expected, desc) in enumerate(test_cases, 1):
        try:
            result = solution(inp) if not isinstance(inp, tuple) else solution(*inp)
            if result == expected:
                print(f"✅ 测试 {i}: {desc}")
                passed += 1
            else:
                print(f"❌ 测试 {i}: {desc}")
                print(f"   输入: {inp}")
                print(f"   期望: {expected}")
                print(f"   实际: {result}")
        except Exception as e:
            print(f"💥 测试 {i}: {desc} - 异常: {e}")
    
    print("=" * 50)
    print(f"结果: {passed}/{len(test_cases)} 通过")
    print("=" * 50)


# ===== 参考答案（折叠）=====
"""
【思路提示】
{hint}

【参考解法】
{reference_solution}

【复杂度分析】
- 时间复杂度: {time_complexity}
- 空间复杂度: {space_complexity}
"""