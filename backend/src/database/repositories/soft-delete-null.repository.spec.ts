import { IsNull, Repository } from 'typeorm'
import { Organization } from '../entities/organization.entity'
import { Project } from '../entities/project.entity'
import { WatchedPeer } from '../entities/watched-peer.entity'
import { WatchedTopic } from '../entities/watched-topic.entity'
import { OrganizationRepository } from './organization.repository'
import { ProjectRepository } from './project.repository'
import { WatchedPeerRepository } from './watched-peer.repository'
import { WatchedTopicRepository } from './watched-topic.repository'

const tenantId = 'tenant-123'

function createRepositoryMock<T>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<Repository<T>>
}

describe('soft-delete repository null predicates', () => {
  it('uses IsNull for active organizations so TypeORM null guards can throw safely', async () => {
    const typeormRepository = createRepositoryMock<Organization>()
    const repository = new OrganizationRepository(typeormRepository)

    await repository.findActive(tenantId)

    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull(), tenantId },
      order: { createdAt: 'DESC' },
    })
  })

  it('uses IsNull for active projects so TypeORM null guards can throw safely', async () => {
    const typeormRepository = createRepositoryMock<Project>()
    const repository = new ProjectRepository(typeormRepository)

    await repository.findActive(tenantId)

    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull(), tenantId },
      order: { createdAt: 'DESC' },
    })
  })

  it('uses IsNull for active watched topics so TypeORM null guards can throw safely', async () => {
    const typeormRepository = createRepositoryMock<WatchedTopic>()
    const repository = new WatchedTopicRepository(typeormRepository)

    await repository.findActive(tenantId)

    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull(), tenantId },
      order: { createdAt: 'DESC' },
    })
  })

  it('uses IsNull for active watched peers so TypeORM null guards can throw safely', async () => {
    const typeormRepository = createRepositoryMock<WatchedPeer>()
    const repository = new WatchedPeerRepository(typeormRepository)

    await repository.findActive(tenantId)

    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull(), tenantId },
      order: { createdAt: 'DESC' },
    })
  })
})
