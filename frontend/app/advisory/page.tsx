'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import AdvisoryWorkspaceShell from '@/components/advisory/AdvisoryWorkspaceShell'
import {
  THINKTANK_ACCESS_DENIED_MESSAGE,
  ThinkTankAccessResult,
  fetchThinkTankAccess,
} from '@/lib/advisory/access'

type AccessState =
  | { status: 'loading' }
  | { status: 'authorized'; access: ThinkTankAccessResult }
  | { status: 'denied'; message: string }

export default function AdvisoryPage() {
  const [accessState, setAccessState] = useState<AccessState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    fetchThinkTankAccess()
      .then((access) => {
        if (!active) return
        if (access.allowed) {
          setAccessState({ status: 'authorized', access })
          return
        }
        setAccessState({
          status: 'denied',
          message: access.message ?? THINKTANK_ACCESS_DENIED_MESSAGE,
        })
      })
      .catch(() => {
        if (!active) return
        setAccessState({
          status: 'denied',
          message: '暂时无法验证 ThinkTank 访问权限，请稍后重试。',
        })
      })

    return () => {
      active = false
    }
  }, [])

  if (accessState.status === 'loading') {
    return (
      <section className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[hsl(var(--advisory-shell-bg))] px-6">
        <div
          role="status"
          aria-live="polite"
          aria-label="ThinkTank 访问验证状态"
          className="flex items-center gap-3 text-sm font-medium text-[hsl(var(--advisory-foreground))]"
        >
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--advisory-accent))]" />
          <span>正在验证 ThinkTank 访问权限</span>
        </div>
      </section>
    )
  }

  if (accessState.status === 'denied') {
    return (
      <section className="bg-[hsl(var(--advisory-shell-bg))] px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <Card
            variant="outlined"
            className="border-[hsl(var(--advisory-warning-border))] bg-[hsl(var(--advisory-panel))]"
          >
            <CardContent className="p-6">
              <div role="alert" aria-live="assertive" className="flex items-start gap-4">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--advisory-warning-foreground))]" />
                <div>
                  <h1 className="text-xl font-semibold text-[hsl(var(--advisory-foreground))]">
                    ThinkTank
                  </h1>
                  <p className="mt-2 text-sm text-[hsl(var(--advisory-muted-foreground))]">
                    {accessState.message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return <AdvisoryWorkspaceShell />
}
