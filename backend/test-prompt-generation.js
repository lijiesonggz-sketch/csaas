// Test script to debug the prompt generation
const fs = require('fs');
const path = require('path');

// Read the prompts file and extract the function
const promptsFile = fs.readFileSync(
  path.join(__dirname, 'src/modules/ai-generation/prompts/standard-interpretation.prompts.ts'),
  'utf8'
);

// Simple test - let's manually check what gets generated
console.log('=== Testing Enterprise Mode Prompt Structure ===\n');

const standardDocument = {
  id: 'test-doc',
  name: 'GBT 43208.1-2023',
  content: 'A'.repeat(1000) // Short content for testing
};

// Simulate what the prompt generator would do
let prompt = '你是一名资深IT标准咨询专家，拥有20年企业合规咨询经验。请为以下标准提供全面、深入、可操作的解读，目标用户是企业合规负责人和咨询师。\n\n';

prompt += '**标准文档**：\n';
prompt += `**标准名称**：${standardDocument.name}\n\n`;
prompt += `**标准内容**（完整文档，共${standardDocument.content.length}字符）：\n${standardDocument.content}\n\n`;

// Mode config for enterprise
const interpretationMode = 'enterprise';

prompt += '**解读模式**：企业级深度模式\n';
prompt += '**关注范围**：所有条款（30-60个所有条款，不得遗漏）\n\n';

prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n';
prompt += '```json\n';
prompt += '{\n';
prompt += '  "overview": {\n';
prompt += '    "background": "标准制定背景和修订历史",\n';
prompt += '    "scope": "适用范围和对象",\n';
prompt += '    "core_objectives": ["核心目标1", "核心目标2"],\n';
prompt += '    "target_audience": ["目标受众1", "目标受众2"],\n';
prompt += '    "key_changes": "与前一版本的主要变化（如有）"\n';
prompt += '  },\n';
prompt += '  "key_requirements": [\n';
prompt += '    {\n';
prompt += '      "clause_id": "条款编号",\n';
prompt += '      "chapter": "所属章节",\n';
prompt += '      "clause_full_text": "【重要】条款的完整原文",\n';
prompt += '      "clause_summary": "条款内容的一句话总结",\n';
prompt += '      "interpretation": {\n';
prompt += '        "what": "条款要求的具体内容",\n';
prompt += '        "why": "为什么需要这个条款",\n';
prompt += '        "how": "如何满足条款要求"\n';
prompt += '      },\n';
prompt += '      "compliance_criteria": {\n';
prompt += '        "must_have": ["必须有的文档/系统/流程"],\n';
prompt += '        "should_have": ["建议有的内容"],\n';
prompt += '        "evidence_required": ["需要的证据清单"],\n';
prompt += '        "assessment_method": "如何评估符合性"\n';
prompt += '      },\n';
prompt += '      "risk_assessment": {\n';
prompt += '        "non_compliance_risks": [{\n';
prompt += '          "risk": "风险描述",\n';
prompt += '          "consequence": "不合规的后果",\n';
prompt += '          "probability": "高/中/低",\n';
prompt += '          "mitigation": "缓解措施"\n';
prompt += '        }],\n';
prompt += '        "implementation_risks": [{\n';
prompt += '          "risk": "实施风险",\n';
prompt += '          "consequence": "可能的问题",\n';
prompt += '          "prevention": "预防措施"\n';
prompt += '        }]\n';
prompt += '      },\n';
prompt += '      "priority": "HIGH",\n';
prompt += '      "estimated_effort": "预估工期",\n';
prompt += '      "implementation_order": 1,\n';
prompt += '      "dependencies": ["依赖的其他条款编号"],\n';
prompt += '      "best_practices": ["最佳实践1", "最佳实践2"],\n';
prompt += '      "common_mistakes": ["常见错误1", "常见错误2"]\n';
prompt += '    }\n';
prompt += '  ]\n';
prompt += '}\n';
prompt += '```\n\n';

// Write to file for inspection
const outputFile = path.join(__dirname, 'generated-prompt-example.txt');
fs.writeFileSync(outputFile, prompt);

console.log('Generated example prompt structure saved to:', outputFile);
console.log('\nFirst 2000 characters of the prompt:');
console.log(prompt.substring(0, 2000));
console.log('\n\nLast 1000 characters of the prompt:');
console.log(prompt.substring(prompt.length - 1000));

// Now let's check if the actual TypeScript code has any obvious issues
console.log('\n\n=== Checking for potential issues in prompt generation ===');

// Look for the problematic sections
const lines = promptsFile.split('\n');
console.log(`\nTotal lines in file: ${lines.length}`);

// Check lines around 169-178 where risk_assessment is built
console.log('\n=== Lines 169-178 (risk_assessment section) ===');
for (let i = 168; i <= 178 && i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

// Check lines around 180-184 where objFields are added
console.log('\n=== Lines 180-200 (after objFields) ===');
for (let i = 180; i <= 200 && i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
