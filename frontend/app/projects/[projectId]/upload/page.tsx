'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, UploadCloud, FileText, CheckCircle, Trash2 } from 'lucide-react'
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
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const projectId = params?.projectId ?? ''

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // 加载已上传的文档列表
  const loadDocuments = useCallback(async () => {
    try {
      const headers = await getAuthHeadersAsync()
      const response = await fetch(`${API_BASE_URL}/files/projects/${projectId}/documents/list`, {
        method: 'POST',
        headers,
      })

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
            const percentComplete = Math.round((event.loaded / event.total) * 100)
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

        xhr.open('POST', `${API_BASE_URL}/files/projects/${projectId}/documents`)

        // 只添加认证头，不设置 Content-Type（浏览器自动设置 multipart/form-data）
        if (userId) {
          xhr.setRequestHeader('x-user-id', userId)
        }
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }

        xhr.send(formData)
      })

      const result = (await uploadPromise) as { success: boolean; data?: any; message?: string }

      if (result.success) {
        message.success(`文件 "${file.name}" 上传成功！共 ${result.data?.charCount || 0} 字符`)
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
      {/* 页面头部 */}
      <div className="bg-[#1E3A5F] rounded-sm p-8 mb-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-sm">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">上传文档</h1>
              <p className="text-sm text-white/80 font-[var(--font-inter)]">
                上传项目相关文档，支持 PDF、TXT、MD、DOCX 格式
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>

      {/* 上传区域 */}
      <Card className="mb-6 border border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-sm p-12 text-center transition-all duration-200 ${
              dragOver ? 'border-[#1E3A5F] bg-slate-50' : 'border-[#E2E8F0] bg-white'
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
                className="mb-4 bg-[#1E3A5F] hover:bg-[#152a47] rounded-sm"
                asChild
              >
                <span>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  {uploading ? '上传中...' : '选择文件或拖拽到此处'}
                </span>
              </Button>
            </label>

            <p className="text-sm text-[#94A3B8] mt-2">支持 PDF、TXT、MD、DOCX 格式，最大 10MB</p>

            {uploading && currentFile && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center mb-2">
                  <FileText className="w-4 h-4 text-[#1E3A5F] mr-2" />
                  <span className="text-sm text-[#1E3A5F] flex-1 truncate">{currentFile.name}</span>
                  <span className="text-xs text-[#94A3B8]">{formatFileSize(currentFile.size)}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-[#94A3B8] mt-1">{progress}%</p>
              </div>
            )}
          </div>

          <Alert className="mt-4">
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>
              上传的文档将用于AI分析和文档处理。建议上传完整的IT标准文档（如ISO
              27001、COBIT等），文档长度建议在1000-10000字之间。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 已上传文档列表 */}
      {uploadedDocs.length > 0 && (
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1E3A5F]">已上传文档 ({uploadedDocs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 p-4 rounded-sm border border-[#E2E8F0] bg-white"
                >
                  <FileText className="w-5 h-5 text-[#1E3A5F] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1E3A5F] truncate">{doc.filename}</p>
                    <p className="text-xs text-[#94A3B8]">
                      文档名: {doc.name} · {formatFileSize(doc.size)} · {doc.charCount} 字符 ·
                      上传于 {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[#059669] border-[#059669] bg-green-50 rounded-sm"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      上传成功
                    </Badge>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
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
