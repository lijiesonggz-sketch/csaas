import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { PushPreference } from '../../../database/entities/push-preference.entity'
import { UpdatePushPreferenceDto, PushPreferenceResponseDto } from '../dto/push-preference.dto'

/**
 * Push Preference Service
 *
 * Manages organization push notification preferences.
 * Each organization has exactly one push preference record.
 */
@Injectable()
export class PushPreferenceService {
  private readonly logger = new Logger(PushPreferenceService.name)

  constructor(
    @InjectRepository(PushPreference)
    private readonly pushPreferenceRepo: Repository<PushPreference>,
  ) {}

  /**
   * Get or create default push preference for an organization
   *
   * If no preference exists, creates one with default values:
   * - pushStartTime: "09:00"
   * - pushEndTime: "18:00"
   * - dailyPushLimit: 5
   * - relevanceFilter: "high_only"
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @returns Push preference record
   */
  async getOrCreatePreference(tenantId: string, organizationId: string): Promise<PushPreferenceResponseDto> {
    let preference = await this.pushPreferenceRepo.findOne({
      where: { tenantId, organizationId },
    })

    if (!preference) {
      this.logger.log(`Creating default push preference for tenant ${tenantId}, organization ${organizationId}`)
      preference = this.pushPreferenceRepo.create({
        tenantId,
        organizationId,
        pushStartTime: '09:00',
        pushEndTime: '18:00',
        dailyPushLimit: 5,
        relevanceFilter: 'high_only',
      })
      await this.pushPreferenceRepo.save(preference)
    }

    return this.toResponseDto(preference)
  }

  /**
   * Update push preference for an organization
   *
   * Validates time range and updates only provided fields.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @param dto - Update data
   * @returns Updated push preference
   * @throws BadRequestException if validation fails
   */
  async updatePreference(
    tenantId: string,
    organizationId: string,
    dto: UpdatePushPreferenceDto,
  ): Promise<PushPreferenceResponseDto> {
    // Validate time range if both times are provided
    if (dto.pushStartTime && dto.pushEndTime) {
      this.validateTimeRange(dto.pushStartTime, dto.pushEndTime)
    }

    // Get or create preference
    let preference = await this.pushPreferenceRepo.findOne({
      where: { tenantId, organizationId },
    })

    if (!preference) {
      preference = this.pushPreferenceRepo.create({
        tenantId,
        organizationId,
        pushStartTime: dto.pushStartTime ?? '09:00',
        pushEndTime: dto.pushEndTime ?? '18:00',
        dailyPushLimit: dto.dailyPushLimit ?? 5,
        relevanceFilter: dto.relevanceFilter ?? 'high_only',
      })
    } else {
      // Update only provided fields
      if (dto.pushStartTime !== undefined) {
        preference.pushStartTime = dto.pushStartTime
      }
      if (dto.pushEndTime !== undefined) {
        preference.pushEndTime = dto.pushEndTime
      }
      if (dto.dailyPushLimit !== undefined) {
        preference.dailyPushLimit = dto.dailyPushLimit
      }
      if (dto.relevanceFilter !== undefined) {
        preference.relevanceFilter = dto.relevanceFilter
      }
    }

    await this.pushPreferenceRepo.save(preference)
    this.logger.log(`Updated push preference for tenant ${tenantId}, organization ${organizationId}`)

    return this.toResponseDto(preference)
  }

  /**
   * Validate time range
   *
   * Rules:
   * - Start time must be different from end time
   * - Time span must be at least 1 hour
   * - Supports overnight windows (e.g., 22:00-08:00)
   *
   * @param startTime - Start time (HH:mm)
   * @param endTime - End time (HH:mm)
   * @throws BadRequestException if validation fails
   */
  validateTimeRange(startTime: string, endTime: string): void {
    // Parse times to minutes since midnight
    const parseTime = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }

    const startMinutes = parseTime(startTime)
    const endMinutes = parseTime(endTime)

    // Check if times are the same
    if (startTime === endTime) {
      throw new BadRequestException('开始时间必须早于结束时间')
    }

    // Calculate time span (handle overnight)
    let spanMinutes: number
    if (startMinutes < endMinutes) {
      spanMinutes = endMinutes - startMinutes
    } else {
      // Overnight: e.g., 22:00-08:00 = (24:00-22:00) + 08:00 = 600 minutes
      spanMinutes = 24 * 60 - startMinutes + endMinutes
    }

    // Minimum 1 hour span
    if (spanMinutes < 60) {
      throw new BadRequestException('时段跨度至少 1 小时')
    }
  }

  /**
   * Convert entity to response DTO
   */
  private toResponseDto(preference: PushPreference): PushPreferenceResponseDto {
    return {
      id: preference.id,
      organizationId: preference.organizationId,
      pushStartTime: preference.pushStartTime,
      pushEndTime: preference.pushEndTime,
      dailyPushLimit: preference.dailyPushLimit,
      relevanceFilter: preference.relevanceFilter,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    }
  }
}
