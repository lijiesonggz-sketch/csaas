import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, FindManyOptions } from 'typeorm'
import { PeerCrawlerTaskRepository } from './peer-crawler-task.repository'
import { PeerCrawlerTask } from '../entities/peer-crawler-task.entity'

/**
 * PeerCrawlerTaskRepository Unit Tests
 *
 * Story 8.2: 同业采集任务调度与执行
 */
describe('PeerCrawlerTaskRepository', () => {
  let repository: PeerCrawlerTaskRepository
  let typeormRepository: Repository<PeerCrawlerTask>

  const mockTypeormRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    count: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerCrawlerTaskRepository,
        {
          provide: getRepositoryToken(PeerCrawlerTask),
          useValue: mockTypeormRepository,
        },
      ],
    }).compile()

    repository = module.get<PeerCrawlerTaskRepository>(PeerCrawlerTaskRepository)
    typeormRepository = module.get<Repository<PeerCrawlerTask>>(
      getRepositoryToken(PeerCrawlerTask),
    )

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(repository).toBeDefined()
  })

  describe('create', () => {
    it('should create a new task with default status pending', async () => {
      const createData = {
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        sourceType: 'website' as const,
        targetUrl: 'https://example.com',
      }

      const createdTask = {
        id: 'task-1',
        ...createData,
        status: 'pending',
        retryCount: 0,
      }

      mockTypeormRepository.create.mockReturnValue(createdTask)
      mockTypeormRepository.save.mockResolvedValue(createdTask)

      const result = await repository.create(createData)

      expect(mockTypeormRepository.create).toHaveBeenCalledWith({
        ...createData,
        status: 'pending',
        retryCount: 0,
      })
      expect(mockTypeormRepository.save).toHaveBeenCalledWith(createdTask)
      expect(result).toEqual(createdTask)
    })

    it('should create a task with explicit status', async () => {
      const createData = {
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        sourceType: 'website' as const,
        targetUrl: 'https://example.com',
        status: 'running' as const,
      }

      const createdTask = {
        id: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        sourceType: 'website',
        targetUrl: 'https://example.com',
        status: 'running',
        retryCount: 0,
      }

      mockTypeormRepository.create.mockReturnValue(createdTask)
      mockTypeormRepository.save.mockResolvedValue(createdTask)

      const result = await repository.create(createData)

      expect(result.status).toBe('running')
      expect(result.retryCount).toBe(0)
    })

    it('should create tasks for different source types', async () => {
      const sourceTypes: Array<'website' | 'wechat' | 'recruitment' | 'conference'> = [
        'website',
        'wechat',
        'recruitment',
        'conference',
      ]

      for (const sourceType of sourceTypes) {
        const createData = {
          sourceId: `source-${sourceType}`,
          peerName: 'Test Peer',
          tenantId: 'tenant-1',
          sourceType,
          targetUrl: 'https://example.com',
        }

        const createdTask = {
          id: `task-${sourceType}`,
          ...createData,
          status: 'pending',
          retryCount: 0,
        }

        mockTypeormRepository.create.mockReturnValue(createdTask)
        mockTypeormRepository.save.mockResolvedValue(createdTask)

        const result = await repository.create(createData)

        expect(result.sourceType).toBe(sourceType)
      }
    })
  })

  describe('findById', () => {
    it('should find task by id', async () => {
      const task = {
        id: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        status: 'pending',
        sourceType: 'website',
        targetUrl: 'https://example.com',
        retryCount: 0,
      }

      mockTypeormRepository.findOne.mockResolvedValue(task)

      const result = await repository.findById('task-1')

      expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      })
      expect(result).toEqual(task)
    })

    it('should return null when task not found', async () => {
      mockTypeormRepository.findOne.mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findPendingTasks', () => {
    it('should find all pending tasks without tenant filter', async () => {
      const tasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          peerName: '杭州银行',
          tenantId: 'tenant-1',
          status: 'pending',
          sourceType: 'website',
          targetUrl: 'https://example1.com',
        },
        {
          id: 'task-2',
          sourceId: 'source-2',
          peerName: '宁波银行',
          tenantId: 'tenant-2',
          status: 'pending',
          sourceType: 'wechat',
          targetUrl: 'https://example2.com',
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.findPendingTasks()

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      })
      expect(result).toEqual(tasks)
    })

    it('should find pending tasks filtered by tenantId', async () => {
      const tasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          peerName: '杭州银行',
          tenantId: 'tenant-1',
          status: 'pending',
          sourceType: 'website',
          targetUrl: 'https://example1.com',
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.findPendingTasks('tenant-1')

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending', tenantId: 'tenant-1' },
        order: { createdAt: 'ASC' },
      })
      expect(result).toEqual(tasks)
    })

    it('should return empty array when no pending tasks', async () => {
      mockTypeormRepository.find.mockResolvedValue([])

      const result = await repository.findPendingTasks()

      expect(result).toEqual([])
    })
  })

  describe('findTasksBySourceId', () => {
    it('should find tasks by sourceId', async () => {
      const tasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          peerName: '杭州银行',
          tenantId: 'tenant-1',
          status: 'completed',
          sourceType: 'website',
          targetUrl: 'https://example.com',
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.findTasksBySourceId('source-1')

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        where: { sourceId: 'source-1' },
      })
      expect(result).toEqual(tasks)
    })

    it('should find tasks with additional options', async () => {
      const tasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          status: 'pending',
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const options: FindManyOptions<PeerCrawlerTask> = {
        where: { status: 'pending' },
        take: 10,
      }

      const result = await repository.findTasksBySourceId('source-1', options)

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        ...options,
        where: {
          status: 'pending',
          sourceId: 'source-1',
        },
      })
      expect(result).toEqual(tasks)
    })
  })

  describe('updateTaskStatus', () => {
    it('should update status to running and set startedAt', async () => {
      const updatedTask = {
        id: 'task-1',
        status: 'running',
        startedAt: new Date(),
      }

      mockTypeormRepository.update.mockResolvedValue({ affected: 1 })
      mockTypeormRepository.findOne.mockResolvedValue(updatedTask)

      const result = await repository.updateTaskStatus('task-1', 'running')

      expect(mockTypeormRepository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'running',
          startedAt: expect.any(Date),
        }),
      )
      expect(result).toEqual(updatedTask)
    })

    it('should update status to completed with result', async () => {
      const crawlResult = {
        title: 'Test Title',
        content: 'Test content',
        url: 'https://example.com',
      }

      const updatedTask = {
        id: 'task-1',
        status: 'completed',
        crawlResult,
        rawContentId: 'raw-1',
        completedAt: new Date(),
      }

      mockTypeormRepository.update.mockResolvedValue({ affected: 1 })
      mockTypeormRepository.findOne.mockResolvedValue(updatedTask)

      const result = await repository.updateTaskStatus('task-1', 'completed', {
        crawlResult,
        rawContentId: 'raw-1',
      })

      expect(mockTypeormRepository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'completed',
          crawlResult,
          rawContentId: 'raw-1',
          completedAt: expect.any(Date),
        }),
      )
      expect(result).toEqual(updatedTask)
    })

    it('should update status to failed with error message', async () => {
      const updatedTask = {
        id: 'task-1',
        status: 'failed',
        errorMessage: 'Network error',
        retryCount: 1,
        completedAt: new Date(),
      }

      mockTypeormRepository.update.mockResolvedValue({ affected: 1 })
      mockTypeormRepository.findOne.mockResolvedValue(updatedTask)

      const result = await repository.updateTaskStatus('task-1', 'failed', {
        errorMessage: 'Network error',
        retryCount: 1,
      })

      expect(mockTypeormRepository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Network error',
          retryCount: 1,
          completedAt: expect.any(Date),
        }),
      )
      expect(result).toEqual(updatedTask)
    })

    it('should update status to pending without timestamps', async () => {
      const updatedTask = {
        id: 'task-1',
        status: 'pending',
      }

      mockTypeormRepository.update.mockResolvedValue({ affected: 1 })
      mockTypeormRepository.findOne.mockResolvedValue(updatedTask)

      const result = await repository.updateTaskStatus('task-1', 'pending')

      expect(mockTypeormRepository.update).toHaveBeenCalledWith('task-1', {
        status: 'pending',
      })
      expect(result).toEqual(updatedTask)
    })

    it('should handle undefined result fields', async () => {
      const updatedTask = {
        id: 'task-1',
        status: 'completed',
        crawlResult: null,
        completedAt: new Date(),
      }

      mockTypeormRepository.update.mockResolvedValue({ affected: 1 })
      mockTypeormRepository.findOne.mockResolvedValue(updatedTask)

      await repository.updateTaskStatus('task-1', 'completed', {
        crawlResult: undefined,
        rawContentId: undefined,
        errorMessage: undefined,
        retryCount: undefined,
      })

      expect(mockTypeormRepository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      )
    })
  })

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      mockTypeormRepository.increment.mockResolvedValue({ affected: 1 })

      await repository.incrementRetryCount('task-1')

      expect(mockTypeormRepository.increment).toHaveBeenCalledWith(
        { id: 'task-1' },
        'retryCount',
        1,
      )
    })
  })

  describe('findRecentFailedTasks', () => {
    it('should find recent failed tasks with default limit', async () => {
      const tasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          status: 'failed',
          createdAt: new Date(),
        },
        {
          id: 'task-2',
          sourceId: 'source-1',
          status: 'failed',
          createdAt: new Date(Date.now() - 86400000),
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.findRecentFailedTasks('source-1')

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        where: { sourceId: 'source-1', status: 'failed' },
        order: { createdAt: 'DESC' },
        take: 3,
      })
      expect(result).toEqual(tasks)
    })

    it('should find recent failed tasks with custom limit', async () => {
      const tasks = [{ id: 'task-1', sourceId: 'source-1', status: 'failed' }]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.findRecentFailedTasks('source-1', 5)

      expect(mockTypeormRepository.find).toHaveBeenCalledWith({
        where: { sourceId: 'source-1', status: 'failed' },
        order: { createdAt: 'DESC' },
        take: 5,
      })
      expect(result).toEqual(tasks)
    })
  })

  describe('countTasks', () => {
    it('should count all tasks for tenant', async () => {
      mockTypeormRepository.count.mockResolvedValue(10)

      const result = await repository.countTasks('tenant-1')

      expect(mockTypeormRepository.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      })
      expect(result).toBe(10)
    })

    it('should count tasks with status filter', async () => {
      mockTypeormRepository.count.mockResolvedValue(5)

      const result = await repository.countTasks('tenant-1', { status: 'pending' })

      expect(mockTypeormRepository.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'pending' },
      })
      expect(result).toBe(5)
    })

    it('should count tasks with sourceId filter', async () => {
      mockTypeormRepository.count.mockResolvedValue(3)

      const result = await repository.countTasks('tenant-1', { sourceId: 'source-1' })

      expect(mockTypeormRepository.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', sourceId: 'source-1' },
      })
      expect(result).toBe(3)
    })

    it('should count tasks with both filters', async () => {
      mockTypeormRepository.count.mockResolvedValue(2)

      const result = await repository.countTasks('tenant-1', {
        status: 'completed',
        sourceId: 'source-1',
      })

      expect(mockTypeormRepository.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'completed', sourceId: 'source-1' },
      })
      expect(result).toBe(2)
    })
  })

  describe('getAverageExecutionTime', () => {
    it('should calculate average execution time in seconds', async () => {
      const tasks = [
        {
          id: 'task-1',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: new Date('2026-01-23T10:00:30Z'), // 30 seconds
        },
        {
          id: 'task-2',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: new Date('2026-01-23T10:01:00Z'), // 60 seconds
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.getAverageExecutionTime('source-1')

      // Average: (30 + 60) / 2 = 45 seconds
      expect(result).toBe(45)
    })

    it('should return 0 when no completed tasks', async () => {
      mockTypeormRepository.find.mockResolvedValue([])

      const result = await repository.getAverageExecutionTime('source-1')

      expect(result).toBe(0)
    })

    it('should handle tasks with missing timestamps', async () => {
      const tasks = [
        {
          id: 'task-1',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: new Date('2026-01-23T10:00:30Z'), // 30 seconds
        },
        {
          id: 'task-2',
          startedAt: null,
          completedAt: new Date('2026-01-23T10:01:00Z'),
        },
        {
          id: 'task-3',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: null,
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.getAverageExecutionTime('source-1')

      // Only task-1 contributes to average: 30 seconds
      expect(result).toBe(30)
    })

    it('should round to nearest second', async () => {
      const tasks = [
        {
          id: 'task-1',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: new Date('2026-01-23T10:00:30.4Z'), // 30.4 seconds
        },
        {
          id: 'task-2',
          startedAt: new Date('2026-01-23T10:00:00Z'),
          completedAt: new Date('2026-01-23T10:00:30.6Z'), // 30.6 seconds
        },
      ]

      mockTypeormRepository.find.mockResolvedValue(tasks)

      const result = await repository.getAverageExecutionTime('source-1')

      // Average: (30.4 + 30.6) / 2 = 30.5 -> rounded to 31
      expect(result).toBe(31)
    })
  })
})
