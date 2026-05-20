import { Injectable } from '@nestjs/common'
import { existsSync } from 'fs'
import puppeteer, { Browser } from 'puppeteer'

const PDF_RENDER_TIMEOUT_MS = 30_000
const PDF_RENDER_CONCURRENCY = 2
const PDF_RENDER_QUEUE_LIMIT = 16
const PDF_HTML_MAX_LENGTH = 500_000

@Injectable()
export class AdvisoryOutputPdfRendererService {
  private activeRenderCount = 0
  private readonly renderQueue: Array<() => void> = []

  async render(html: string): Promise<Buffer> {
    if (html.length > PDF_HTML_MAX_LENGTH) {
      throw new Error('ThinkTank PDF export is too large to render safely.')
    }

    const release = await this.acquireRenderSlot()
    let browser: Browser | null = null

    try {
      browser = await this.withTimeout(this.launchBrowser(), 'PDF browser launch timed out.')
      const page = await this.withTimeout(browser.newPage(), 'PDF page creation timed out.')
      await this.withTimeout(
        page.setContent(html, { waitUntil: 'load' }),
        'PDF HTML load timed out.',
      )

      return Buffer.from(
        await this.withTimeout(
          page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
              top: '18mm',
              right: '14mm',
              bottom: '18mm',
              left: '14mm',
            },
          }),
          'PDF rendering timed out.',
        ),
      )
    } finally {
      release()
      await browser?.close().catch(() => undefined)
    }
  }

  private async acquireRenderSlot(): Promise<() => void> {
    if (this.activeRenderCount < PDF_RENDER_CONCURRENCY) {
      this.activeRenderCount += 1
      return () => this.releaseRenderSlot()
    }

    if (this.renderQueue.length >= PDF_RENDER_QUEUE_LIMIT) {
      throw new Error('ThinkTank PDF export is busy. Please retry shortly.')
    }

    await new Promise<void>((resolve) => this.renderQueue.push(resolve))
    this.activeRenderCount += 1

    return () => this.releaseRenderSlot()
  }

  private releaseRenderSlot(): void {
    this.activeRenderCount = Math.max(0, this.activeRenderCount - 1)
    const next = this.renderQueue.shift()
    next?.()
  }

  private async withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), PDF_RENDER_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private async launchBrowser(): Promise<Browser> {
    const executableCandidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter((candidate): candidate is string => Boolean(candidate))

    const launchAttempts = [
      {},
      ...executableCandidates
        .filter((candidate) => existsSync(candidate))
        .map((candidate) => ({ executablePath: candidate })),
    ]

    let lastError: unknown

    for (const attempt of launchAttempts) {
      try {
        return await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          ...attempt,
        })
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(
      `无法启动 ThinkTank PDF 渲染浏览器: ${
        lastError instanceof Error ? lastError.message : '未知错误'
      }`,
    )
  }
}
