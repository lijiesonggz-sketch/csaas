'use client'

/**
 * 文档上传组件
 * 支持拖拽上传和文本粘贴
 * 集成自动格式规范化功能
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, message, Input, Alert, Button } from 'antd'
import { InboxOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import mammoth from 'mammoth'
import {
  needsNormalization,
  normalizeDocumentFormat,
  getNormalizationSuggestions,
  analyzeDocumentStructure,
} from '@/lib/utils/documentNormalizer'

const { Dragger } = Upload
const { TextArea } = Input

interface DocumentUploaderProps {
  onDocumentChange: (content: string) => void
  disabled?: boolean
}

export default function DocumentUploader({ onDocumentChange, disabled }: DocumentUploaderProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('text')
  const [uploadedFileName, setUploadedFileName] = useState<string>()
  const [textContent, setTextContent] = useState<string>('')

  // 格式检查相关状态
  const [formatIssues, setFormatIssues] = useState<string[]>([])
  const [showFormatWarning, setShowFormatWarning] = useState(false)
  const [normalizedContent, setNormalizedContent] = useState<string>('')
  const [normalizationChanges, setNormalizationChanges] = useState<string[]>([])

  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout>()

  // 使用useEffect实现防抖
  useEffect(() => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 设置新的定时器
    debounceTimerRef.current = setTimeout(() => {
      if (textContent && textContent.trim().length > 0) {
        checkDocumentFormat(textContent)
      }
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [textContent, checkDocumentFormat])

  /**
   * 检查文档格式并提示用户
   */
  const checkDocumentFormat = useCallback((content: string) => {
    if (!content || content.trim().length === 0) return

    const structure = analyzeDocumentStructure(content)

    // 如果需要规范化，显示提示
    if (needsNormalization(content)) {
      const suggestions = getNormalizationSuggestions(content)
      setFormatIssues(suggestions)

      // 自动规范化内容
      const { normalized, changes } = normalizeDocumentFormat(content)
      setNormalizedContent(normalized)
      setNormalizationChanges(changes)

      setShowFormatWarning(true)
    } else {
      // 格式良好，直接使用
      setShowFormatWarning(false)
      setFormatIssues([])
      setNormalizedContent('')
      setNormalizationChanges([])
    }
  }, [])

  /**
   * 应用规范化后的内容
   */
  const applyNormalizedContent = useCallback(() => {
    if (normalizedContent) {
      setTextContent(normalizedContent)
      onDocumentChange(normalizedContent)
      setShowFormatWarning(false)
      message.success('✅ 文档格式已自动规范化')
    }
  }, [normalizedContent, onDocumentChange])

  /**
   * 使用原始内容
   */
  const useOriginalContent = useCallback(() => {
    setShowFormatWarning(false)
    message.info('⚠️ 将使用原始文档格式，可能会影响AI识别准确率')
  }, [])

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        // 检查文件类型
        const ext = file.name.toLowerCase().split('.').pop()
        let text = ''

        if (ext === 'docx') {
          // 使用 mammoth 解析 .docx 文件
          const arrayBuffer = await file.arrayBuffer()
          const result = await mammoth.extractRawText({ arrayBuffer })
          text = result.value

          if (result.messages.length > 0) {
            console.warn('Mammoth 解析警告:', result.messages)
          }
        } else if (['txt', 'md'].includes(ext || '')) {
          // 纯文本文件直接读取
          text = await file.text()
        } else {
          message.error('暂时只支持 .txt、.md 和 .docx 文件，.pdf 支持即将推出')
          return false
        }

        if (!text || text.trim().length === 0) {
          message.error('文件内容为空，请检查文件')
          return false
        }

        setUploadedFileName(file.name)
        setTextContent(text)

        // 检查格式
        checkDocumentFormat(text)

        // 如果不需要规范化，直接使用
        if (!needsNormalization(text)) {
          onDocumentChange(text)
          message.success(`文件 ${file.name} 上传成功（${text.length} 字符）`)
        } else {
          message.warning(`文件 ${file.name} 上传成功，但检测到格式问题，建议规范化`)
        }

        return false // 阻止自动上传
      } catch (error) {
        console.error('文件读取失败:', error)
        message.error(`文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`)
        return false
      }
    },
    [onDocumentChange, checkDocumentFormat]
  )

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setTextContent(value)
      setUploadedFileName(undefined) // 清除文件名
      // 格式检查由useEffect处理（防抖）
    },
    []
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setUploadMode('text')}
          className={`px-4 py-2 rounded ${
            uploadMode === 'text'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={disabled}
        >
          文本输入
        </button>
        <button
          type="button"
          onClick={() => setUploadMode('file')}
          className={`px-4 py-2 rounded ${
            uploadMode === 'file'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={disabled}
        >
          文件上传
        </button>
      </div>

      {uploadMode === 'text' ? (
        <TextArea
          rows={20}
          placeholder="请粘贴标准文档内容...&#10;&#10;示例：&#10;ISO/IEC 27001:2013 信息安全管理体系要求&#10;&#10;第一章 总则&#10;&#10;第一条 为规范...&#10;&#10;第二条 本标准所称..."
          onChange={handleTextChange}
          value={textContent}
          disabled={disabled}
          className="font-mono"
        />
      ) : (
        <Dragger
          accept=".txt,.md,.docx"
          beforeUpload={handleFileUpload}
          disabled={disabled}
          maxCount={1}
          fileList={[]}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持格式：.txt, .md, .docx
            <br />
            最大文件大小：10MB
            <br />
            <span className="text-orange-600">💡 .pdf 支持即将推出</span>
          </p>
        </Dragger>
      )}

      {/* 格式警告提示 */}
      {showFormatWarning && formatIssues.length > 0 && (
        <Alert
          message="检测到文档格式问题"
          description={
            <div className="space-y-3">
              <div className="text-sm">
                {formatIssues.map((issue, index) => (
                  <div key={index} className="mb-1">{issue}</div>
                ))}
              </div>

              {normalizationChanges.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="text-sm font-medium text-blue-700 mb-2">🔧 自动规范化内容：</div>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    {normalizationChanges.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={applyNormalizedContent}
                  size="small"
                >
                  应用规范化
                </Button>
                <Button onClick={useOriginalContent} size="small">
                  使用原格式
                </Button>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                💡 规范化后将自动转换圆点项目、数字编号为标准"第X条"格式，提升AI识别准确率至95%+
              </div>
            </div>
          }
          type="warning"
          icon={<InfoCircleOutlined />}
          closable
          onClose={() => setShowFormatWarning(false)}
          showIcon
        />
      )}

      {/* 上传文件名显示 */}
      {uploadedFileName && (
        <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">📄 已上传文件：</span>
            <span className="text-blue-800">{uploadedFileName}</span>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>💡 提示：</p>
        <ul className="list-disc list-inside ml-2">
          <li>请上传完整的IT标准文档（如ISO 27001、COBIT等）</li>
          <li>建议文档长度在1000-10000字之间</li>
          <li>支持中文和英文文档</li>
          <li>系统会自动检测格式并提示规范化（圆点、数字编号→标准条款格式）</li>
        </ul>
      </div>
    </div>
  )
}
