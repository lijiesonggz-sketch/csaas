'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { message } from '@/lib/message'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

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

      const result = await uploadPromise as { success: boolean; data?: any; message?: string }

      if (result.success) {
        message.success(
          `文件 "${file.name}" 上传成功！共 ${result.data?.charCount || 0} 字符`
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
    <main className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">上传文档</h1>
              <p className="text-sm text-white/80">
                上传项目相关文档，支持 PDF、Word、Excel 等格式
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>

      {/* 上传区域 */}
      <Card className="mb-6 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(99,102,241,0.2),0_4px_6px_-2px_rgba(99,102,241,0.05)] transition-all duration-200">
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploading}
              accept=".pdf,.txt,.md,.docx"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Button
                disabled={uploading}
                className="mb-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                asChild
              >
                <span>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  {uploading ? '上传中...' : '选择文件或拖拽到此处'}
                </span>
              </Button>
            </label>

            <p className="text-sm text-slate-500 mt-2">
              支持 PDF、TXT、MD、DOCX 格式，最大 10MB
            </p>

            {uploading && currentFile && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center mb-2">
                  <FileText className="w-4 h-4 text-indigo-500 mr-2" />
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {currentFile.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatFileSize(currentFile.size)}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-slate-500 mt-1">{progress}%</p>
              </div>
            )}
          </div>

          <Alert className="mt-4">
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>
              上传的文档将用于AI分析和文档处理。建议上传完整的IT标准文档（如ISO 27001、COBIT等），文档长度建议在1000-10000字之间。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 已上传文档列表 */}
      {uploadedDocs.length > 0 && (
        <Card className="shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(99,102,241,0.2),0_4px_6px_-2px_rgba(99,102,241,0.05)] transition-all duration-200">
          <CardHeader>
            <CardTitle>已上传文档 ({uploadedDocs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-white"
                >
                  <FileText className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      文档名: {doc.name} · {formatFileSize(doc.size)} ·{' '}
                      {doc.charCount} 字符 · 上传于 {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      上传成功
                    </Badge>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
