/**
 * 检查pdf-parse的导出结构
 */

const pdfModule = require('pdf-parse')

console.log('pdf-parse完整导出类型:', typeof pdfModule)
console.log('pdf-parse完整导出:', Object.keys(pdfModule))
console.log('pdf-parse.default:', typeof pdfModule.default)
console.log('pdf-parse是否为函数:', typeof pdfModule === 'function')

// 尝试不同的调用方式
const testPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n198\n%%EOF')

async function testParse() {
  try {
    if (typeof pdfModule === 'function') {
      console.log('\n✅ 方式1: 直接调用pdfModule')
      const result1 = await pdfModule(testPdf)
      console.log('结果1:', result1.text?.substring(0, 50))
    } else if (typeof pdfModule.default === 'function') {
      console.log('\n✅ 方式2: 调用pdfModule.default')
      const result2 = await pdfModule.default(testPdf)
      console.log('结果2:', result2.text?.substring(0, 50))
    } else {
      console.log('\n❌ 都不是函数')
      console.log('完整导出:', pdfModule)
    }
  } catch (error) {
    console.error('解析错误:', error.message)
  }
}

testParse()
