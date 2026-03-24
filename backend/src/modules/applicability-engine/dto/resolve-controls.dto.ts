import { IsIn, IsOptional, IsUUID } from 'class-validator'
import {
  PackResolutionDebugEntry,
  ResolvedControl,
  ResolvedControlSet,
} from '../types/applicability.types'

export const RESOLVE_CONTROLS_SCENES = [
  'quick-gap-analysis',
  'survey',
  'radar',
  'report',
] as const

export type ResolveControlsScene = (typeof RESOLVE_CONTROLS_SCENES)[number]

export class ResolveControlsRequestDto {
  @IsUUID()
  organizationId!: string

  @IsOptional()
  @IsIn(RESOLVE_CONTROLS_SCENES)
  scene?: ResolveControlsScene
}

export class ResolveControlsResponseDto implements ResolvedControlSet {
  organizationId!: string
  scene?: ResolveControlsScene
  influencingProfileFields!: string[]
  matchedPacks!: string[]
  matchedRules!: string[]
  controls!: ResolvedControl[]
  summary!: ResolvedControlSet['summary']
  debugLog!: PackResolutionDebugEntry[]
}
