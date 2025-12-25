import { Button, Typography } from 'antd'
import Link from 'next/link'

const { Title, Paragraph } = Typography

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <Title level={1}>Csaas</Title>
        <Title level={3} type="secondary">
          AI驱动的IT咨询成熟度评估平台
        </Title>
        <Paragraph className="mt-4 text-lg">
          三模型协同架构 (GPT-4 + Claude + 国产模型)
        </Paragraph>
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/login">
            <Button type="primary" size="large">
              登录
            </Button>
          </Link>
          <Link href="/register">
            <Button size="large">注册</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
