import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { SubmitAdvisoryMessageDto } from './submit-advisory-message.dto'

describe('SubmitAdvisoryMessageDto', () => {
  it('[P0][5.1-BE-013][AC3] allows the server-owned Party Mode return action through API validation', async () => {
    const dto = plainToInstance(SubmitAdvisoryMessageDto, {
      content: '返回工作流',
      decisionAction: 'return-to-workflow',
    })

    await expect(validate(dto)).resolves.toEqual([])
  })

  it('[P0][5.1-BE-014][AC1,AC2] rejects unknown decision actions before controller handling', async () => {
    const dto = plainToInstance(SubmitAdvisoryMessageDto, {
      content: '伪造动作',
      decisionAction: 'forged-action',
    })

    const errors = await validate(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.property).toBe('decisionAction')
  })
})
