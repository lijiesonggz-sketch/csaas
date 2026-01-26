/**
 * 探索PDFParse类的方法
 */

const pdfModule = require('pdf-parse')
const { PDFParse } = pdfModule

// 创建实例
const parser = new PDFParse({ verbosity: pdfModule.VerbosityLevel.ERRORS })

console.log('PDFParse实例:', parser)
console.log('PDFParse实例的方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)))
console.log('PDFParse实例的属性:', Object.keys(parser))

// 查看类本身
console.log('\nPDFParse类的静态方法:', Object.keys(PDFParse))
console.log('PDFParse原型:', Object.getOwnPropertyNames(PDFParse.prototype))

// 读取PDF
const fs = require('fs')
const path = require('path')
const testPdfPath = path.join(__dirname, 'test-fixtures', 'sample.pdf')
const pdfBuffer = fs.readFileSync(testPdfPath)

// 尝试直接调用PDFParse
async function test() {
  console.log('\n尝试直接调用PDFParse构造函数...')
  try {
    // 有些库的构造函数本身可以被调用
    const result = await PDFParse(pdfBuffer)
    console.log('✅ 直接调用成功:', result)
  } catch (error) {
    console.error('❌ 直接调用失败:', error.message)
  }
}

test()
