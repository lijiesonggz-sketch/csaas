import { IsString, IsOptional, Length, IsArray, IsUUID } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Create Client Group DTO
 *
 * Data transfer object for creating a new client group.
 *
 * @story 6-2
 */
export class CreateClientGroupDto {
  @ApiProperty({ description: '分组名称', example: '城商行客户' })
  @IsString()
  @Length(1, 255)
  name: string

  @ApiPropertyOptional({ description: '分组描述', example: '城市商业银行客户分组' })
  @IsString()
  @IsOptional()
  description?: string
}

/**
 * Add Clients to Group DTO
 *
 * Data transfer object for adding clients to a group.
 *
 * @story 6-2
 */
export class AddClientsToGroupDto {
  @ApiProperty({
    description: '要添加的客户组织 ID 列表',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  organizationIds: string[]
}
