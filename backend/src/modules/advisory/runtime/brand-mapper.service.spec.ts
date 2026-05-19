import { ThinkTankBrandMapperService } from './brand-mapper.service'

describe('ThinkTankBrandMapperService', () => {
  it('maps BMAD-origin visible labels to ThinkTank terminology', () => {
    const mapper = new ThinkTankBrandMapperService()

    const mapped = mapper.mapVisibleText(
      'BMAD brainstorming uses a BMad facilitator, BMM analysis, and CIS problem solving.',
    )

    expect(mapped).toContain('ThinkTank brainstorming')
    expect(mapped).toContain('ThinkTank facilitator')
    expect(mapped).toContain('ThinkTank analysis')
    expect(mapped).toContain('ThinkTank problem solving')
    expect(mapped).not.toMatch(/\b(BMAD|BMad|BMM|CIS)\b/)
  })

  it('preserves markdown code spans, fenced code blocks, paths, and diagnostic tokens', () => {
    const mapper = new ThinkTankBrandMapperService()
    const input = [
      'Visible BMAD title should change.',
      'Keep `_bmad/core/skills/bmad-brainstorming/workflow.md` unchanged.',
      'Keep Windows path `D:\\Csaas\\_bmad\\cis\\agents\\brainstorming-coach.md` unchanged.',
      'Keep diagnostic token BMAD_DEBUG=true unchanged.',
      '```bash',
      'cat _bmad/core/skills/bmad-brainstorming/workflow.md',
      'echo BMAD_DEBUG=true',
      '```',
    ].join('\n')

    const mapped = mapper.mapVisibleText(input)

    expect(mapped).toContain('Visible ThinkTank title should change.')
    expect(mapped).toContain('`_bmad/core/skills/bmad-brainstorming/workflow.md`')
    expect(mapped).toContain('`D:\\Csaas\\_bmad\\cis\\agents\\brainstorming-coach.md`')
    expect(mapped).toContain('BMAD_DEBUG=true')
    expect(mapped).toContain('echo BMAD_DEBUG=true')
  })

  it('preserves diagnostic log lines where origin labels are technical evidence', () => {
    const mapper = new ThinkTankBrandMapperService()
    const input = [
      'ERROR BMAD runtime failed to load source',
      '[WARN] BMM catalog row rejected',
      '2026-05-20T04:04:00Z INFO CIS agent source loaded',
      'Visible BMAD label changes.',
    ].join('\n')

    const mapped = mapper.mapVisibleText(input)

    expect(mapped).toContain('ERROR BMAD runtime failed to load source')
    expect(mapped).toContain('[WARN] BMM catalog row rejected')
    expect(mapped).toContain('2026-05-20T04:04:00Z INFO CIS agent source loaded')
    expect(mapped).toContain('Visible ThinkTank label changes.')
  })

  it('preserves multi-backtick code spans and long fenced code blocks', () => {
    const mapper = new ThinkTankBrandMapperService()
    const input = [
      'Visible BMAD label changes, but ``BMAD code span`` does not.',
      '````markdown',
      '```',
      'BMAD inside nested example stays unchanged',
      '```',
      '````',
      'CIS visible label changes after the fence.',
    ].join('\n')

    const mapped = mapper.mapVisibleText(input)

    expect(mapped).toContain('Visible ThinkTank label changes')
    expect(mapped).toContain('``BMAD code span``')
    expect(mapped).toContain('BMAD inside nested example stays unchanged')
    expect(mapped).toContain('ThinkTank visible label changes after the fence.')
  })

  it('does not close fenced code blocks when a fence-like line has trailing text', () => {
    const mapper = new ThinkTankBrandMapperService()
    const input = [
      '````markdown',
      '```not-a-close',
      'BMAD stays code because the outer fence is still open',
      '````',
      'BMAD visible text changes.',
    ].join('\n')

    const mapped = mapper.mapVisibleText(input)

    expect(mapped).toContain('BMAD stays code because the outer fence is still open')
    expect(mapped).toContain('ThinkTank visible text changes.')
  })

  it('does not close fenced code blocks with four-space-indented fence markers', () => {
    const mapper = new ThinkTankBrandMapperService()
    const input = [
      '```',
      '    ```',
      'BMAD stays code because four-space indentation is code content',
      '```',
      'BMAD visible text changes.',
    ].join('\n')

    const mapped = mapper.mapVisibleText(input)

    expect(mapped).toContain('BMAD stays code because four-space indentation is code content')
    expect(mapped).toContain('ThinkTank visible text changes.')
  })

  it('is idempotent across repeated mapping passes', () => {
    const mapper = new ThinkTankBrandMapperService()
    const once = mapper.mapVisibleText('# BMAD Workflow\n\nBMM and CIS advisors guide the session.')

    expect(mapper.mapVisibleText(once)).toBe(once)
  })
})
