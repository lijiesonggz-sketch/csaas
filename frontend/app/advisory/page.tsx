'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import AdvisoryWorkspaceShell from '@/components/advisory/AdvisoryWorkspaceShell'
import MainLayout from '@/components/layout/MainLayout'
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
      <MainLayout>
        <section className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#FEFDFB] px-6">
          <div
            role="status"
            className="flex items-center gap-3 text-sm font-medium text-[#1E3A5F]"
          >
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span>正在验证 ThinkTank 访问权限</span>
          </div>
        </section>
      </MainLayout>
    )
  }

  if (accessState.status === 'denied') {
    return (
      <MainLayout>
        <section className="bg-[#FEFDFB] px-6 py-8">
          <div className="mx-auto max-w-5xl">
            <Card variant="outlined" className="border-amber-200 bg-white">
              <CardContent className="p-6">
                <div role="alert" className="flex items-start gap-4">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <h1 className="text-xl font-semibold text-[#1E3A5F]">ThinkTank</h1>
                    <p className="mt-2 text-sm text-[#475569]">{accessState.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <AdvisoryWorkspaceShell />
    </MainLayout>
  )
}
