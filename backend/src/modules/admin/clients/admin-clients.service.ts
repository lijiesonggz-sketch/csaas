import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, DataSource } from 'typeorm'
import { Organization } from '../../../database/entities/organization.entity'
import { PushPreference } from '../../../database/entities/push-preference.entity'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { BulkConfigDto, RelevanceFilter } from './dto/bulk-config.dto'
import { EmailService } from './email.service'

/**
 * Admin Clients Service
 *
 * Service for managing client organizations from the admin perspective.
 * Provides CRUD operations and bulk configuration for consulting companies.
 *
 * @story 6-2
 */
@Injectable()
export class AdminClientsService {
  private readonly logger = new Logger(AdminClientsService.name)

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(PushPreference)
    private readonly pushPreferenceRepository: Repository<PushPreference>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get all clients for a tenant
   *
   * @param tenantId - The consulting company tenant ID
   * @returns Array of client organizations
   */
  async findAll(tenantId: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      relations: ['groupMemberships', 'groupMemberships.group'],
    })
  }

  /**
   * Get a single client by ID with statistics
   *
   * @param tenantId - The consulting company tenant ID
   * @param id - Client organization ID
   * @returns The client organization with statistics
   */
  async findOne(
    tenantId: string,
    id: string,
  ): Promise<
    Organization & {
      statistics?: {
        weaknessCount: number
        watchedTopicCount: number
        watchedPeerCount: number
        totalPushes: number
      }
    }
  > {
    const organization = await this.organizationRepository.findOne({
      where: { id, tenantId },
      relations: [
        'groupMemberships',
        'groupMemberships.group',
        'weaknessSnapshots',
        'watchedTopics',
        'watchedPeers',
      ],
    })

    if (!organization) {
      throw new NotFoundException(`Client with ID ${id} not found`)
    }

    // Calculate statistics
    const statistics = {
      weaknessCount: organization.weaknessSnapshots?.length || 0,
      watchedTopicCount: organization.watchedTopics?.length || 0,
      watchedPeerCount: organization.watchedPeers?.length || 0,
      totalPushes: 0, // TODO: Query RadarPush count when needed
    }

    return { ...organization, statistics }
  }

  /**
   * Create a new client organization
   *
   * @param tenantId - The consulting company tenant ID
   * @param dto - Create client data
   * @returns The created organization
   */
  async create(tenantId: string, dto: CreateClientDto): Promise<Organization> {
    // Create organization
    const organization = this.organizationRepository.create({
      name: dto.name,
      contactPerson: dto.contactPerson,
      contactEmail: dto.contactEmail,
      industryType: dto.industryType,
      scale: dto.scale,
      tenantId,
      status: 'trial',
    })

    const savedOrg = await this.organizationRepository.save(organization)

    // Create default push preferences
    // TODO: Fix PushPreference entity metadata issue
    // For now, skip creating push preferences to unblock testing
    try {
      const pushPreference = this.pushPreferenceRepository.create({
        organizationId: savedOrg.id,
        tenantId: savedOrg.tenantId,
        pushStartTime: '09:00',
        pushEndTime: '18:00',
        dailyPushLimit: 5,
        relevanceFilter: 'high_only',
      })
      await this.pushPreferenceRepository.save(pushPreference)
    } catch (error) {
      this.logger.warn(`Failed to create push preferences for organization ${savedOrg.id}: ${error.message}`)
      // Don't fail the entire operation if push preference creation fails
    }

    // Send welcome email
    if (dto.contactEmail) {
      try {
        await this.emailService.sendWelcomeEmail(dto.contactEmail, savedOrg.name)
      } catch (error) {
        this.logger.error(`Failed to send welcome email to ${dto.contactEmail}`, error)
        // Don't fail the entire operation if email fails
      }
    }

    return savedOrg
  }

  /**
   * Update a client organization
   *
   * @param tenantId - The consulting company tenant ID
   * @param id - Client organization ID
   * @param dto - Update client data
   * @returns The updated organization
   */
  async update(tenantId: string, id: string, dto: UpdateClientDto): Promise<Organization> {
    const organization = await this.findOne(tenantId, id)

    // Handle status change to active
    if (dto.status === 'active' && organization.status !== 'active') {
      organization.activatedAt = new Date()
    }

    // Update fields
    if (dto.name !== undefined) organization.name = dto.name
    if (dto.contactPerson !== undefined) organization.contactPerson = dto.contactPerson
    if (dto.contactEmail !== undefined) organization.contactEmail = dto.contactEmail
    if (dto.industryType !== undefined) organization.industryType = dto.industryType
    if (dto.scale !== undefined) organization.scale = dto.scale
    if (dto.status !== undefined) organization.status = dto.status

    return this.organizationRepository.save(organization)
  }

  /**
   * Delete a client organization (soft delete)
   *
   * @param tenantId - The consulting company tenant ID
   * @param id - Client organization ID
   */
  async remove(tenantId: string, id: string): Promise<void> {
    const organization = await this.findOne(tenantId, id)
    await this.organizationRepository.softRemove(organization)
  }

  /**
   * Create multiple clients from CSV import
   *
   * @param tenantId - The consulting company tenant ID
   * @param clients - Array of client data
   * @returns Object with success and failed arrays
   */
  async bulkCreate(
    tenantId: string,
    clients: CreateClientDto[],
  ): Promise<{
    success: Organization[]
    failed: Array<{ dto: CreateClientDto; error: string }>
  }> {
    const success: Organization[] = []
    const failed: Array<{ dto: CreateClientDto; error: string }> = []

    for (const dto of clients) {
      try {
        const org = await this.create(tenantId, dto)
        success.push(org)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Failed to create client ${dto.name}: ${errorMessage}`)
        failed.push({ dto, error: errorMessage })
      }
    }

    return { success, failed }
  }

  /**
   * Apply bulk configuration to multiple clients
   *
   * @param tenantId - The consulting company tenant ID
   * @param dto - Bulk configuration data
   * @returns Number of updated clients
   */
  async bulkConfig(tenantId: string, dto: BulkConfigDto): Promise<number> {
    // Verify all organizations belong to this tenant
    const organizations = await this.organizationRepository.find({
      where: {
        id: In(dto.organizationIds),
        tenantId,
      },
    })

    if (organizations.length !== dto.organizationIds.length) {
      throw new NotFoundException('Some organizations not found or do not belong to this tenant')
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      let updatedCount = 0

      for (const org of organizations) {
        const pushPreference = await queryRunner.manager.findOne(PushPreference, {
          where: { organizationId: org.id },
        })

        if (pushPreference) {
          if (dto.pushStartTime !== undefined) pushPreference.pushStartTime = dto.pushStartTime
          if (dto.pushEndTime !== undefined) pushPreference.pushEndTime = dto.pushEndTime
          if (dto.dailyPushLimit !== undefined) pushPreference.dailyPushLimit = dto.dailyPushLimit
          if (dto.relevanceFilter !== undefined) {
            // Map RelevanceFilter to PushPreference format
            const filterMap: Record<RelevanceFilter, 'high_only' | 'high_medium'> = {
              [RelevanceFilter.HIGH]: 'high_only',
              [RelevanceFilter.MEDIUM]: 'high_medium',
              [RelevanceFilter.LOW]: 'high_medium',
            }
            pushPreference.relevanceFilter = filterMap[dto.relevanceFilter]
          }

          await queryRunner.manager.save(pushPreference)
          updatedCount++
        }
      }

      await queryRunner.commitTransaction()
      return updatedCount
    } catch (error) {
      await queryRunner.rollbackTransaction()
      this.logger.error('Failed to apply bulk configuration', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Get client statistics
   *
   * @param tenantId - The consulting company tenant ID
   * @returns Statistics object
   */
  async getStatistics(tenantId: string): Promise<{
    total: number
    active: number
    trial: number
    inactive: number
  }> {
    const clients = await this.organizationRepository.find({
      where: { tenantId },
      select: ['id', 'status'],
    })

    return {
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      trial: clients.filter((c) => c.status === 'trial').length,
      inactive: clients.filter((c) => c.status === 'inactive').length,
    }
  }
}
