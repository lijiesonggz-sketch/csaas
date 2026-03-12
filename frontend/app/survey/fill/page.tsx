'use client'

export const dynamic = 'force-dynamic'

/**
 * 问卷填写页面
 * 企业用户填写调研问卷
 */

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  LinearProgress,
  Box,
  Typography,
  Grid,
} from '@mui/material'
import {
  Save,
  Send,
  ArrowBack,
  Download,
  UploadFile,
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { SurveyAPI } from '@/lib/api/survey'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { SurveyResponse } from '@/lib/api/survey'
import * as XLSX from 'xlsx'
import { message } from '@/lib/message'

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

    if (answeredQuestions < totalQuestions) {
      message.warning(`还有 ${totalQuestions - answeredQuestions} 道题未回答`)
      return
    }

    try {
      setSubmitting(true)
      await SurveyAPI.submitSurvey(survey.id, { answers })
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>加载中...</Typography>
      </Box>
    )
  }

  if (showInfoForm) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Card>
          <CardHeader title="填写人信息" />
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="姓名 *"
                value={respondentInfo.respondentName}
                onChange={(e) => setRespondentInfo({ ...respondentInfo, respondentName: e.target.value })}
                fullWidth
              />
              <TextField
                label="邮箱"
                type="email"
                value={respondentInfo.respondentEmail}
                onChange={(e) => setRespondentInfo({ ...respondentInfo, respondentEmail: e.target.value })}
                fullWidth
              />
              <TextField
                label="部门"
                value={respondentInfo.respondentDepartment}
                onChange={(e) => setRespondentInfo({ ...respondentInfo, respondentDepartment: e.target.value })}
                fullWidth
              />
              <TextField
                label="职位"
                value={respondentInfo.respondentPosition}
                onChange={(e) => setRespondentInfo({ ...respondentInfo, respondentPosition: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button onClick={() => router.back()} startIcon={<ArrowBack />}>返回</Button>
                <Button
                  variant="contained"
                  onClick={handleStartSurvey}
                  disabled={!respondentInfo.respondentName.trim() || submitting}
                >
                  {submitting ? '提交中...' : '开始填写'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>{questionnaire?.questionnaire_metadata?.title || '调研问卷'}</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">填写进度</Typography>
            <Typography variant="body2" color="text.secondary">
              {Object.keys(answers).length} / {questionnaire?.questionnaire?.length || 0}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={calculateProgress()} />
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {questionnaire?.questionnaire?.map((question: any, index: number) => (
          <Card key={question.question_id}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {index + 1}. {question.question_text}
              </Typography>

              {question.question_type === 'SINGLE_CHOICE' && (
                <RadioGroup
                  value={answers[question.question_id]?.answer || ''}
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
                >
                  {question.options.map((option: any) => (
                    <FormControlLabel
                      key={option.option_id}
                      value={option.option_id}
                      control={<Radio />}
                      label={option.text}
                    />
                  ))}
                </RadioGroup>
              )}

              {question.question_type === 'MULTIPLE_CHOICE' && (
                <Box>
                  {question.options.map((option: any) => (
                    <FormControlLabel
                      key={option.option_id}
                      control={
                        <Checkbox
                          checked={(answers[question.question_id]?.answer || []).includes(option.option_id)}
                          onChange={(e) => {
                            const currentAnswers = answers[question.question_id]?.answer || []
                            let newAnswers
                            if (e.target.checked) {
                              newAnswers = [...currentAnswers, option.option_id]
                            } else {
                              newAnswers = currentAnswers.filter((id: string) => id !== option.option_id)
                            }
                            const totalScore = newAnswers.reduce((sum: number, optionId: string) => {
                              const opt = question.options.find((o: any) => o.option_id === optionId)
                              return sum + (opt?.score || 0)
                            }, 0)
                            handleAnswerChange(question.question_id, newAnswers, totalScore)
                          }}
                        />
                      }
                      label={option.text}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card sx={{ mt: 3, position: 'sticky', bottom: 16 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={handleSaveDraft} disabled={submitting} startIcon={<Save />}>
              保存草稿
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || calculateProgress() < 100}
              startIcon={<Send />}
            >
              提交问卷
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
