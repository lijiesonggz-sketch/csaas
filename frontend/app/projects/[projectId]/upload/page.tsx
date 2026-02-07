'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Button, message, Upload } from 'antd'
import { SaveOutlined, CheckCircleOutlined, LoadingOutlined, UploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import { parseFile, SUPPORTED_FILE_EXTENSIONS, detectTextQuality } from '@/lib/utils/fileParser'
import { ProjectsAPI } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import { v4 as uuidv4 } from 'uuid'

interface StandardDocument {
  id: string
  name:  string
  content: string
}

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [documents, setDocuments] = useState<StandardDocument[]>([])
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // 加载已保存的文档
  useEffect(() => {
    loadSavedDocuments()
  }, [projectId])

  const loadSavedDocuments = async () => {
    try {
      setLoading(true)
      const project = await apiFetch(`/projects/${projectId}`)

      if (project.metadata?.uploadedDocuments && Array.isArray(project.metadata.uploadedDocuments)) {
        setDocuments(project.metadata.uploadedDocuments)
        setFileList(project.metadata.uploadedDocuments.map((doc: any) => ({
          uid: doc.id,
          name: doc.name,
          status: 'done' as const,
        })))
        setSaved(true)
      }
    } catch (err: any) {
      console.error('Failed to load saved documents:', err)
    } finally {
      setLoading(false)
    }
  }

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    try {
      // 使用通用文件解析器（支持TXT, MD, PDF, DOCX, DOC）
      const content = await parseFile(file)

      // 检测内容质量
      const qualityCheck = detectTextQuality(content)

      if (!qualityCheck.isValid) {
        message.error(`文件 ${file.name} ${qualityCheck.issue}！\n建议：${qualityCheck.suggestion}`)
        return false
      }

      if (content.length < 100) {
        message.error(`文件 ${file.name} 内容太短，至少需要100字符`)
        return false
      }

      const newDoc: StandardDocument = {
        id: `doc_${uuidv4()}`,
        name: file.name.replace(/\.(txt|md|pdf|docx|doc)$/i, ''),
        content,
      }

      setDocuments((prev) => [...prev, newDoc])
      setSaved(false) // 新增文档后重置保存状态
      message.success(`文件 ${file.name} 已加载（${content.length} 字符）`)
      return false // 阻止自动上传
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      message.error(`读取文件 ${file.name} 失败: ${errorMsg}`)
      return false
    }
  }

  // 删除文档
  const handleRemoveDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
    setFileList((prev) => prev.filter((file) => file.uid !== docId))
    setSaved(false)
  }

  // 保存文档到项目
  const handleSaveDocuments = async () => {
    if (documents.length === 0) {
      message.error('请至少上传一个文档')
      return
    }

    setIsSaving(true)
    try {
      // 将文档列表保存到项目的 metadata 字段（JSON格式）
      await apiFetch(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          metadata: {
            uploadedDocuments: documents
          }
        })
      })

      setSaved(true)
      message.success(`成功保存 ${documents.length} 个文档到项目！`)
    } catch (error: any) {
      message.error(`保存失败：${error.message || '未知错误'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // 继续到综述生成
  const handleContinueToSummary = () => {
    if (!saved) {
      message.warning('请先保存文档')
      return
    }
    router.push(`/projects/${projectId}/summary`)
  }

  // 继续到聚类生成
  const handleContinueToClustering = () => {
    if (!saved) {
      message.warning('请先保存文档')
      return
    }
    if (documents.length < 2) {
      message.warning('聚类分析至少需要2个文档，请上传更多文档')
      return
    }
    router.push(`/projects/${projectId}/clustering`)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          上传标准文档
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          上传您的合规文档（如ISO 27001、等保2.0等），系统将基于此文档生成综述和聚类分析
        </p>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="mb-6 p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-blue-700 dark:text-blue-300">正在加载已保存的文档...</p>
        </div>
      )}

      {/* 文档上传区域 */}
      <Card
        title="文档上传"
        className="mb-6"
        extra={
          saved && (
            <span className="text-green-600 flex items-center gap-2">
              <CheckCircleOutlined />
              已保存 {documents.length} 个文档
            </span>
          )
        }
      >
        {/* 上传按钮 */}
        <div className="mb-4">
          <Upload
            beforeUpload={handleFileUpload}
            fileList={fileList}
            onRemove={(file) => handleRemoveDocument(file.uid)}
            accept={SUPPORTED_FILE_EXTENSIONS}
            multiple
          >
            <Button icon={<UploadOutlined />} disabled={isSaving}>
              选择文件
            </Button>
          </Upload>
          <p className="text-sm text-gray-500 mt-2">
            支持 .txt、.md、.pdf、.docx、.doc 文件，每个文件至少100字符。
          </p>
        </div>

        {/* 已上传文档列表 */}
        {documents.length > 0 && (
          <div className="space-y-2 mb-6">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              已上传文档 ({documents.length})
            </h3>
            {documents.map((doc) => (
              <Card key={doc.id} size="small" className="bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <FileTextOutlined className="text-blue-500" />
                      {doc.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {doc.id.substring(0, 8)}... | 长度: {doc.content.length.toLocaleString()} 字符
                    </p>
                  </div>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveDocument(doc.id)}
                    disabled={isSaving}
                  >
                    删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {documents.length > 0 && (
              <span>
                已上传 <strong>{documents.length}</strong> 个文档
                {documents.length >= 2 && (
                  <span className="ml-2 text-green-600">
                    ✅ 可以进行聚类分析
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              size="large"
              onClick={handleSaveDocuments}
              disabled={documents.length === 0 || isSaving}
              loading={isSaving}
              type={saved ? "default" : "primary"}
              icon={isSaving ? <LoadingOutlined /> : saved ? <CheckCircleOutlined /> : <SaveOutlined />}
            >
              {saved ? '已保存' : '保存文档'}
            </Button>

            {saved && documents.length >= 1 && (
              <Button
                size="large"
                onClick={handleContinueToSummary}
              >
                生成综述
              </Button>
            )}

            {saved && documents.length >= 2 && (
              <Button
                type="primary"
                size="large"
                onClick={handleContinueToClustering}
              >
                生成聚类 →
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 使用说明 */}
      <Card title="使用说明" size="small">
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>步骤 1:</strong> 上传一个或多个标准文档（支持多文件上传）</p>
          <p><strong>步骤 2:</strong> 点击"保存文档"按钮将文档保存到项目中</p>
          <p><strong>步骤 3:</strong>
            {documents.length >= 2 ? (
              <span className="text-green-600 font-medium">可以生成综述或进行聚类分析</span>
            ) : (
              <span>至少需要2个文档才能进行聚类分析</span>
            )}
          </p>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
            <p className="font-medium text-blue-800 dark:text-blue-300 mb-2">
              💡 支持的标准文档类型：
            </p>
            <ul className="list-disc list-inside ml-4 text-blue-700 dark:text-blue-400 space-y-1">
              <li><strong>国际标准：</strong>ISO/IEC 27001、ISO/IEC 27002、COBIT 2019</li>
              <li><strong>国内标准：</strong>GB/T 22239（等保2.0）、GB/T 25069（等保三级）</li>
              <li><strong>行业框架：</strong>NIST CSF、PCI DSS、HIPAA</li>
              <li><strong>最佳实践：</strong>CIS Controls、OWASP Top 10</li>
            </ul>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
            <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
              📌 注意事项：
            </p>
            <ul className="list-disc list-inside ml-4 text-yellow-700 dark:text-yellow-400 space-y-1">
              <li>聚类分析建议上传 2-5 个相关标准文档</li>
              <li>每个文件内容建议在 500-50000 字符之间</li>
              <li>上传后可随时返回添加或删除文档</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
