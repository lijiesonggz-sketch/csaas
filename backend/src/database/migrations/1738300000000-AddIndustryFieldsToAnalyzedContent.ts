import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * Story 3.2: 添加行业雷达字段到AnalyzedContent表
 *
 * 新增字段:
 * - practiceDescription: 技术实践描述
 * - estimatedCost: 投入成本
 * - implementationPeriod: 实施周期
 * - technicalEffect: 技术效果
 */
export class AddIndustryFieldsToAnalyzedContent1738300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加技术实践描述字段
    await queryRunner.addColumn(
      'analyzed_contents',
      new TableColumn({
        name: 'practiceDescription',
        type: 'text',
        isNullable: true,
        comment: 'AI提取的同业技术实践场景描述 (Story 3.2)',
      }),
    )

    // 添加投入成本字段
    await queryRunner.addColumn(
      'analyzed_contents',
      new TableColumn({
        name: 'estimatedCost',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'AI提取的项目投入成本 (Story 3.2)',
      }),
    )

    // 添加实施周期字段
    await queryRunner.addColumn(
      'analyzed_contents',
      new TableColumn({
        name: 'implementationPeriod',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'AI提取的项目实施周期 (Story 3.2)',
      }),
    )

    // 添加技术效果字段
    await queryRunner.addColumn(
      'analyzed_contents',
      new TableColumn({
        name: 'technicalEffect',
        type: 'text',
        isNullable: true,
        comment: 'AI提取的技术实施效果 (Story 3.2)',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚时删除字段
    await queryRunner.dropColumn('analyzed_contents', 'technicalEffect')
    await queryRunner.dropColumn('analyzed_contents', 'implementationPeriod')
    await queryRunner.dropColumn('analyzed_contents', 'estimatedCost')
    await queryRunner.dropColumn('analyzed_contents', 'practiceDescription')
  }
}
