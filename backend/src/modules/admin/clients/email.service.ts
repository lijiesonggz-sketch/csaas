import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'
import { EmailTemplateService } from '../branding/email-template.service'
import { AdminBrandingService } from '../branding/admin-branding.service'

/**
 * Email Service
 *
 * Service for sending emails to clients with brand configuration.
 *
 * @story 6-2, 6-3
 * @module backend/src/modules/admin/clients/email.service
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly brandingService: AdminBrandingService,
  ) {
    this.initializeTransporter()
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter() {
    const emailEnabled = this.configService.get<string>('EMAIL_ENABLED', 'false') === 'true'

    if (!emailEnabled) {
      this.logger.warn('Email service is disabled. Set EMAIL_ENABLED=true to enable.')
      return
    }

    const host = this.configService.get<string>('EMAIL_HOST')
    const port = this.configService.get<number>('EMAIL_PORT', 587)
    const user = this.configService.get<string>('EMAIL_USER')
    const pass = this.configService.get<string>('EMAIL_PASS')
    const from = this.configService.get<string>('EMAIL_FROM', 'noreply@csaas.com')

    if (!host || !user || !pass) {
      this.logger.warn(
        'Email configuration incomplete. Required: EMAIL_HOST, EMAIL_USER, EMAIL_PASS',
      )
      return
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    })

    this.logger.log(`Email service initialized with host: ${host}`)
  }

  /**
   * Send welcome email to new client with brand configuration
   *
   * @param to - Recipient email address
   * @param clientName - Client organization name
   * @param tenantId - Tenant ID for brand configuration
   */
  async sendWelcomeEmail(to: string, clientName: string, tenantId?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[Email Disabled] Welcome email would be sent to ${to}`)
      return
    }

    // Get brand configuration
    let brandConfig: any = {}
    let companyName = 'Csaas'

    if (tenantId) {
      try {
        brandConfig = await this.brandingService.getBranding(tenantId)
        companyName = brandConfig.companyName || 'Csaas'
      } catch (error) {
        this.logger.warn(`Failed to load brand config for tenant ${tenantId}, using defaults`)
      }
    }

    const subject = `欢迎加入 ${companyName} 雷达服务`

    // Render welcome email template
    const welcomeTemplate = this.emailTemplateService.getWelcomeEmailTemplate()
    const content = this.emailTemplateService.renderTemplate(welcomeTemplate, {
      clientName,
      companyName,
    })

    // Render with brand configuration
    const html = this.emailTemplateService.renderBrandedEmail(content, {
      companyName: brandConfig.companyName,
      logoUrl: brandConfig.logoUrl,
      primaryColor: brandConfig.primaryColor,
      contactEmail: brandConfig.contactEmail,
      contactPhone: brandConfig.contactPhone,
      emailSignature: brandConfig.emailSignature,
    })

    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@csaas.com'),
        to,
        subject,
        html,
      })

      this.logger.log(`Welcome email sent to ${to}: ${info.messageId}`)
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error)
      throw error
    }
  }

  /**
   * Generate welcome email HTML content
   */
  private generateWelcomeEmailHtml(clientName: string, tenantName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>欢迎加入雷达服务</h1>
    </div>
    <div class="content">
      <h2>尊敬的 ${clientName}，</h2>
      <p>欢迎您加入 ${tenantName || 'Csaas'} 的雷达服务平台！</p>
      <p>我们的服务将为您提供：</p>
      <ul>
        <li>📊 技术雷达 - 实时追踪行业技术趋势</li>
        <li>🏢 行业雷达 - 同业标杆学习与案例分享</li>
        <li>⚖️ 合规雷达 - 风险预警与应对剧本</li>
      </ul>
      <p>您的专属顾问将很快与您联系，协助完成系统配置。</p>
      <p style="text-align: center; margin-top: 30px;">
        <a href="${this.configService.get<string>('APP_URL', 'https://csaas.com')}" class="button">访问平台</a>
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
      <p>&copy; 2026 ${tenantName || 'Csaas'}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Send bulk import result email with brand configuration
   *
   * @param to - Recipient email address
   * @param successCount - Number of successfully imported clients
   * @param failedCount - Number of failed imports
   * @param tenantId - Tenant ID for brand configuration
   */
  async sendBulkImportResultEmail(
    to: string,
    successCount: number,
    failedCount: number,
    tenantId?: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[Email Disabled] Bulk import result email would be sent to ${to}`)
      return
    }

    // Get brand configuration
    let brandConfig: any = {}
    let companyName = 'Csaas'

    if (tenantId) {
      try {
        brandConfig = await this.brandingService.getBranding(tenantId)
        companyName = brandConfig.companyName || 'Csaas'
      } catch (error) {
        this.logger.warn(`Failed to load brand config for tenant ${tenantId}, using defaults`)
      }
    }

    const subject = `客户批量导入完成 - ${successCount} 成功, ${failedCount} 失败`

    const content = `
<h2>客户批量导入完成</h2>
<div style="display: flex; justify-content: space-around; margin: 20px 0;">
  <div style="text-align: center; padding: 20px; background-color: #f0f0f0; border-radius: 5px;">
    <div style="font-size: 36px; font-weight: bold; color: #4CAF50;">${successCount}</div>
    <div>成功导入</div>
  </div>
  <div style="text-align: center; padding: 20px; background-color: #f0f0f0; border-radius: 5px;">
    <div style="font-size: 36px; font-weight: bold; color: #f44336;">${failedCount}</div>
    <div>导入失败</div>
  </div>
</div>
<p>请登录系统查看详细结果。</p>
    `.trim()

    const html = this.emailTemplateService.renderBrandedEmail(content, {
      companyName: brandConfig.companyName,
      logoUrl: brandConfig.logoUrl,
      primaryColor: brandConfig.primaryColor,
      contactEmail: brandConfig.contactEmail,
      contactPhone: brandConfig.contactPhone,
      emailSignature: brandConfig.emailSignature,
    })

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@csaas.com'),
        to,
        subject,
        html,
      })

      this.logger.log(`Bulk import result email sent to ${to}`)
    } catch (error) {
      this.logger.error(`Failed to send bulk import result email to ${to}`, error)
    }
  }

  /**
   * Send churn risk alert email to admin
   *
   * @param to - Recipient email address (admin)
   * @param organizationName - Client organization name
   * @param activityRate - Current monthly activity rate
   */
  async sendChurnRiskAlert({
    to,
    organizationName,
    activityRate,
  }: {
    to: string
    organizationName: string
    activityRate: number
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[Email Disabled] Churn risk alert would be sent to ${to}`)
      return
    }

    const subject = `客户流失风险预警 - ${organizationName}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .alert-box { background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; }
    .metric { display: inline-block; padding: 10px 20px; background-color: #fff; border-radius: 5px; margin: 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #f44336; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>客户流失风险预警</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>警告：</strong>检测到客户活跃度低于阈值，需要关注。
      </div>
      <h2>客户信息</h2>
      <p><strong>客户名称：</strong>${organizationName}</p>
      <div class="metric">
        <div>月活率</div>
        <div class="metric-value">${activityRate.toFixed(1)}%</div>
      </div>
      <p><strong>风险等级：</strong>高（月活率 < 60%）</p>
      <h3>建议措施：</h3>
      <ul>
        <li>主动联系客户，了解使用情况</li>
        <li>检查推送内容相关性</li>
        <li>评估推送频率是否合适</li>
        <li>提供产品培训或功能演示</li>
      </ul>
      <p style="text-align: center;">
        <a href="${this.configService.get<string>('APP_URL', 'https://csaas.com')}/admin/clients/churn-risk" class="button">查看详情</a>
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
      <p>&copy; 2026 Csaas. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim()

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@csaas.com'),
        to,
        subject,
        html,
      })

      this.logger.log(`Churn risk alert sent to ${to} for ${organizationName}`)
    } catch (error) {
      this.logger.error(`Failed to send churn risk alert to ${to}`, error)
    }
  }

  /**
   * Send AI cost exceeded alert email to admin
   *
   * @param to - Recipient email address (admin)
   * @param organizationName - Client organization name
   * @param cost - Current monthly cost
   * @param threshold - Cost threshold
   */
  async sendCostExceededAlert({
    to,
    organizationName,
    cost,
    threshold,
  }: {
    to: string
    organizationName: string
    cost: number
    threshold: number
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[Email Disabled] Cost exceeded alert would be sent to ${to}`)
      return
    }

    const subject = `AI 成本超标预警 - ${organizationName}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .alert-box { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }
    .metric { display: inline-block; padding: 10px 20px; background-color: #fff; border-radius: 5px; margin: 10px 5px; }
    .metric-label { font-size: 12px; color: #666; }
    .metric-value { font-size: 24px; font-weight: bold; color: #ff9800; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 10px 20px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI 成本超标预警</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>警告：</strong>检测到客户 AI 使用成本超过阈值，需要关注。
      </div>
      <h2>客户信息</h2>
      <p><strong>客户名称：</strong>${organizationName}</p>
      <div style="text-align: center; margin: 20px 0;">
        <div class="metric">
          <div class="metric-label">当前成本</div>
          <div class="metric-value">¥${cost.toFixed(2)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">成本阈值</div>
          <div class="metric-value">¥${threshold.toFixed(2)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">超出比例</div>
          <div class="metric-value">${(((cost - threshold) / threshold) * 100).toFixed(1)}%</div>
        </div>
      </div>
      <h3>建议措施：</h3>
      <ul>
        <li>检查客户的 AI 使用模式，识别异常高频调用</li>
        <li>评估是否需要调整推送频率或内容策略</li>
        <li>与客户沟通，了解业务需求变化</li>
        <li>考虑优化 AI 调用策略，减少不必要的成本</li>
      </ul>
      <p style="text-align: center;">
        <a href="${this.configService.get<string>('APP_URL', 'https://csaas.com')}/admin/cost-optimization" class="button">查看详情</a>
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
      <p>&copy; 2026 Csaas. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim()

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@csaas.com'),
        to,
        subject,
        html,
      })

      this.logger.log(`Cost exceeded alert sent to ${to} for ${organizationName}`)
    } catch (error) {
      this.logger.error(`Failed to send cost exceeded alert to ${to}`, error)
    }
  }
}
