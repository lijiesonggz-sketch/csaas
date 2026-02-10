import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddLoginSecurityFields20260209172825 implements MigrationInterface {
  name = 'AddLoginSecurityFields20260209172825'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add failed_login_attempts column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failed_login_attempts',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    )

    // Add locked_until column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'locked_until',
        type: 'timestamp',
        isNullable: true,
      }),
    )

    // Add last_login_at column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'last_login_at',
        type: 'timestamp',
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns in reverse order
    await queryRunner.dropColumn('users', 'last_login_at')
    await queryRunner.dropColumn('users', 'locked_until')
    await queryRunner.dropColumn('users', 'failed_login_attempts')
  }
}
