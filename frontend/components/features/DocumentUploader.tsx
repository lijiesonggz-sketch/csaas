'use client'

/**
 * 文档上传组件
 * 支持拖拽上传和文本粘贴
 */

import { useState, useCallback } from 'react'
import { Upload, message, Input } from 'antd'
import { InboxOutlined } from '@ant-design/icons'

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

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        setUploadedFileName(file.name)
        onDocumentChange(text)
        message.success(`文件 ${file.name} 上传成功（${text.length} 字符）`)
        return false // 阻止自动上传
      } catch (error) {
        message.error('文件读取失败')
        return false
      }
    },
    [onDocumentChange]
  )

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setTextContent(value)
      onDocumentChange(value)
      setUploadedFileName(undefined) // 清除文件名
    },
    [onDocumentChange]
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
          placeholder="请粘贴标准文档内容...&#10;&#10;示例：&#10;ISO/IEC 27001:2013 信息安全管理体系要求&#10;&#10;1. 范围&#10;本标准规定了建立、实施、维护和持续改进信息安全管理体系（ISMS）的要求..."
          onChange={handleTextChange}
          value={textContent}
          disabled={disabled}
          className="font-mono"
        />
      ) : (
        <Dragger
          accept=".txt,.md,.doc,.docx,.pdf"
          beforeUpload={handleFileUpload}
          disabled={disabled}
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持格式：.txt, .md, .doc, .docx, .pdf
            <br />
            最大文件大小：10MB
          </p>
        </Dragger>
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
        </ul>
      </div>
    </div>
  )
}
