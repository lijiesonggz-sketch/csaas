import MainLayout from '@/components/layout/MainLayout'

export default function KnowledgeGraphLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
