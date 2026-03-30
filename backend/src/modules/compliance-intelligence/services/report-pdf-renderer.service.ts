import { Injectable } from '@nestjs/common'
import { existsSync } from 'fs'
import puppeteer, { Browser } from 'puppeteer'
import { REPORT_PDF_DOWNLOAD_CONTENT_TYPE } from '../constants/report-pdf.constants'
import type { ReportPdfRenderContext } from '../dto/report-pdf.dto'

export interface RenderedReportPdf {
  buffer: Buffer
  contentType: string
  fileName: string
}

@Injectable()
export class ReportPdfRendererService {
  async render(context: ReportPdfRenderContext): Promise<RenderedReportPdf> {
    const browser = await this.launchBrowser()

    try {
      const page = await browser.newPage()
      await page.setContent(this.buildHtml(context), {
        waitUntil: 'load',
      })

      const buffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '18mm',
            right: '14mm',
            bottom: '18mm',
            left: '14mm',
          },
        }),
      )

      return {
        buffer,
        contentType: REPORT_PDF_DOWNLOAD_CONTENT_TYPE,
        fileName: this.buildFileName(context),
      }
    } finally {
      await browser.close()
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
      `无法启动 PDF 渲染浏览器: ${lastError instanceof Error ? lastError.message : '未知错误'}`,
    )
  }

  private buildFileName(context: ReportPdfRenderContext): string {
    const timestamp = context.generatedAt.replace(/[-:TZ.]/g, '').slice(0, 14)
    return `control-report-${context.reportId.slice(0, 8)}-${timestamp}.pdf`
  }

  private buildHtml(context: ReportPdfRenderContext): string {
    const topShortcomings = context.gapSummary.topShortcomings
    const maxGap = Math.max(...topShortcomings.map((item) => item.gap), 1)
    const generatedAt = new Date(context.generatedAt).toLocaleString('zh-CN', {
      hour12: false,
    })

    const summaryTableRows = [
      ['项目名称', context.projectName],
      ['客户名称', context.projectSummary.clientName ?? '未填写'],
      ['适用标准', context.projectSummary.standardName ?? '未填写'],
      ['项目状态', context.projectSummary.projectStatus],
      ['总体成熟度', context.gapSummary.overallMaturity?.toFixed(1) ?? '未生成'],
      ['成熟度等级', context.gapSummary.overallGrade ?? '未生成'],
      ['风险严重度', context.riskSummary.conflictSeverity],
      ['风险冲突数', String(context.riskSummary.conflictCount)],
      ['生成时间', generatedAt],
    ]

    const sectionHtml =
      context.sections.length === 0
        ? '<div class="empty-card">当前报告暂无可导出的控制层级内容。</div>'
        : context.sections
            .map(
              (section) => `
                <section class="report-section">
                  <div class="section-header">
                    <span class="section-code">${this.escapeHtml(section.l1Code)}</span>
                    <h2>${this.escapeHtml(section.l1Name)}</h2>
                  </div>
                  ${section.l2Sections
                    .map(
                      (l2Section) => `
                        <div class="l2-block">
                          <div class="l2-title">
                            <span>${this.escapeHtml(l2Section.l2Code)}</span>
                            <strong>${this.escapeHtml(l2Section.l2Name)}</strong>
                          </div>
                          ${l2Section.controls
                            .map(
                              (control) => `
                                <div class="control-card">
                                  <div class="control-head">
                                    <div>
                                      <div class="control-code">${this.escapeHtml(control.controlCode)}</div>
                                      <h3>${this.escapeHtml(control.controlName)}</h3>
                                    </div>
                                    <div class="status-group">
                                      <span class="pill">${this.escapeHtml(control.currentStatus)}</span>
                                      <span class="pill pill-risk">${this.escapeHtml(control.gapLevel)}</span>
                                    </div>
                                  </div>
                                  <table class="mini-table">
                                    <thead>
                                      <tr>
                                        <th>法规条款</th>
                                        <th>处罚案例</th>
                                        <th>证据类型</th>
                                        <th>整改建议数</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td>${control.clauses.length}</td>
                                        <td>${control.cases.length}</td>
                                        <td>${control.evidences.length}</td>
                                        <td>${control.recommendations.length}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                  <div class="recommendation-list">
                                    ${
                                      control.recommendations.length === 0
                                        ? '<div class="recommendation-empty">暂无整改建议</div>'
                                        : control.recommendations
                                            .map(
                                              (recommendation) => `
                                                <div class="recommendation-card">
                                                  <div class="recommendation-meta">
                                                    <span>${this.escapeHtml(recommendation.actionCode)}</span>
                                                    <span>${this.escapeHtml(recommendation.priority ?? '未标记优先级')}</span>
                                                  </div>
                                                  <div class="recommendation-title">${this.escapeHtml(recommendation.actionTitle)}</div>
                                                  ${
                                                    recommendation.actionDesc
                                                      ? `<p>${this.escapeHtml(recommendation.actionDesc)}</p>`
                                                      : ''
                                                  }
                                                  ${
                                                    recommendation.expectedBenefit
                                                      ? `<p class="benefit">预期收益：${this.escapeHtml(recommendation.expectedBenefit)}</p>`
                                                      : ''
                                                  }
                                                </div>
                                              `,
                                            )
                                            .join('')
                                    }
                                  </div>
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      `,
                    )
                    .join('')}
                </section>
              `,
            )
            .join('')

    return `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4;
              margin: 16mm 14mm 18mm 14mm;
            }

            body {
              margin: 0;
              color: #0f172a;
              font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", Arial, sans-serif;
              background: #f8fafc;
            }

            .page {
              display: flex;
              flex-direction: column;
              gap: 18px;
            }

            .hero {
              padding: 24px 28px;
              border-radius: 24px;
              color: #eff6ff;
              background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%);
            }

            .hero h1 {
              margin: 8px 0 0;
              font-size: 28px;
            }

            .hero p {
              margin: 10px 0 0;
              max-width: 640px;
              line-height: 1.6;
              font-size: 13px;
            }

            .badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.18);
              font-size: 12px;
              letter-spacing: 0.08em;
            }

            .panel {
              padding: 18px 20px;
              border: 1px solid #dbe4f0;
              border-radius: 18px;
              background: #ffffff;
            }

            .panel h2 {
              margin: 0 0 12px;
              font-size: 18px;
            }

            .summary-table,
            .mini-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .summary-table td,
            .mini-table th,
            .mini-table td {
              padding: 10px 12px;
              border: 1px solid #dbe4f0;
              font-size: 12px;
              vertical-align: top;
            }

            .summary-table td:first-child {
              width: 120px;
              background: #eff6ff;
              font-weight: 700;
            }

            .chart-grid {
              display: grid;
              gap: 10px;
            }

            .chart-row {
              display: grid;
              grid-template-columns: 180px 1fr 48px;
              align-items: center;
              gap: 12px;
              font-size: 12px;
            }

            .chart-bar-wrap {
              height: 14px;
              border-radius: 999px;
              background: #e2e8f0;
              overflow: hidden;
            }

            .chart-bar {
              height: 100%;
              background: linear-gradient(90deg, #1d4ed8 0%, #38bdf8 100%);
            }

            .section-header,
            .l2-title,
            .control-head,
            .recommendation-meta {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
            }

            .section-header {
              margin-bottom: 12px;
            }

            .section-code,
            .pill {
              display: inline-flex;
              align-items: center;
              padding: 4px 10px;
              border-radius: 999px;
              background: #dbeafe;
              color: #1d4ed8;
              font-size: 11px;
              font-weight: 700;
            }

            .pill-risk {
              background: #fef3c7;
              color: #b45309;
            }

            .report-section,
            .l2-block,
            .control-card,
            .recommendation-card {
              break-inside: avoid;
            }

            .l2-block {
              margin-bottom: 14px;
              padding: 14px 16px;
              border-radius: 16px;
              background: #f8fafc;
            }

            .control-card {
              margin-top: 12px;
              padding: 14px;
              border: 1px solid #dbe4f0;
              border-radius: 16px;
              background: #ffffff;
            }

            .control-code {
              font-size: 12px;
              font-weight: 700;
              color: #1d4ed8;
            }

            .control-card h3,
            .recommendation-title {
              margin: 6px 0 0;
              font-size: 15px;
            }

            .recommendation-list {
              display: grid;
              gap: 10px;
              margin-top: 12px;
            }

            .recommendation-card {
              padding: 12px;
              border-radius: 14px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
            }

            .recommendation-card p {
              margin: 8px 0 0;
              font-size: 12px;
              line-height: 1.55;
            }

            .benefit {
              color: #047857;
              font-weight: 600;
            }

            .recommendation-empty,
            .empty-card {
              padding: 18px;
              border-radius: 16px;
              background: #f8fafc;
              color: #475569;
              font-size: 13px;
            }

            .risk-list {
              margin: 10px 0 0;
              padding-left: 18px;
              font-size: 12px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="hero">
              <span class="badge">CSAAS CONTROL REPORT PDF</span>
              <h1>${this.escapeHtml(context.projectName)}</h1>
              <p>
                该 PDF 由后端异步生成，用于正式交付管理层或外部场景。内容包含项目摘要、风险摘要、
                图表化差距概览以及按 L1/L2/control/recommendation 组织的报告正文。
              </p>
            </section>

            <section class="panel">
              <h2>报告摘要</h2>
              <table class="summary-table">
                <tbody>
                  ${summaryTableRows
                    .map(
                      ([label, value]) => `
                        <tr>
                          <td>${this.escapeHtml(label)}</td>
                          <td>${this.escapeHtml(value)}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </section>

            <section class="panel">
              <h2>风险与差距图表</h2>
              ${
                topShortcomings.length === 0
                  ? '<div class="empty-card">当前暂无 top shortcomings 数据，无法生成差距图表。</div>'
                  : `
                    <div class="chart-grid">
                      ${topShortcomings
                        .map(
                          (item) => `
                            <div class="chart-row">
                              <span>${this.escapeHtml(item.clusterName)}</span>
                              <div class="chart-bar-wrap">
                                <div class="chart-bar" style="width: ${(item.gap / maxGap) * 100}%"></div>
                              </div>
                              <strong>${item.gap.toFixed(1)}</strong>
                            </div>
                          `,
                        )
                        .join('')}
                    </div>
                  `
              }
              <ul class="risk-list">
                <li>风险严重度：${this.escapeHtml(context.riskSummary.conflictSeverity)}</li>
                <li>风险冲突数：${this.escapeHtml(String(context.riskSummary.conflictCount))}</li>
                <li>
                  风险聚类：
                  ${this.escapeHtml(
                    context.riskSummary.topRiskClusters.length > 0
                      ? context.riskSummary.topRiskClusters.join('、')
                      : '暂无',
                  )}
                </li>
              </ul>
            </section>

            ${sectionHtml}
          </main>
        </body>
      </html>
    `
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }
}
