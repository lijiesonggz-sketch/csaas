import { APP_ENTITY_NAMES } from '../../../config/typeorm.entities'
import { CreateAdvisoryModuleConfigs1772000000029 } from '../../../database/migrations/1772000000029-CreateAdvisoryModuleConfigs'

describe('AdvisoryModuleConfig metadata', () => {
  it('registers AdvisoryModuleConfig in the shared TypeORM entity list', () => {
    expect(APP_ENTITY_NAMES).toContain('AdvisoryModuleConfig')
  })

  it('does not front-load later advisory runtime entities', () => {
    expect(APP_ENTITY_NAMES).not.toEqual(
      expect.arrayContaining([
        'WorkflowSession',
        'ConversationMessage',
        'WorkflowOutput',
        'WorkflowCheckpoint',
        'OutputRating',
        'OrganizationContext',
      ]),
    )
  })

  it('creates only the advisory_module_configs table in this story migration', async () => {
    const queries: string[] = []
    const queryRunner = {
      query: jest.fn((sql: string) => {
        queries.push(sql)
        return Promise.resolve()
      }),
    }

    await new CreateAdvisoryModuleConfigs1772000000029().up(queryRunner as never)

    const migrationSql = queries.join('\n')
    expect(migrationSql).toContain('advisory_module_configs')
    expect(migrationSql).not.toContain('workflow_sessions')
    expect(migrationSql).not.toContain('conversation_messages')
    expect(migrationSql).not.toContain('workflow_outputs')
    expect(migrationSql).not.toContain('workflow_checkpoints')
    expect(migrationSql).not.toContain('output_ratings')
    expect(migrationSql).not.toContain('organization_context')
  })
})
