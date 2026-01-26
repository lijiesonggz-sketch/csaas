/**
 * 测试PDFParse的正确用法
 */

const pdfModule = require('pdf-parse')
const { PDFParse, VerbosityLevel } = pdfModule
const fs = require('fs')
const path = require('path')

async function test() {
  const testPdfPath = path.join(__dirname, 'test-fixtures', 'sample.pdf')
  const pdfBuffer = fs.readFileSync(testPdfPath)

  console.log('PDF buffer大小:', pdfBuffer.length)

  try {
    // 正确的用法
    console.log('\n✅ 正确的用法：load + getText')
    const parser = new PDFParse({ verbosity: VerbosityLevel.ERRORS })
    await parser.load(pdfBuffer)
    const text = await parser.getText()

    console.log('成功提取文本！')
    console.log('文本长度:', text.length)
    console.log('文本预览:', text.substring(0, 200))
  } catch (error) {
    console.error('失败:', error.message)
    console.error('Stack:', error.stack)
  }
}

test()
