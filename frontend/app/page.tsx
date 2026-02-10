import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <Typography variant="h1" component="h1" sx={{ fontSize: '3rem', fontWeight: 'bold', mb: 2 }}>
          Csaas
        </Typography>
        <Typography variant="h3" component="h2" color="text.secondary" sx={{ mb: 2 }}>
          AI驱动的IT咨询成熟度评估平台
        </Typography>
        <Typography className="mt-4 text-lg">
          三模型协同架构 (GPT-4 + Claude + 国产模型)
        </Typography>
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/login">
            <Button variant="contained" size="large">
              登录
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="outlined" size="large">
              注册
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
