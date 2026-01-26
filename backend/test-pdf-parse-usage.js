/**
 * 测试PDFParse的正确用法
 */

const pdfModule = require('pdf-parse')

async function testPDFParse() {
  const { PDFParse, VerbosityLevel } = pdfModule

  console.log('PDFParse类:', PDFParse)
  console.log('VerbosityLevel:', VerbosityLevel)

  // 读取测试PDF
  const fs = require('fs')
  const path = require('path')
  const testPdfPath = path.join(__dirname, 'test-fixtures', 'sample.pdf')

  const pdfBuffer = fs.readFileSync(testPdfPath)
  console.log('\nPDF buffer大小:', pdfBuffer.length)

  try {
    // 尝试方式1: 创建实例并传入verbosity参数
    console.log('\n方式1: new PDFParse({ verbosity: VerbosityLevel.ERRORS })')
    const parser1 = new PDFParse({ verbosity: VerbosityLevel.ERRORS })
    const result1 = await parser1.parse(pdfBuffer)
    console.log('✅ 成功！文本长度:', result1.text.length)
    console.log('文本预览:', result1.text.substring(0, 100))
  } catch (error) {
    console.error('❌ 失败:', error.message)
  }

  try {
    // 尝试方式2: 不传参数
    console.log('\n方式2: new PDFParse()')
    const parser2 = new PDFParse({})
    const result2 = await parser2.parse(pdfBuffer)
    console.log('✅ 成功！文本长度:', result2.text.length)
  } catch (error) {
    console.error('❌ 失败:', error.message)
  }
}

testPDFParse()
