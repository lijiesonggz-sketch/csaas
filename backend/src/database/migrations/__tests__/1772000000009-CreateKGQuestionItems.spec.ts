import { CreateKGQuestionItems1772000000009 } from '../1772000000009-CreateKGQuestionItems'

describe('CreateKGQuestionItems1772000000009', () => {
  let migration: CreateKGQuestionItems1772000000009

  beforeEach(() => {
    migration = new CreateKGQuestionItems1772000000009()
  })

  it('should create question_items table with required indexes', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('question_items')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "question_items"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_question_items_control'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_question_items_type'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_question_items_status'),
    )
  })

  it('should drop indexes and table on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_question_items_status"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_question_items_type"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_question_items_control"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "question_items"')
  })
})
