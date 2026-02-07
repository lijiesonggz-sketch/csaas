import { Test, TestingModule } from '@nestjs/testing'
import { EmailTemplateService } from './email-template.service'

describe('EmailTemplateService', () => {
  let service: EmailTemplateService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailTemplateService],
    }).compile()

    service = module.get<EmailTemplateService>(EmailTemplateService)
  })

  describe('renderTemplate', () => {
    it('should replace template variables', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!'
      const variables = {
        name: 'John',
        company: 'ABC Consulting',
      }

      const result = service.renderTemplate(template, variables)

      expect(result).toBe('Hello John, welcome to ABC Consulting!')
    })

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!'
      const variables = {
        name: 'John',
      }

      const result = service.renderTemplate(template, variables)

      expect(result).toBe('Hello John, welcome to {{company}}!')
    })

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{name}} is {{name}}'
      const variables = {
        name: 'Test',
      }

      const result = service.renderTemplate(template, variables)

      expect(result).toBe('Test is Test')
    })
  })

  describe('renderBrandedEmail', () => {
    it('should render email with brand configuration', () => {
      const brandConfig = {
        companyName: 'ABC Consulting',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#ff0000',
        contactEmail: 'contact@abc.com',
        contactPhone: '400-123-4567',
        emailSignature: 'Best regards,\nABC Team',
      }

      const content = 'This is the email content'

      const result = service.renderBrandedEmail(content, brandConfig)

      expect(result).toContain('ABC Consulting')
      expect(result).toContain('https://example.com/logo.png')
      expect(result).toContain('#ff0000')
      expect(result).toContain('This is the email content')
      expect(result).toContain('Best regards,')
      expect(result).toContain('contact@abc.com')
    })

    it('should use default values when brand config is empty', () => {
      const brandConfig = {}
      const content = 'Test content'

      const result = service.renderBrandedEmail(content, brandConfig)

      expect(result).toContain('Csaas')
      expect(result).toContain('Test content')
    })
  })

  describe('getWelcomeEmailTemplate', () => {
    it('should return welcome email template', () => {
      const template = service.getWelcomeEmailTemplate()

      expect(template).toContain('{{companyName}}')
      expect(template).toContain('{{clientName}}')
    })
  })
})
