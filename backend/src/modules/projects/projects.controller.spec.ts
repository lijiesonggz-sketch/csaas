import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { ProjectsController } from './controllers/projects.controller'

describe('ProjectsController update routes', () => {
  const createController = () => {
    const projectsService = {
      update: jest.fn(),
    }

    const controller = new ProjectsController(projectsService as any, {} as any, {} as any)

    return { controller, projectsService }
  }

  it('keeps PATCH /projects/:projectId as the canonical update route', async () => {
    const { controller, projectsService } = createController()
    const dto = { metadata: { clusteringTaskId: 'task-1' } }
    const project = { id: 'project-1', metadata: dto.metadata }

    projectsService.update.mockResolvedValue(project)

    await expect(
      controller.update('project-1', dto, { user: { id: 'user-1' }, headers: {} }),
    ).resolves.toEqual({
      success: true,
      data: project,
    })

    expect(Reflect.getMetadata(PATH_METADATA, controller.update)).toBe(':projectId')
    expect(Reflect.getMetadata(METHOD_METADATA, controller.update)).toBe(RequestMethod.PATCH)
    expect(projectsService.update).toHaveBeenCalledWith('project-1', 'user-1', dto)
  })

  it('accepts PUT /projects/:projectId for stale frontend bundles and reuses update logic', async () => {
    const { controller, projectsService } = createController()
    const dto = { metadata: { clusteringTaskId: 'task-1' } }
    const project = { id: 'project-1', metadata: dto.metadata }

    projectsService.update.mockResolvedValue(project)

    await expect(
      controller.updatePutCompatibility('project-1', dto, {
        user: { id: 'user-1' },
        headers: {},
      }),
    ).resolves.toEqual({
      success: true,
      data: project,
    })

    expect(Reflect.getMetadata(PATH_METADATA, controller.updatePutCompatibility)).toBe(':projectId')
    expect(Reflect.getMetadata(METHOD_METADATA, controller.updatePutCompatibility)).toBe(
      RequestMethod.PUT,
    )
    expect(projectsService.update).toHaveBeenCalledWith('project-1', 'user-1', dto)
  })
})
