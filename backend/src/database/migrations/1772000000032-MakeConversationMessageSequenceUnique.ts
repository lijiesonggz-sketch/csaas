import { MigrationInterface, QueryRunner } from 'typeorm'

export class MakeConversationMessageSequenceUnique1772000000032 implements MigrationInterface {
  name = 'MakeConversationMessageSequenceUnique1772000000032'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_tenant_session_sequence"
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_conversation_messages_tenant_session_sequence"
      ON "conversation_messages" ("tenant_id", "session_id", "sequence")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_tenant_session_sequence"
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_tenant_session_sequence"
      ON "conversation_messages" ("tenant_id", "session_id", "sequence")
    `)
  }
}
