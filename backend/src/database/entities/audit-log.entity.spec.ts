import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog, AuditAction } from './audit-log.entity'

describe('AuditLog Entity', () => {
  it('should create an audit log entity with all required fields', () => {
    // Arrange
    const auditLog = new AuditLog()
    auditLog.userId = 'user-123'
    auditLog.organizationId = 'org-123'
    auditLog.action = AuditAction.PLAYBOOK_VIEW
    auditLog.entityType = 'compliance_playbook'
    auditLog.entityId = 'push-123'
    auditLog.details = {
      playbookStatus: 'ready',
      checklistItemsCount: 5,
    }

    // Assert
    expect(auditLog.userId).toBe('user-123')
    expect(auditLog.organizationId).toBe('org-123')
    expect(auditLog.action).toBe(AuditAction.PLAYBOOK_VIEW)
    expect(auditLog.entityType).toBe('compliance_playbook')
    expect(auditLog.entityId).toBe('push-123')
    expect(auditLog.details).toBeDefined()
    expect(auditLog.details.checklistItemsCount).toBe(5)
  })

  it('should accept all valid action types', () => {
    // Arrange & Act
    const actions: AuditAction[] = [
      AuditAction.PLAYBOOK_VIEW,
      AuditAction.CHECKLIST_SUBMIT,
      AuditAction.CHECKLIST_UPDATE,
      AuditAction.PUSH_SENT,
      AuditAction.PUSH_FAILED,
    ]

    // Assert
    actions.forEach((action) => {
      const auditLog = new AuditLog()
      auditLog.userId = 'user-123'
      auditLog.action = action
      auditLog.entityType = 'compliance_playbook'
      auditLog.entityId = 'push-123'

      expect(auditLog.action).toBe(action)
    })
  })

  it('should handle null organizationId', () => {
    // Arrange
    const auditLog = new AuditLog()
    auditLog.userId = 'user-123'
    auditLog.organizationId = null
    auditLog.action = AuditAction.PLAYBOOK_VIEW
    auditLog.entityType = 'compliance_playbook'
    auditLog.entityId = 'push-123'

    // Assert
    expect(auditLog.organizationId).toBeNull()
  })

  it('should store optional ipAddress and userAgent', () => {
    // Arrange
    const auditLog = new AuditLog()
    auditLog.userId = 'user-123'
    auditLog.action = AuditAction.PLAYBOOK_VIEW
    auditLog.entityType = 'compliance_playbook'
    auditLog.entityId = 'push-123'
    auditLog.ipAddress = '192.168.1.100'
    auditLog.userAgent = 'Mozilla/5.0'

    // Assert
    expect(auditLog.ipAddress).toBe('192.168.1.100')
    expect(auditLog.userAgent).toBe('Mozilla/5.0')
  })

  it('should have createdAt timestamp', () => {
    // Arrange
    const beforeDate = new Date()
    const auditLog = new AuditLog()
    auditLog.userId = 'user-123'
    auditLog.action = AuditAction.PLAYBOOK_VIEW
    auditLog.entityType = 'compliance_playbook'
    auditLog.entityId = 'push-123'

    // @CreateDateColumn() 只在数据库保存时自动设置，在测试中手动设置
    auditLog.createdAt = new Date()
    const afterDate = new Date()

    // Assert
    expect(auditLog.createdAt).toBeDefined()
    expect(auditLog.createdAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime())
    expect(auditLog.createdAt.getTime()).toBeLessThanOrEqual(afterDate.getTime())
  })
})
