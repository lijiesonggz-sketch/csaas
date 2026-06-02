import type { ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { signOut } from 'next-auth/react'
import { AUTH_SESSION_EXPIRED_EVENT } from '@/lib/auth/session-expiry'
import { Providers } from './providers'

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  signOut: jest.fn(),
}))

jest.mock('@/components/layout/BrandProvider', () => ({
  BrandProvider: ({ children }: { children: ReactNode }) => children,
}))

describe('Providers dialog cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ''
    document.body.removeAttribute('style')
    document.body.removeAttribute('data-scroll-locked')
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-scroll-locked')
  })

  it('clears stale pointer-events and disables orphaned radix overlays when no dialog is open', async () => {
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
      expect(document.querySelector('[data-radix-overlay="true"]')).toBeInTheDocument()
      expect(overlay.style.pointerEvents).toBe('none')
      expect(overlay.style.display).toBe('none')
      expect(overlay).toHaveAttribute('data-csaas-orphaned-overlay', 'true')
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
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.setAttribute('data-scroll-locked', '1')

    await waitFor(() => {
      expect(document.querySelector('[data-radix-overlay="true"]')).toBeInTheDocument()
      expect(document.body.style.pointerEvents).toBe('none')
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.documentElement.style.overflow).toBe('hidden')
      expect(document.body).toHaveAttribute('data-scroll-locked', '1')
    })
  })

  it('clears stale scroll lock when no dialog remains open', async () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '17px'
    document.body.style.setProperty('--removed-body-scroll-bar-size', '17px')
    document.body.setAttribute('data-scroll-locked', '1')
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.setAttribute('data-scroll-locked', '1')

    const marker = document.createElement('div')
    document.body.appendChild(marker)

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('')
      expect(document.body.style.paddingRight).toBe('')
      expect(document.body.style.getPropertyValue('--removed-body-scroll-bar-size')).toBe('')
      expect(document.body).not.toHaveAttribute('data-scroll-locked')
      expect(document.documentElement.style.overflow).toBe('')
      expect(document.documentElement).not.toHaveAttribute('data-scroll-locked')
    })
  })

  it('signs out to login when a protected API reports an expired session', async () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )

    window.dispatchEvent(
      new CustomEvent(AUTH_SESSION_EXPIRED_EVENT, {
        detail: { callbackUrl: '/projects' },
      })
    )

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({
        callbackUrl: '/login?callbackUrl=%2Fprojects',
      })
    })
  })
})
