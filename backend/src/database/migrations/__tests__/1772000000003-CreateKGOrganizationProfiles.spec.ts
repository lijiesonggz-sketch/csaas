import { CreateKGOrganizationProfiles1772000000003 } from '../1772000000003-CreateKGOrganizationProfiles'

describe('CreateKGOrganizationProfiles1772000000003', () => {
  let migration: CreateKGOrganizationProfiles1772000000003

  beforeEach(() => {
    migration = new CreateKGOrganizationProfiles1772000000003()
  })

  it('should create organization_profiles table when it does not exist', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    } as any

    await migration.up(queryRunner)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('organization_profiles')
    expect(queryRunner.query).toHaveBeenCalledTimes(1)
    expect(queryRunner.query.mock.calls[0][0]).toContain('CREATE TABLE "organization_profiles"')
    expect(queryRunner.query.mock.calls[0][0]).toContain('"org_id" uuid PRIMARY KEY')
  })

  it('should skip creation when organization_profiles table already exists', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn(),
    } as any

    await migration.up(queryRunner)

    expect(queryRunner.query).not.toHaveBeenCalled()
  })

  it('should drop organization_profiles table on down when table exists', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    } as any

    await migration.down(queryRunner)

    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "organization_profiles"')
  })
})
