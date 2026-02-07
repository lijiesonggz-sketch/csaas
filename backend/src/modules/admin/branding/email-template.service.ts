import { Injectable } from '@nestjs/common'
import * as he from 'he'

/**
 * Email Template Service
 *
 * Handles email template rendering with brand configuration.
 *
 * @story 6-3
 */
@Injectable()
export class EmailTemplateService {
  /**
   * Sanitize color value
   *
   * @param color - Color string
   * @returns Sanitized color or default
   */
  private sanitizeColor(color: string): string {
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return '#1890ff'
    }
    return color
  }

  /**
   * Sanitize URL
   *
   * @param url - URL string
   * @returns Sanitized URL or empty string
   */
  private sanitizeUrl(url: string): string {
    if (!url || !/^https?:\/\//i.test(url)) {
      return ''
    }
    return he.encode(url)
  }
  /**
   * Render template with variables
   *
   * @param template - Template string with {{variable}} placeholders
   * @param variables - Object with variable values
   * @returns Rendered template
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      result = result.replace(regex, value || '')
    }

    return result
  }

  /**
   * Render branded email with HTML template
   *
   * @param content - Email content
   * @param brandConfig - Brand configuration
   * @returns HTML email
   */
  renderBrandedEmail(
    content: string,
    brandConfig: {
      companyName?: string
      logoUrl?: string
      primaryColor?: string
      contactEmail?: string
      contactPhone?: string
      emailSignature?: string
    },
  ): string {
    // Sanitize all user inputs
    const companyName = he.encode(brandConfig.companyName || 'Csaas')
    const logoUrl = this.sanitizeUrl(brandConfig.logoUrl || '')
    const primaryColor = this.sanitizeColor(brandConfig.primaryColor || '#1890ff')
    const contactEmail = he.encode(brandConfig.contactEmail || '')
    const contactPhone = he.encode(brandConfig.contactPhone || '')
    const emailSignature = he.encode(brandConfig.emailSignature || '')

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid ${primaryColor};
    }
    .logo {
      max-width: 200px;
      height: auto;
    }
    .content {
      padding: 30px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #666;
    }
    .signature {
      white-space: pre-line;
      margin: 20px 0;
    }
    .contact-info {
      margin-top: 10px;
    }
    a {
      color: ${primaryColor};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo">` : `<h1 style="color: ${primaryColor};">${companyName}</h1>`}
  </div>

  <div class="content">
    ${content}
  </div>

  <div class="footer">
    ${emailSignature ? `<div class="signature">${emailSignature}</div>` : ''}

    <div class="contact-info">
      ${contactEmail ? `<div>邮箱: <a href="mailto:${contactEmail}">${contactEmail}</a></div>` : ''}
      ${contactPhone ? `<div>电话: ${contactPhone}</div>` : ''}
    </div>

    <div style="margin-top: 20px; font-size: 12px; color: #999;">
      此邮件由 ${companyName} 自动发送，请勿直接回复。
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Get welcome email template
   *
   * @returns Welcome email template
   */
  getWelcomeEmailTemplate(): string {
    return `
<h2>欢迎使用雷达服务！</h2>

<p>尊敬的 {{clientName}}，</p>

<p>感谢您选择 {{companyName}} 的技术雷达服务。我们很高兴为您提供专业的技术洞察和行业分析。</p>

<h3>服务内容</h3>
<ul>
  <li><strong>技术雷达：</strong>实时追踪最新技术趋势和最佳实践</li>
  <li><strong>行业雷达：</strong>了解同业机构的创新案例和经验</li>
  <li><strong>合规雷达：</strong>及时获取监管政策变化和应对建议</li>
</ul>

<h3>开始使用</h3>
<p>您可以登录系统配置关注的技术领域和同业机构，我们将为您推送相关内容。</p>

<p>如有任何问题，欢迎随时联系我们。</p>
    `.trim()
  }

  /**
   * Get push notification email template
   *
   * @returns Push notification template
   */
  getPushNotificationTemplate(): string {
    return `
<h2>您有新的推送内容</h2>

<p>尊敬的 {{clientName}}，</p>

<p>{{companyName}} 为您推送了 {{pushCount}} 条新内容：</p>

<div style="margin: 20px 0;">
  {{pushList}}
</div>

<p>
  <a href="{{loginUrl}}" style="display: inline-block; padding: 10px 20px; background-color: {{primaryColor}}; color: white; border-radius: 4px; text-decoration: none;">
    查看详情
  </a>
</p>
    `.trim()
  }
}
