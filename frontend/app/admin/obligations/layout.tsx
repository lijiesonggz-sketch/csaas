import { Suspense } from 'react'

export default function ObligationsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
