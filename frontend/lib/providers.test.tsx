import type { ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { Providers } from './providers'

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
}))

jest.mock('@/components/layout/BrandProvider', () => ({
  BrandProvider: ({ children }: { children: ReactNode }) => children,
}))

describe('Providers dialog cleanup', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.body.removeAttribute('style')
  })

  it('clears stale pointer-events and removes orphaned radix overlays when no dialog is open', async () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )

    const overlay = document.createElement('div')
    overlay.setAttribute('data-radix-overlay', 'true')
    overlay.setAttribute('data-state', 'open')
    document.body.appendChild(overlay)
    document.body.style.pointerEvents = 'none'

    await waitFor(() => {
      expect(document.body.style.pointerEvents).toBe('')
      expect(document.querySelector('[data-radix-overlay="true"]')).not.toBeInTheDocument()
    })
  })

  it('preserves active dialog state while a dialog is still open', async () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )

    const overlay = document.createElement('div')
    overlay.setAttribute('data-radix-overlay', 'true')
    overlay.setAttribute('data-state', 'open')

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')

    document.body.appendChild(overlay)
    document.body.appendChild(dialog)
    document.body.style.pointerEvents = 'none'

    await waitFor(() => {
      expect(document.querySelector('[data-radix-overlay="true"]')).toBeInTheDocument()
      expect(document.body.style.pointerEvents).toBe('none')
    })
  })
})
