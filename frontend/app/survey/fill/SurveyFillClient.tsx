'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 问卷填写页面
 * 企业用户填写调研问卷
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Send, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { SurveyAPI } from '@/lib/api/survey'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { SurveyResponse } from '@/lib/api/survey'
import { message } from '@/lib/message'

interface SurveyFillClientProps {
  questionnaireTaskId?: string
  surveyId?: string
}

export default function SurveyFillClient({ questionnaireTaskId, surveyId }: SurveyFillClientProps) {
  const router = useRouter()

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        if (surveyId) {
          const surveyResponse = await SurveyAPI.getSurvey(surveyId)
          setSurvey(surveyResponse.data)
          setAnswers(surveyResponse.data.answers || {})
          setShowInfoForm(false)

          const questionnaireResponse = await AIGenerationAPI.getFinalResult(
            surveyResponse.data.questionnaireTaskId
          )
          setQuestionnaire(questionnaireResponse.data)
        } else if (questionnaireTaskId) {
          const questionnaireResponse = await AIGenerationAPI.getFinalResult(questionnaireTaskId)
          setQuestionnaire(questionnaireResponse.data)
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

      const questionnaireResponse = await AIGenerationAPI.getFinalResult(questionnaireTaskId!)
      setQuestionnaire(questionnaireResponse.data)

      setShowInfoForm(false)
      message.success('问卷填写已开始')
    } catch (error: any) {
      message.error(error.message || '创建填写记录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: any, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answer: value, score },
    }))
  }

  const calculateProgress = () => {
    if (!questionnaire?.questionnaire) return 0
    const totalQuestions = questionnaire.questionnaire.length
    const answeredQuestions = Object.keys(answers).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }

  const handleSaveDraft = async () => {
    if (!survey) {
      message.error('请先开始填写问卷')
      return
    }

    try {
      setSubmitting(true)
      await SurveyAPI.saveDraft(survey.id, {
        answers,
        progressPercentage: calculateProgress(),
      })
      message.success('草稿已保存')
    } catch (error: any) {
      message.error(error.message || '保存草稿失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!survey) {
      message.error('请先开始填写问卷')
      return
    }

    if (!questionnaire?.questionnaire) {
      message.error('问卷数据加载失败')
      return
    }

    const totalQuestions = questionnaire.questionnaire.length
    const answeredQuestions = Object.keys(answers).length
    const totalScore = Object.values(answers).reduce((sum, current) => {
      const score = typeof current?.score === 'number' ? current.score : 0
      return sum + score
    }, 0)
    const maxScore = totalQuestions * 5

    if (answeredQuestions < totalQuestions) {
      message.warning(`还有 ${totalQuestions - answeredQuestions} 道题未回答`)
      return
    }

    try {
      setSubmitting(true)
      await SurveyAPI.submitSurvey(survey.id, {
        answers,
        totalScore,
        maxScore,
      })
      message.success('问卷提交成功！')
      router.push(`/survey/analysis?surveyId=${survey.id}`)
    } catch (error: any) {
      message.error(error.message || '提交问卷失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#FEFDFB]">
        <p className="text-[#94A3B8]">加载中...</p>
      </div>
    )
  }

  if (showInfoForm) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
        <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
          <CardHeader className="border-b border-[#E2E8F0]">
            <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              填写人信息
            </h2>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#1E3A5F]">
                姓名 *
              </Label>
              <Input
                id="name"
                value={respondentInfo.respondentName}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentName: e.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#1E3A5F]">
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                value={respondentInfo.respondentEmail}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentEmail: e.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="text-[#1E3A5F]">
                部门
              </Label>
              <Input
                id="department"
                value={respondentInfo.respondentDepartment}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentDepartment: e.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position" className="text-[#1E3A5F]">
                职位
              </Label>
              <Input
                id="position"
                value={respondentInfo.respondentPosition}
                onChange={(e) =>
                  setRespondentInfo({ ...respondentInfo, respondentPosition: e.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={() => router.back()} variant="outline" className="rounded-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <Button
                onClick={handleStartSurvey}
                disabled={!respondentInfo.respondentName.trim() || submitting}
                className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
              >
                {submitting ? '提交中...' : '开始填写'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
        {questionnaire?.questionnaire_metadata?.title || '调研问卷'}
      </h1>

      <Card className="mb-6 border border-[#E2E8F0] shadow-sm rounded-sm">
        <CardContent className="pt-6">
          <div className="flex justify-between mb-2">
            <p className="text-sm text-[#94A3B8]">填写进度</p>
            <p className="text-sm text-[#94A3B8]">
              {Object.keys(answers).length} / {questionnaire?.questionnaire?.length || 0}
            </p>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {questionnaire?.questionnaire?.map((question: any, index: number) => (
          <Card key={question.question_id} className="border border-[#E2E8F0] shadow-sm rounded-sm">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                {index + 1}. {question.question_text}
              </h3>

              {question.question_type === 'SINGLE_CHOICE' && (
                <RadioGroup
                  value={answers[question.question_id]?.answer || ''}
                  onValueChange={(value) => {
                    const selectedOption = question.options.find(
                      (opt: any) => opt.option_id === value
                    )
                    handleAnswerChange(question.question_id, value, selectedOption?.score || 0)
                  }}
                >
                  {question.options.map((option: any) => (
                    <div key={option.option_id} className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value={option.option_id} id={option.option_id} />
                      <Label htmlFor={option.option_id} className="cursor-pointer">
                        {option.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.question_type === 'MULTIPLE_CHOICE' && (
                <div>
                  {question.options.map((option: any) => (
                    <div key={option.option_id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={option.option_id}
                        checked={(answers[question.question_id]?.answer || []).includes(
                          option.option_id
                        )}
                        onCheckedChange={(checked) => {
                          const currentAnswers = answers[question.question_id]?.answer || []
                          let newAnswers
                          if (checked) {
                            newAnswers = [...currentAnswers, option.option_id]
                          } else {
                            newAnswers = currentAnswers.filter(
                              (id: string) => id !== option.option_id
                            )
                          }
                          const totalScore = newAnswers.reduce((sum: number, optionId: string) => {
                            const opt = question.options.find((o: any) => o.option_id === optionId)
                            return sum + (opt?.score || 0)
                          }, 0)
                          handleAnswerChange(question.question_id, newAnswers, totalScore)
                        }}
                      />
                      <Label htmlFor={option.option_id} className="cursor-pointer">
                        {option.text}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 sticky bottom-4 border border-[#E2E8F0] shadow-sm rounded-sm">
        <CardContent className="pt-6">
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSaveDraft}
              disabled={submitting}
              variant="outline"
              className="rounded-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              保存草稿
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || calculateProgress() < 100}
              className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
            >
              <Send className="w-4 h-4 mr-2" />
              提交问卷
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
