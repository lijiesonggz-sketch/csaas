import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnterpriseBackgroundDialog } from './EnterpriseBackgroundDialog'

describe('EnterpriseBackgroundDialog', () => {
  it('renders first-use fields and requires organization name before save', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()

    render(
      <EnterpriseBackgroundDialog
        open
        mode="first-use"
        onOpenChange={jest.fn()}
        onSave={onSave}
        onSkip={jest.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: /企业背景/ })
    expect(within(dialog).getByLabelText('企业名称')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('行业')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('规模')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('企业名称必填')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects organization names that contain only invisible or control characters', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()

    render(
      <EnterpriseBackgroundDialog
        open
        mode="first-use"
        onOpenChange={jest.fn()}
        onSave={onSave}
        onSkip={jest.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: /企业背景/ })
    fireEvent.change(within(dialog).getByLabelText('企业名称'), {
      target: { value: '\u200b\u200c' },
    })

    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('企业名称必填')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('trims saved fields and allows optional fields to be skipped', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn().mockResolvedValue(undefined)

    render(
      <EnterpriseBackgroundDialog
        open
        mode="first-use"
        onOpenChange={jest.fn()}
        onSave={onSave}
        onSkip={jest.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: /企业背景/ })
    fireEvent.change(within(dialog).getByLabelText('企业名称'), {
      target: { value: '  华数\n安全\u200b集团  ' },
    })
    fireEvent.change(within(dialog).getByLabelText('行业'), {
      target: { value: '  数据\n安全合规  ' },
    })
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: undefined,
      })
    )
  })

  it('shows field-linked errors for over-limit optional fields before save', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()

    render(
      <EnterpriseBackgroundDialog
        open
        mode="first-use"
        onOpenChange={jest.fn()}
        onSave={onSave}
        onSkip={jest.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: /企业背景/ })
    fireEvent.change(within(dialog).getByLabelText('企业名称'), {
      target: { value: '华数安全集团' },
    })
    fireEvent.change(within(dialog).getByLabelText('行业'), {
      target: { value: '行'.repeat(201) },
    })

    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    const industry = within(dialog).getByLabelText('行业')
    expect(industry).toHaveAttribute('aria-invalid', 'true')
    expect(industry).toHaveAccessibleDescription('行业不能超过 200 个字符。')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('行业不能超过 200 个字符。')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('skips without calling save on first-use mode and pre-fills settings mode', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()
    const onSkip = jest.fn()

    const { rerender } = render(
      <EnterpriseBackgroundDialog
        open
        mode="first-use"
        onOpenChange={jest.fn()}
        onSave={onSave}
        onSkip={onSkip}
      />
    )

    await user.click(screen.getByRole('button', { name: '跳过' }))
    expect(onSkip).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()

    rerender(
      <EnterpriseBackgroundDialog
        open
        mode="settings"
        initialContext={{
          id: 'context-1',
          organizationName: '华数安全集团',
          industry: '数据安全合规',
          size: '201-500人',
          completenessScore: 100,
          completeness: {
            requiredFieldsComplete: true,
            missingFields: [],
            updatedAt: '2026-05-20T15:33:04.000Z',
          },
          appliedToPrompts: false,
        }}
        onOpenChange={jest.fn()}
        onSave={onSave}
      />
    )

    const settingsDialog = screen.getByRole('dialog', { name: /企业背景设置/ })
    expect(within(settingsDialog).getByLabelText('企业名称')).toHaveValue('华数安全集团')
    expect(within(settingsDialog).getByLabelText('行业')).toHaveValue('数据安全合规')
    expect(within(settingsDialog).getByLabelText('规模')).toHaveValue('201-500人')
    expect(within(settingsDialog).queryByRole('button', { name: '跳过' })).not.toBeInTheDocument()
  })
})
