'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from '@mui/material'
import {
  ArrowBack,
  UploadFile,
  InsertDriveFile,
  CheckCircle,
  Error as ErrorIcon,
  CloudUpload,
  Delete,
  Article,
} from '@mui/icons-material'
import { message } from '@/lib/message'
import { getAuthHeadersAsync, getUserIdFromSessionAsync, getAuthTokenAsync } from '@/lib/utils/jwt'

// 从 jwt.ts 复制 fetchSession 函数
let sessionCache: { token: string | null; userId: string | null; timestamp: number } | null = null
const CACHE_DURATION = 60000 // 1分钟缓存

async function fetchSession(): Promise<{ token: string | null; userId: string | null }> {
  // 检查缓存
  if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
    return { token: sessionCache.token, userId: sessionCache.userId }
  }

  try {
    const res = await fetch('/api/auth/session')
    if (!res.ok) {
      return { token: null, userId: null }
    }

    const session = await res.json()
    const token = session.accessToken || null
    const userId = session.user?.id || null

    // 更新缓存
    sessionCache = { token, userId, timestamp: Date.now() }

    return { token, userId }
  } catch (error) {
    console.error('Failed to fetch session:', error)
    return { token: null, userId: null }
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface UploadedDocument {
  id: string
  name: string
  filename: string
  size: number
  charCount: number
  createdAt: string
}

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // 加载已上传的文档列表
  const loadDocuments = useCallback(async () => {
    try {
      const headers = await getAuthHeadersAsync()
      const response = await fetch(
        `${API_BASE_URL}/files/projects/${projectId}/documents/list`,
        {
          method: 'POST',
          headers,
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setUploadedDocs(result.data)
        }
      }
    } catch (error) {
      console.error('加载文档列表失败:', error)
    }
  }, [projectId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleUpload = async (file: File) => {
    if (!file) return

    // 验证文件类型
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      message.error('只支持 PDF、TXT、MD、DOCX 文件')
      return
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      return
    }

    setCurrentFile(file)
    setUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { token, userId } = await fetchSession()

      // 使用 XMLHttpRequest 来跟踪上传进度
      const xhr = new XMLHttpRequest()

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            )
            setProgress(percentComplete)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            let errorMsg = '上传失败'
            try {
              const errorRes = JSON.parse(xhr.responseText)
              errorMsg = errorRes.message || errorMsg
            } catch {}
            reject(new Error(errorMsg))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误，请检查连接'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('上传已取消'))
        })

        xhr.open(
          'POST',
          `${API_BASE_URL}/files/projects/${projectId}/documents`
        )

        // 只添加认证头，不设置 Content-Type（浏览器自动设置 multipart/form-data）
        if (userId) {
          xhr.setRequestHeader('x-user-id', userId)
        }
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }

        xhr.send(formData)
      })

      const result = await uploadPromise

      if (result.success) {
        message.success(
          `文件 "${file.name}" 上传成功！共 ${result.data.charCount} 字符`
        )
        setUploadedDocs((prev) => [result.data, ...prev])
        setCurrentFile(null)
      } else {
        throw new Error(result.message || '上传失败')
      }
    } catch (err: any) {
      message.error(err.message || '文件上传失败')
      console.error('上传错误:', err)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleUpload(file)
      }
    },
    [projectId]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 删除文档
  const handleDelete = async (docId: string) => {
    try {
      const headers = await getAuthHeadersAsync()
      const response = await fetch(
        `${API_BASE_URL}/files/projects/${projectId}/documents/${docId}`,
        {
          method: 'DELETE',
          headers,
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('文档删除成功')
          // 从列表中移除
          setUploadedDocs((prev) => prev.filter((doc) => doc.id !== docId))
        } else {
          throw new Error(result.message || '删除失败')
        }
      } else {
        const error = await response.json()
        throw new Error(error.message || '删除失败')
      }
    } catch (err: any) {
      message.error(err.message || '删除文档失败')
      console.error('删除错误:', err)
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
            上传项目相关文档，支持 PDF、Word、Excel 等格式
          </Typography>
        </div>

        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </header>

      {/* 上传区域 */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
              bgcolor: dragOver ? 'primary.50' : 'background.paper',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
              disabled={uploading}
              accept=".pdf,.txt,.md,.docx"
            />
            <label htmlFor="file-upload">
              <Button
                component="span"
                variant="contained"
                size="large"
                startIcon={<CloudUpload />}
                disabled={uploading}
                sx={{ mb: 2 }}
              >
                {uploading ? '上传中...' : '选择文件或拖拽到此处'}
              </Button>
            </label>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              支持 PDF、TXT、MD、DOCX 格式，最大 10MB
            </Typography>

            {uploading && currentFile && (
              <Box sx={{ mt: 3, maxWidth: 400, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <InsertDriveFile color="primary" sx={{ mr: 1 }} />
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {currentFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(currentFile.size)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {progress}%
                </Typography>
              </Box>
            )}
          </Box>

          <Alert severity="info" sx={{ mt: 3 }}>
            <AlertTitle>提示</AlertTitle>
            <Typography variant="body2">
              上传的文档将用于AI分析和文档处理。建议上传完整的IT标准文档（如ISO 27001、COBIT等），文档长度建议在1000-10000字之间。
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* 已上传文档列表 */}
      {uploadedDocs.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              已上传文档 ({uploadedDocs.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {uploadedDocs.map((doc, index) => (
                <ListItem
                  key={doc.id}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    mb: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Article color="primary" />
                    </ListItemIcon>
                    <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {doc.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        文档名: {doc.name} · {formatFileSize(doc.size)} ·{' '}
                        {doc.charCount} 字符 · 上传于{' '}
                        {formatDate(doc.createdAt)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Chip
                        icon={<CheckCircle />}
                        label="上传成功"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                      <IconButton
                        aria-label="delete"
                        onClick={() => handleDelete(doc.id)}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
