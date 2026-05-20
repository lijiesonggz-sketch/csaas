import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { QUICK_CONSULT_PROBLEM_MAX_LENGTH, StartQuickConsultDto } from './start-quick-consult.dto'
import { THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE } from '../quick-consult.service'

describe('StartQuickConsultDto', () => {
  it('uses the stable Quick Consult message for over-limit problem validation', () => {
    const dto = plainToInstance(StartQuickConsultDto, {
      problem: 'x'.repeat(QUICK_CONSULT_PROBLEM_MAX_LENGTH + 1),
    })

    const errors = validateSync(dto)

    expect(errors[0]?.constraints).toEqual(
      expect.objectContaining({
        maxLength: THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
      }),
    )
  })
})
