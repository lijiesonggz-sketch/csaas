import { IsString, IsNotEmpty, MaxLength, IsIn, IsOptional } from 'class-validator'
import { INSTITUTION_TYPE_REGISTRY, Industry } from '../../../constants/institution-types'

/**
 * DTO for creating a new watched peer
 */
export class CreateWatchedPeerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  peerName: string

  @IsString()
  @IsNotEmpty()
  @IsIn(Object.keys(INSTITUTION_TYPE_REGISTRY))
  industry: Industry

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  institutionType: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string
}

/**
 * DTO for watched peer response
 */
export class WatchedPeerResponseDto {
  id: string
  organizationId: string
  peerName: string
  industry: string
  institutionType: string
  description?: string
  createdAt: string
  relatedPushCount?: number
}
