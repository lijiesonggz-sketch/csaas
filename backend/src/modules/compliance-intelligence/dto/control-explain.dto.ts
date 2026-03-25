import { IsUUID } from 'class-validator'

export class QueryControlExplainDto {
  @IsUUID()
  organizationId: string
}
