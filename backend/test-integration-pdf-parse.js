/**
 * 真实PDF解析集成测试
 *
 * 这个测试验证实际的pdf-parse库功能
 * 不使用mock，直接调用库解析PDF文件
 */

const path = require('path')
const fs = require('fs')

async function testRealPDFParsing() {
  console.log('=== 真实PDF解析集成测试 ===\n')

  try {
    // 动态导入pdf-parse（避免Jest环境问题）
    const pdfParseModule = require('pdf-parse')
    const { PDFParse, VerbosityLevel } = pdfParseModule

    // 测试1: 解析sample.pdf
    console.log('测试1: 解析sample.pdf')
    const samplePath = path.join(__dirname, 'test-fixtures', 'sample.pdf')
    const sampleBuffer = fs.readFileSync(samplePath)

    const parser1 = new PDFParse({
      data: sampleBuffer,
      verbosity: VerbosityLevel.ERRORS,
    })

    const result1 = await parser1.getText()
    console.log('✅ 成功解析sample.pdf')
    console.log('   - 文本长度:', result1.text.length)
    console.log('   - 总页数:', result1.total)
    console.log('   - 文本预览:', result1.text.substring(0, 100))

    await parser1.destroy()

    // 测试2: 解析multipage.pdf
    console.log('\n测试2: 解析multipage.pdf')
    const multiPath = path.join(__dirname, 'test-fixtures', 'multipage.pdf')
    const multiBuffer = fs.readFileSync(multiPath)

    const parser2 = new PDFParse({
      data: multiBuffer,
      verbosity: VerbosityLevel.ERRORS,
    })

    const result2 = await parser2.getText()
    console.log('✅ 成功解析multipage.pdf')
    console.log('   - 文本长度:', result2.text.length)
    console.log('   - 总页数:', result2.total)
    console.log('   - 文本预览:', result2.text.substring(0, 100))

    await parser2.destroy()

    console.log('\n=== 所有测试通过 ✅ ===')
    return true
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error('Stack:', error.stack)
    return false
  }
}

testRealPDFParsing().then(success => {
  process.exit(success ? 0 : 1)
})
