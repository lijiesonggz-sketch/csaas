'use client'

/**
 * 问卷填写页面
 * 企业用户填写调研问卷
 */

import { useState, useEffect, useRef } from 'react'
import { Card, Button, message, Radio, Checkbox, Input, Progress, Spin, Upload } from 'antd'
import { SaveOutlined, SendOutlined, LeftOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useRouter, useSearchParams } from 'next/navigation'
import { SurveyAPI } from '@/lib/api/survey'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { SurveyResponse } from '@/lib/api/survey'
import * as XLSX from 'xlsx'

const { TextArea } = Input

export default function SurveyFillPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const questionnaireTaskId = searchParams.get('questionnaireTaskId')
  const surveyId = searchParams.get('surveyId')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [questionnaire, setQuestionnaire] = useState<any>(null)
  const [survey, setSurvey] = useState<SurveyResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [respondentInfo, setRespondentInfo] = useState({
    respondentName: '',
    respondentEmail: '',
    respondentDepartment: '',
    respondentPosition: '',
  })
  const [showInfoForm, setShowInfoForm] = useState(true)
  const [shuffledOptions, setShuffledOptions] = useState<Record<string, any[]>>({})

  // Fisher-Yates洗牌算法
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // 加载问卷数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // 如果有surveyId，加载已有的填写记录
        if (surveyId) {
          const surveyResponse = await SurveyAPI.getSurvey(surveyId)
          setSurvey(surveyResponse.data)
          setAnswers(surveyResponse.data.answers || {})
          setShowInfoForm(false)

          // 加载问卷模板
          const questionnaireResponse = await AIGenerationAPI.getFinalResult(
            surveyResponse.data.questionnaireTaskId
          )
          setQuestionnaire(questionnaireResponse.data)

          // 为每个题目的选项生成随机顺序
          const shuffledOptionsMap: Record<string, any[]> = {}
          questionnaireResponse.data?.questionnaire?.forEach((question: any) => {
            if (question.options && Array.isArray(question.options)) {
              shuffledOptionsMap[question.question_id] = shuffleArray(question.options)
            }
          })
          setShuffledOptions(shuffledOptionsMap)
        } else if (questionnaireTaskId) {
          // 加载问卷模板
          const questionnaireResponse = await AIGenerationAPI.getFinalResult(questionnaireTaskId)
          setQuestionnaire(questionnaireResponse.data)

          // 为每个题目的选项生成随机顺序
          const shuffledOptionsMap: Record<string, any[]> = {}
          questionnaireResponse.data?.questionnaire?.forEach((question: any) => {
            if (question.options && Array.isArray(question.options)) {
              shuffledOptionsMap[question.question_id] = shuffleArray(question.options)
            }
          })
          setShuffledOptions(shuffledOptionsMap)
        } else {
          message.error('缺少问卷任务ID或填写记录ID')
          router.push('/ai-generation/questionnaire')
        }
      } catch (error: any) {
        message.error(error.message || '加载问卷失败')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [questionnaireTaskId, surveyId, router])

  // 开始填写问卷
  const handleStartSurvey = async () => {
    if (!respondentInfo.respondentName.trim()) {
      message.error('请输入您的姓名')
      return
    }

    try {
      setSubmitting(true)
      const response = await SurveyAPI.createSurvey({
        questionnaireTaskId: questionnaireTaskId!,
        ...respondentInfo,
      })
      setSurvey(response.data)

      // 加载问卷模板数据
      const questionnaireResponse = await AIGenerationAPI.getFinalResult(questionnaireTaskId!)
      setQuestionnaire(questionnaireResponse.data)

      // 为每个题目的选项生成随机顺序（避免用户按成熟度顺序选择）
      const shuffledOptionsMap: Record<string, any[]> = {}
      questionnaireResponse.data?.questionnaire?.forEach((question: any) => {
        if (question.options && Array.isArray(question.options)) {
          shuffledOptionsMap[question.question_id] = shuffleArray(question.options)
        }
      })
      setShuffledOptions(shuffledOptionsMap)

      setShowInfoForm(false)
      message.success('问卷填写已开始')
    } catch (error: any) {
      message.error(error.message || '创建填写记录失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 导入Excel填写结果
  const handleImportExcel = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // 读取第一个工作表
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length < 2) {
          message.error('Excel文件格式不正确')
          return
        }

        // 解析导入的答案
        const importedAnswers: Record<string, any> = {}
        let successCount = 0
        let errorCount = 0

        // 从第2行开始（跳过表头）
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          const questionNum = row[0] // Q001, Q002, ...
          const questionType = row[1] // 单选题 / 多选题
          const userAnswer = row[5]?.toString().trim() // 用户填写的选择

          if (!questionNum || !userAnswer) {
            continue // 跳过未填写的题目
          }

          // 找到对应的题目
          const questionIndex = parseInt(questionNum.replace('Q', '')) - 1
          const question = questionnaire?.questionnaire?.[questionIndex]

          if (!question) {
            console.warn(`未找到题目 ${questionNum}`)
            errorCount++
            continue
          }

          // 获取该题目的选项（使用随机后的顺序）
          const options = shuffledOptions[question.question_id] || question.options || []

          try {
            if (questionType === '单选题') {
              // 单选题：用户填写的是字母（如 A, B, C）
              const letterIndex = userAnswer.toUpperCase().charCodeAt(0) - 65 // A=0, B=1, C=2...
              if (letterIndex >= 0 && letterIndex < options.length) {
                const selectedOption = options[letterIndex]
                importedAnswers[question.question_id] = {
                  answer: selectedOption.option_id,
                  score: selectedOption.score || 0,
                }
                successCount++
              } else {
                console.warn(`题目 ${questionNum} 的选项索引 ${userAnswer} 超出范围`)
                errorCount++
              }
            } else if (questionType === '多选题') {
              // 多选题：用户填写的是逗号分隔的字母（如 A,B,C）
              const letters = userAnswer.split(',').map((s: string) => s.trim().toUpperCase())
              const selectedOptionIds: string[] = []
              let totalScore = 0

              for (const letter of letters) {
                const letterIndex = letter.charCodeAt(0) - 65
                if (letterIndex >= 0 && letterIndex < options.length) {
                  const selectedOption = options[letterIndex]
                  selectedOptionIds.push(selectedOption.option_id)
                  totalScore += selectedOption.score || 0
                }
              }

              if (selectedOptionIds.length > 0) {
                importedAnswers[question.question_id] = {
                  answer: selectedOptionIds,
                  score: totalScore,
                }
                successCount++
              } else {
                errorCount++
              }
            }
          } catch (err) {
            console.error(`解析题目 ${questionNum} 失败:`, err)
            errorCount++
          }
        }

        // 更新答案到状态
        setAnswers(importedAnswers)

        message.success(`成功导入 ${successCount} 道题目的答案${errorCount > 0 ? `，${errorCount} 道题目导入失败` : ''}`)
      } catch (error: any) {
        console.error('导入Excel失败:', error)
        message.error('导入失败，请检查文件格式')
      }
    }

    reader.readAsArrayBuffer(file)
    return false // 阻止自动上传
  }

  // 导出问卷为Excel
  const handleExportExcel = () => {
    if (!questionnaire?.questionnaire) {
      message.error('问卷数据未加载')
      return
    }

    try {
      // 准备Excel数据
      const excelData: any[] = []

      // 添加表头
      excelData.push([
        '题号',
        '题目类型',
        '题目文本',
        '题目说明',
        '选项列表',
        '您的选择（单选填写选项字母如A，多选用逗号分隔如A,B,C）',
      ])

      // 遍历所有题目
      questionnaire.questionnaire.forEach((question: any, index: number) => {
        // 获取该题目的选项（使用随机后的顺序）
        const options = shuffledOptions[question.question_id] || question.options || []

        // 格式化选项列表为 "A. 选项文本\nB. 选项文本"
        const optionsList = options
          .map((opt: any, optIndex: number) => {
            const letter = String.fromCharCode(65 + optIndex) // A, B, C...
            return `${letter}. ${opt.text}`
          })
          .join('\n')

        // 题目类型中文
        const questionType = question.question_type === 'SINGLE_CHOICE' ? '单选题' : '多选题'

        // 添加题目行
        excelData.push([
          `Q${(index + 1).toString().padStart(3, '0')}`,
          questionType,
          question.question_text,
          question.guidance || '',
          optionsList,
          '', // 空白供用户填写
        ])
      })

      // 创建工作簿
      const wb = XLSX.utils.book_new()

      // 创建工作表
      const ws = XLSX.utils.aoa_to_sheet(excelData)

      // 设置列宽
      ws['!cols'] = [
        { wch: 8 },  // 题号
        { wch: 10 }, // 题目类型
        { wch: 50 }, // 题目文本
        { wch: 40 }, // 题目说明
        { wch: 60 }, // 选项列表
        { wch: 30 }, // 您的选择
      ]

      // 设置单元格样式（文本换行）
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) continue
          if (!ws[cellAddress].s) ws[cellAddress].s = {}
          ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' }
        }
      }

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '调研问卷')

      // 生成文件名
      const fileName = `${questionnaire.questionnaire_metadata?.title || '调研问卷'}_${new Date().toISOString().split('T')[0]}.xlsx`

      // 导出文件
      XLSX.writeFile(wb, fileName)

      message.success('问卷已成功导出为Excel文件')
    } catch (error: any) {
      console.error('导出Excel失败:', error)
      message.error('导出失败，请重试')
    }
  }

  // 处理答案变化
  const handleAnswerChange = (questionId: string, value: any, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answer: value, score },
    }))
  }

  // 计算进度
  const calculateProgress = () => {
    if (!questionnaire?.questionnaire) return 0
    const totalQuestions = questionnaire.questionnaire.length
    const answeredQuestions = Object.keys(answers).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }

  // 计算总分
  const calculateTotalScore = () => {
    let total = 0
    let max = 0
    if (questionnaire?.questionnaire) {
      questionnaire.questionnaire.forEach((q: any) => {
        const answer = answers[q.question_id]
        if (answer) {
          total += answer.score || 0
        }
        // 计算最大分数（取所有选项的最高分）
        const maxOption = Math.max(...q.options.map((opt: any) => opt.score))
        max += maxOption
      })
    }
    return { total, max }
  }

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!survey) {
      message.error('请先开始填写问卷')
      return
    }

    try {
      setSubmitting(true)
      const { total, max } = calculateTotalScore()
      await SurveyAPI.saveDraft(survey.id, {
        answers,
        progressPercentage: calculateProgress(),
        totalScore: total,
        maxScore: max,
      })
      message.success('草稿已保存')
    } catch (error: any) {
      message.error(error.message || '保存草稿失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 提交问卷
  const handleSubmit = async () => {
    if (!survey) {
      message.error('请先开始填写问卷')
      return
    }

    if (!questionnaire?.questionnaire) {
      message.error('问卷数据加载失败')
      return
    }

    // 检查是否所有题目都已回答
    const totalQuestions = questionnaire.questionnaire.length
    const answeredQuestions = Object.keys(answers).length

    if (answeredQuestions < totalQuestions) {
      message.warning(`还有 ${totalQuestions - answeredQuestions} 道题未回答`)
      return
    }

    try {
      setSubmitting(true)
      const { total, max } = calculateTotalScore()
      await SurveyAPI.submitSurvey(survey.id, {
        answers,
        totalScore: total,
        maxScore: max,
      })
      message.success('问卷提交成功！')

      // 跳转到成熟度分析页面
      router.push(`/survey/analysis?surveyId=${survey.id}`)
    } catch (error: any) {
      message.error(error.message || '提交问卷失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" />
      </div>
    )
  }

  // 显示填写人信息表单
  if (showInfoForm) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card title="填写人信息" className="shadow-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <Input
                size="large"
                value={respondentInfo.respondentName}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentName: e.target.value })
                }
                placeholder="请输入您的姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
              <Input
                size="large"
                type="email"
                value={respondentInfo.respondentEmail}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentEmail: e.target.value })
                }
                placeholder="请输入您的邮箱（可选）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
              <Input
                size="large"
                value={respondentInfo.respondentDepartment}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentDepartment: e.target.value })
                }
                placeholder="请输入您的部门（可选）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">职位</label>
              <Input
                size="large"
                value={respondentInfo.respondentPosition}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentPosition: e.target.value })
                }
                placeholder="请输入您的职位（可选）"
              />
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button size="large" onClick={() => router.back()} icon={<LeftOutlined />}>
                返回
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={handleStartSurvey}
                loading={submitting}
                disabled={!respondentInfo.respondentName.trim()}
              >
                开始填写
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {questionnaire?.questionnaire_metadata?.title || '调研问卷'}
            </h1>
            <p className="text-gray-600">{questionnaire?.questionnaire_metadata?.description || ''}</p>
          </div>
          <div className="flex gap-2">
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleImportExcel}
            >
              <Button
                type="default"
                size="large"
                icon={<UploadOutlined />}
              >
                导入Excel
              </Button>
            </Upload>
            <Button
              type="default"
              size="large"
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
            >
              导出Excel
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          提示：可点击"导出Excel"下载问卷离线填写，填写完成后点击"导入Excel"上传答案
        </p>
      </div>

      {/* 进度条 */}
      <Card className="mb-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">填写进度</span>
            <span className="text-sm text-gray-500">
              {Object.keys(answers).length} / {questionnaire?.questionnaire?.length || 0}
            </span>
          </div>
          <Progress percent={calculateProgress()} status="active" />
        </div>
      </Card>

      {/* 问题列表 */}
      <div className="space-y-6">
        {questionnaire?.questionnaire?.map((question: any, index: number) => (
            <Card
              key={question.question_id}
              className="shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {index + 1}. {question.question_text}
                </h3>
                {question.description && (
                  <p className="text-sm text-gray-500">{question.description}</p>
                )}
              </div>

            {/* 单选题 */}
            {question.question_type === 'SINGLE_CHOICE' && (
              <Radio.Group
                value={answers[question.question_id]?.answer}
                onChange={(e) => {
                  const selectedOption = question.options.find(
                    (opt: any) => opt.option_id === e.target.value
                  )
                  handleAnswerChange(
                    question.question_id,
                    e.target.value,
                    selectedOption?.score || 0
                  )
                }}
                className="w-full"
              >
                <div className="space-y-3">
                  {(shuffledOptions[question.question_id] || question.options).map((option: any) => (
                    <Radio key={option.option_id} value={option.option_id} className="block">
                      <span className="ml-2">{option.text}</span>
                    </Radio>
                  ))}
                </div>
              </Radio.Group>
            )}

            {/* 多选题 */}
            {question.question_type === 'MULTIPLE_CHOICE' && (
              <Checkbox.Group
                value={answers[question.question_id]?.answer || []}
                onChange={(checkedValues) => {
                  // 计算多选题总分（选中选项的分数之和）
                  const totalScore = checkedValues.reduce((sum: number, optionId: any) => {
                    const option = question.options.find((opt: any) => opt.option_id === optionId)
                    return sum + (option?.score || 0)
                  }, 0)
                  handleAnswerChange(question.question_id, checkedValues, totalScore)
                }}
                className="w-full"
              >
                <div className="space-y-3">
                  {(shuffledOptions[question.question_id] || question.options).map((option: any) => (
                    <Checkbox key={option.option_id} value={option.option_id} className="block">
                      <span className="ml-2">{option.text}</span>
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            )}
          </Card>
        ))}
      </div>

      {/* 操作按钮 */}
      <Card className="mt-6 sticky bottom-4 shadow-lg">
        <div className="flex justify-end items-center">
          <div className="space-x-3">
            <Button size="large" onClick={handleSaveDraft} loading={submitting} icon={<SaveOutlined />}>
              保存草稿
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={submitting}
              icon={<SendOutlined />}
              disabled={calculateProgress() < 100}
            >
              提交问卷
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
