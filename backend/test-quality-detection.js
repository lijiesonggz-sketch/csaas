/**
 * 测试PDF内容质量检测
 */
const { detectTextQuality } = require('../frontend/lib/utils/fileParser')

console.log('=== 测试PDF内容质量检测 ===\n')

// 测试1: 正常文本
const goodText = '这是一个测试文档。This is a test document with valid content.'
console.log('测试1: 正常文本')
console.log(detectTextQuality(goodText))
console.log('✅ 应该返回 isValid: true\n')

// 测试2: GBT+43208.1-2023的乱码内容
const badText = '!"#!"!	#$#""# $ %%! " # $ % & \' \' ( ) *%&!\' &!\'#!"'
console.log('测试2: GBT+43208.1-2023乱码')
console.log(detectTextQuality(badText))
console.log('❌ 应该返回 isValid: false，issue: 文档内容无法识别\n')

// 测试3: 空内容
const emptyText = ''
console.log('测试3: 空内容')
console.log(detectTextQuality(emptyText))
console.log('❌ 应该返回 isValid: false，quality: empty\n')

// 测试4: 控制字符过多（30%+）
const highControlChars = '!@#$%^&*()'.repeat(100) + 'abc'
console.log('测试4: 控制字符过多')
console.log(detectTextQuality(highControlChars))
console.log('❌ 应该返回 isValid: false，issue: 文档内容包含大量乱码\n')

console.log('✅ 所有测试完成！')
