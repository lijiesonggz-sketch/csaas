import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * Migration: Add Industry Radar fields to RawContent
 * Story 3.1: Configure industry radar information sources
 *
 * Adds two new columns to support industry radar data collection:
 * - contentType: Distinguish between article, recruitment, conference content
 * - peerName: Track peer institution names for industry benchmarking
 */
export class AddIndustryFieldsToRawContent1738300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add contentType column
    await queryRunner.addColumn(
      'raw_contents',
      new TableColumn({
        name: 'contentType',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Content type: article, recruitment, or conference',
      }),
    )

    // Add peerName column
    await queryRunner.addColumn(
      'raw_contents',
      new TableColumn({
        name: 'peerName',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Peer institution name for industry radar matching',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns in reverse order
    await queryRunner.dropColumn('raw_contents', 'peerName')
    await queryRunner.dropColumn('raw_contents', 'contentType')
  }
}
