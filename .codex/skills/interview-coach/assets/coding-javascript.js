/**
 * ================================================================================
 * 笔试编程题 - JavaScript
 * ================================================================================
 * 公司: {company}
 * 岗位: {position}
 * 题目: {title}
 * 难度: {difficulty} ⭐
 * 时间: {time_limit} 分钟
 * ================================================================================
 */

/**
 * 题目描述:
 * {description}
 *
 * 示例:
 *   输入: {example_input}
 *   输出: {example_output}
 *   解释: {example_explanation}
 *
 * 约束条件:
 * {constraints}
 */

/**
 * @param {param_types}
 * @return {return_type}
 */
function solution({ params }) {
  // TODO: 在这里实现你的解答

}

// ===== 测试用例 =====
const testCases = [
  { input: [{ test_input_1 }], expected: { test_output_1 }, desc: "基础用例" },
  { input: [{ test_input_2 }], expected: { test_output_2 }, desc: "边界用例" },
  { input: [{ test_input_3 }], expected: { test_output_3 }, desc: "特殊用例" },
];

console.log("=".repeat(50));
console.log(`开始测试: {title}`);
console.log("=".repeat(50));

let passed = 0;
testCases.forEach((tc, i) => {
  try {
    const result = solution(...tc.input);
    const isEqual = JSON.stringify(result) === JSON.stringify(tc.expected);
    if (isEqual) {
      console.log(`✅ 测试 ${i + 1}: ${tc.desc}`);
      passed++;
    } else {
      console.log(`❌ 测试 ${i + 1}: ${tc.desc}`);
      console.log(`   输入: ${JSON.stringify(tc.input)}`);
      console.log(`   期望: ${JSON.stringify(tc.expected)}`);
      console.log(`   实际: ${JSON.stringify(result)}`);
    }
  } catch (e) {
    console.log(`💥 测试 ${i + 1}: ${tc.desc} - 异常: ${e.message}`);
  }
});

console.log("=".repeat(50));
console.log(`结果: ${passed}/${testCases.length} 通过`);
console.log("=".repeat(50));

/**
 * ===== 参考答案（折叠）=====
 *
 * 【思路提示】
 * {hint}
 *
 * 【参考解法】
 * {reference_solution}
 *
 * 【复杂度分析】
 * - 时间复杂度: {time_complexity}
 * - 空间复杂度: {space_complexity}
 */