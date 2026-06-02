import { render, waitFor } from '@testing-library/react'
import { Dialog, DialogContent, DialogTitle } from './dialog'

describe('Dialog overlay wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.body.removeAttribute('style')
    document.body.removeAttribute('data-scroll-locked')
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-scroll-locked')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('marks the managed overlay so global cleanup can identify stale nodes', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>测试弹窗</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await waitFor(() => {
      expect(document.querySelector('[data-radix-overlay="true"]')).toBeInTheDocument()
    })
  })

  it('does not install a document-level wheel blocker when the dialog opens', async () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener')

    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>测试弹窗</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeInTheDocument()
    })

    expect(addEventListenerSpy.mock.calls.some(([eventName]) => eventName === 'wheel')).toBe(false)
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    expect(document.documentElement).not.toHaveAttribute('data-scroll-locked')
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })
})
