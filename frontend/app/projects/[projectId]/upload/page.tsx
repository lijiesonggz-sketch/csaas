'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material'
import {
  ArrowBack,
  UploadFile,
} from '@mui/icons-material'
import { message } from '@/lib/message'

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setProgress(0)

      // Simulate upload progress
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // TODO: Implement actual file upload
      await new Promise((resolve) => setTimeout(resolve, 2000))

      clearInterval(interval)
      setProgress(100)
      message.success('文件上传成功！')

      setTimeout(() => {
        router.push(`/projects/${projectId}`)
      }, 1000)
    } catch (err: any) {
      message.error(err.message || '文件上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            上传文档
          </Typography>
          <Typography variant="body2" color="text.secondary">
            上传项目相关文档
          </Typography>
        </div>

        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </header>

      <Card>
        <CardContent>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
            }}
          >
            <input
              type="file"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="file-upload"
              disabled={uploading}
            />
            <label htmlFor="file-upload">
              <Button
                component="span"
                variant="contained"
                startIcon={<UploadFile />}
                disabled={uploading}
              >
                {uploading ? '上传中...' : '选择文件'}
              </Button>
            </label>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              支持 PDF、Word、Excel 等格式
            </Typography>

            {uploading && (
              <Box sx={{ mt: 3 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="caption" sx={{ mt: 1 }}>
                  {progress}%
                </Typography>
              </Box>
            )}
          </Box>

          <Alert severity="info" sx={{ mt: 3 }}>
            <AlertTitle>提示</AlertTitle>
            <Typography variant="body2">
              上传的文档将用于AI分析和文档处理
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </main>
  )
}
