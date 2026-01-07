/**
 * 创建测试PDF文件的脚本
 *
 * 使用pdf-lib创建一个简单的测试PDF文件
 */

const { PDFDocument, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

async function createTestPDFs() {
  const fixturesDir = path.join(__dirname)

  // 创建一个简单的单页PDF
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([600, 400])
  page.drawText('This is a test PDF file.', {
    x: 50,
    y: 350,
    size: 20,
    color: rgb(0, 0, 0),
  })
  page.drawText('It contains some text content for testing.', {
    x: 50,
    y: 300,
    size: 14,
    color: rgb(0, 0, 0),
  })
  page.drawText('Second paragraph with more text.', {
    x: 50,
    y: 250,
    size: 14,
    color: rgb(0, 0, 0),
  })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(path.join(fixturesDir, 'sample.pdf'), pdfBytes)
  console.log('✅ 创建 sample.pdf')

  // 创建一个多页PDF
  const multiPagePdf = await PDFDocument.create()
  for (let i = 1; i <= 3; i++) {
    const page = multiPagePdf.addPage([600, 400])
    page.drawText(`Page ${i}`, {
      x: 50,
      y: 350,
      size: 20,
      color: rgb(0, 0, 0),
    })
    page.drawText(`Content for page ${i} with some text.`, {
      x: 50,
      y: 300,
      size: 14,
      color: rgb(0, 0, 0),
    })
  }

  const multiPdfBytes = await multiPagePdf.save()
  fs.writeFileSync(path.join(fixturesDir, 'multipage.pdf'), multiPdfBytes)
  console.log('✅ 创建 multipage.pdf')

  // 中文PDF需要特殊字体支持，暂时跳过
  // const chinesePdf = await PDFDocument.create()
  // const chinesePage = chinesePdf.addPage([600, 400])
  // chinesePage.drawText('这是测试文件', {
  //   x: 50,
  //   y: 350,
  //   size: 20,
  //   color: rgb(0, 0, 0),
  // })

  console.log('\n✅ 所有测试PDF文件创建完成！')
}

createTestPDFs().catch(console.error)
