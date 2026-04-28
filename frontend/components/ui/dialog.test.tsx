import { render, waitFor } from '@testing-library/react'
import { Dialog, DialogContent, DialogTitle } from './dialog'

describe('Dialog overlay wiring', () => {
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
})
