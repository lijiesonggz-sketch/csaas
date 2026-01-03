'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  Spin,
  Alert,
  Button,
  Statistic,
  Row,
  Col,
  Tag,
  Descriptions,
  Divider,
  Space,
  Progress,
  message,
  Modal,
  Radio,
  InputNumber,
  Upload,
  Collapse,
} from 'antd'
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  BarChartOutlined,
  RiseOutlined,
  FallOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  BulbOutlined,
  UploadOutlined,
  DownloadOutlined,
  TrophyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { SurveyAPI } from '@/lib/api/survey'
import type { UploadFile } from 'antd'
import * as XLSX from 'xlsx'

const { Dragger } = Upload

interface MaturityAnalysisResult {
  surveyResponseId: string
  respondentInfo: {
    name: string
    department?: string
    position?: string
    submittedAt: string
  }
  overall: {
    maturityLevel: number
    calculation: {
      totalScore: number
      maxScore: number
      formula: string
    }
    grade: string
    description: string
  }
  distribution: {
    level_1: number
    level_2: number
    level_3: number
    level_4: number
    level_5: number
  }
  clusterMaturity: {
    cluster_id: string
    cluster_name: string
    dimension: string
    maturityLevel: number
    totalScore: number
    maxScore: number
    questionsCount: number
    calculation: string
    grade: string
    isShortcoming: boolean
    questions: {
      question_id: string
      question_text: string
      selected_option: string
      selected_option_text: string
      score: number
      level: number
    }[]
  }[]
  dimensionMaturity: {
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }[]
  conflicts: {
    intraCluster: {
      cluster_id: string
      cluster_name: string
      conflictType: string
      description: string
      questions: string[]
      scores: number[]
      variance: number
      suggestion: string
    }[]
    interCluster: {
      ruleId: string
      conflictType: string
      description: string
      prerequisiteCluster: {
        cluster_id: string
        cluster_name: string
        maturityLevel: number
      }
      dependentCluster: {
        cluster_id: string
        cluster_name: string
        maturityLevel: number
      }
      suggestion: string
    }[]
    hasConflict: boolean
    conflictCount: number
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  topShortcomings: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    gap: number
  }[]
  topStrengths: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    advantage: number
  }[]
  statistics: {
    totalQuestions: number
    answeredQuestions: number
    totalClusters: number
    shortcomingClusters: number
    strengthClusters: number
    averageClusterMaturity: number
    minClusterMaturity: number
    maxClusterMaturity: number
    clusterMaturityStdDev: number
    maturityRange: number
  }
}

export default function GapAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MaturityAnalysisResult | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [parsedData, setParsedData] = useState<any | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [targetMaturity, setTargetMaturity] = useState<number>(4)

  // 从localStorage恢复分析结果
  useEffect(() => {
    const savedAnalysis = localStorage.getItem(`gap-analysis-${projectId}`)
    if (savedAnalysis) {
      try {
        setAnalysis(JSON.parse(savedAnalysis))
      } catch (e) {
        console.error('Failed to parse saved analysis:', e)
      }
    }
  }, [projectId])

  // 保存分析结果到localStorage
  useEffect(() => {
    if (analysis) {
      localStorage.setItem(`gap-analysis-${projectId}`, JSON.stringify(analysis))
    }
  }, [analysis, projectId])

  // 添加重新上传功能
  const handleReupload = () => {
    setAnalysis(null)
    setParsedData(null)
    setFileList([])
    setError(null)
    localStorage.removeItem(`gap-analysis-${projectId}`)
  }

  const getGradeColor = (grade: string) => {
    if (grade.includes('卓越级')) return 'purple'
    if (grade.includes('系统优化级')) return 'blue'
    if (grade.includes('充分规范级')) return 'green'
    if (grade.includes('初步规范级')) return 'orange'
    return 'red'
  }

  const getSeverityType = (severity: string): 'error' | 'warning' | 'info' => {
    switch (severity) {
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'info'
      default:
        return 'info'
    }
  }

  const getMaturityProgress = (level: number) => {
    return (level / 5) * 100
  }

  const handleUpload = async (file: UploadFile) => {
    try {
      setUploading(true)
      setError(null)

      // 读取并解析文件内容
      const data = await parseFile(file)

      // 保存解析后的数据，但不立即分析
      setParsedData(data)
      message.success('文件解析成功！请点击"开始分析"按钮进行差距分析')
    } catch (err: any) {
      console.error('文件解析失败:', err)
      setError(err.message || '文件解析失败，请确保文件格式正确')
      message.error(err.message || '文件解析失败')
    } finally {
      setUploading(false)
    }
  }

  // 开始分析
  const handleStartAnalysis = async () => {
    if (!parsedData) {
      message.warning('请先上传文件')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 上传问卷答案并进行分析
      const response = await SurveyAPI.uploadAndAnalyze({
        projectId,
        questionnaireData: parsedData,
      })

      if (response.success) {
        setAnalysis(response.data)
        message.success('差距分析完成！')
        setFileList([])
        setParsedData(null)
      } else {
        throw new Error(response.message || '分析失败')
      }
    } catch (err: any) {
      console.error('分析失败:', err)
      setError(err.message || '差距分析失败')
      message.error(err.message || '差距分析失败')
    } finally {
      setLoading(false)
    }
  }

  // 解析CSV/Excel文件
  const parseFile = async (file: UploadFile): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          // 获取第一个工作表
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]

          // 转换为JSON
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
            defval: '', // 空单元格默认值
            raw: false, // 保持原始格式
          })

          // 检查文件格式并转换为后端期望的格式
          const questionnaireData = convertToQuestionnaireData(jsonData)
          resolve(questionnaireData)
        } catch (error) {
          reject(new Error('文件解析失败：' + (error instanceof Error ? error.message : '未知错误')))
        }
      }

      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }

      reader.readAsBinaryString(file.originFileObj || file as any)
    })
  }

  // 将CSV/Excel数据转换为后端期望的问卷数据格式
  const convertToQuestionnaireData = (jsonData: any[]): any => {
    console.log('📊 解析CSV数据，共', jsonData.length, '行')
    console.log('📋 前3行数据示例:', jsonData.slice(0, 3))

    const answers: Record<string, any> = {}
    let totalScore = 0
    let maxScore = 0

    // 检测CSV格式 - 打印所有列名
    const firstRow = jsonData[0] || {}
    console.log('📝 第一行的所有列:', Object.keys(firstRow))

    // 尝试多种可能的列名
    const questionIdKeys = ['Question ID', 'question_id', 'questionId', '问题ID', '题目ID', 'ID', 'id']
    const selectedOptionKeys = ['Selected Option', 'selected_option', 'selectedOption', 'Option ID', 'option_id', '选择的选项', '选项ID', '选项', 'Answer', 'answer']
    const scoreKeys = ['Score', 'score', '得分', '分数', '分值']

    // 找到实际存在的列名
    const questionIdKey = questionIdKeys.find(key => key in firstRow)
    const selectedOptionKey = selectedOptionKeys.find(key => key in firstRow)
    const scoreKey = scoreKeys.find(key => key in firstRow)

    console.log('🔍 检测到的列:', { questionIdKey, selectedOptionKey, scoreKey })

    if (!questionIdKey || !selectedOptionKey) {
      throw new Error('CSV格式不正确，必须包含问题ID和选项列。请检查文件格式。')
    }

    // 根据选项ID计算分数（选项得分映射）
    const calculateScoreFromOption = (optionId: string): { score: number; options: string[] } => {
      const optionScores: Record<string, number> = {
        'A': 5,
        'B': 4,
        'C': 3,
        'D': 2,
        'E': 1,
        'a': 5,
        'b': 4,
        'c': 3,
        'd': 2,
        'e': 1,
      }

      // 处理多选情况（如 "A、C"）
      if (optionId.includes('、') || optionId.includes(',') || optionId.includes(' ')) {
        // 分隔符可能是中文顿号、英文逗号或空格
        const options = optionId.split(/[、, ]+/).filter(o => o.trim())
        // 多选题取平均分
        const sum = options.reduce((acc, opt) => acc + (optionScores[opt.trim()] || 0), 0)
        const score = Math.round(sum / options.length)
        return { score, options }
      }

      // 单选
      const score = optionScores[optionId] || 0
      return { score, options: [optionId] }
    }

    // 解析每一行数据
    jsonData.forEach((row: any, index: number) => {
      const questionId = row[questionIdKey]
      const selectedOption = row[selectedOptionKey]
      let score = 0
      let options: string[] = []

      // 跳过空行
      if (!questionId || !selectedOption) {
        return
      }

      // 如果有Score列，使用它；否则自动计算
      if (scoreKey) {
        const scoreValue = row[scoreKey]
        score = parseFloat(scoreValue) || 0
        options = [selectedOption]
      } else {
        // 根据选项自动计算分数
        const result = calculateScoreFromOption(selectedOption)
        score = result.score
        options = result.options
      }

      console.log(`第${index + 1}行:`, { questionId, selectedOption, score, options })

      // 按照后端期望的格式存储答案
      answers[questionId] = {
        answer: options.length > 1 ? options : options[0],
        score,
      }
      totalScore += score

      // 计算满分（假设每题最高5分）
      maxScore += 5
    })

    console.log('✅ 解析完成:', { 问题数: Object.keys(answers).length, 总分: totalScore, 满分: maxScore })

    return {
      respondentInfo: {
        name: '导出的问卷填写人',
        department: '',
        position: '',
        submittedAt: new Date().toISOString(),
      },
      answers,
      totalScore,
      maxScore,
    }
  }

  // 下载答案模板
  const handleDownloadTemplate = () => {
    const template = [
      ['Question ID', 'Selected Option'],
      ['Q001', 'A'],
      ['Q002', 'B'],
      ['Q003', 'C'],
      ['Q004', 'A、C'],
      ['', ''],
      ['', ''],
      ['', '说明：'],
      ['', '1. Question ID: 问题ID（从问卷中获取）'],
      ['', '2. Selected Option: 选择的选项（A=5分, B=4分, C=3分, D=2分, E=1分）'],
      ['', '3. 支持多选，用顿号或逗号分隔，如 A、C 或 A,C'],
      ['', '4. Score列可选，不填会自动计算'],
    ]

    const csvContent = template.map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `questionnaire_answers_template.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('模板已下载！')
  }

  const handleGenerateActionPlan = () => {
    setModalVisible(true)
  }

  const handleConfirmTarget = () => {
    if (!analysis) return

    // 验证目标成熟度
    if (targetMaturity <= analysis.overall.maturityLevel) {
      message.warning(`目标成熟度（${targetMaturity.toFixed(1)}）应高于当前成熟度（${analysis.overall.maturityLevel.toFixed(2)}）`)
      return
    }

    // 跳转到项目工作台的改进措施页面
    router.push(`/projects/${projectId}/action-plan?surveyResponseId=${analysis.surveyResponseId}&targetMaturity=${targetMaturity}`)
    setModalVisible(false)
  }

  const uploadProps = {
    name: 'file',
    fileList,
    beforeUpload: (file: UploadFile) => {
      // 选择文件后立即处理
      handleUpload(file)
      return false // 阻止自动上传
    },
    onChange: (info: any) => {
      setFileList(info.fileList)
    },
    onRemove: () => {
      setFileList([])
    },
    accept: '.csv,.xlsx,.xls',
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      {/* 头部：标题 + 操作按钮 */}
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <BarChartOutlined className="w-8 h-8 text-purple-600" strokeWidth={2} />
            差距分析
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            上传问卷答案JSON文件，自动进行成熟度差距分析
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
          >
            返回
          </Button>
          {analysis && (
            <>
              <Button
                icon={<UploadOutlined />}
                onClick={handleReupload}
              >
                重新上传
              </Button>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleGenerateActionPlan}
              >
                生成改进措施
              </Button>
            </>
          )}
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 上传问卷答案 */}
      {!analysis && (
        <Card className="mb-6">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div className="text-center py-8">
              <UploadOutlined className="text-6xl text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold mb-2">上传问卷答案</h3>
              <p className="text-gray-500 mb-6">
                请上传包含问卷答案的CSV或Excel文件，系统将进行差距分析
              </p>
              <Space>
                <Button
                  type="default"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadTemplate}
                >
                  下载答案模板
                </Button>
                {parsedData && (
                  <Button
                    type="primary"
                    icon={<BarChartOutlined />}
                    onClick={handleStartAnalysis}
                    loading={loading}
                  >
                    开始分析
                  </Button>
                )}
              </Space>
            </div>

            <Dragger {...uploadProps} style={{ padding: '40px' }}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-4xl text-blue-500" />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 CSV 或 Excel (.xlsx, .xls) 格式的问卷答案文件</p>
            </Dragger>

            {parsedData && (
              <Alert
                message="文件已就绪"
                description={`已解析 ${Object.keys(parsedData.answers || {}).length} 个问题答案，总分：${parsedData.totalScore || 0} / ${parsedData.maxScore || 0}`}
                type="success"
                showIcon
                action={
                  <Button size="small" onClick={() => {
                    setParsedData(null)
                    setFileList([])
                  }}>
                    清除
                  </Button>
                }
              />
            )}

            <Alert
              message="文件格式说明"
              description={
                <div>
                  <p>CSV/Excel文件应包含以下列：</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><strong>Question ID</strong> - 问题ID</li>
                    <li><strong>Selected Option</strong> - 选择的选项ID（A=5分, B=4分, C=3分, D=2分, E=1分）</li>
                    <li><strong>Score</strong> - 该选项的得分（可选，如果没有会自动计算）</li>
                  </ul>
                  <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    支持多选答案，用顿号（、）或逗号分隔，如 "A、C" 或 "A,C"，系统会自动计算平均分
                  </p>
                  <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                    提示：可以先从问卷生成页面导出问卷模板，填写答案后再上传
                  </p>
                </div>
              }
              type="info"
              showIcon
            />
          </Space>
        </Card>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-16">
          <Spin size="large" tip="正在进行差距分析..." />
        </div>
      )}

      {/* 分析结果 */}
      {analysis && !loading && (
        <>
          {/* 冲突检测 */}
          <Alert
            message={
              analysis.conflicts.hasConflict
                ? `检测到 ${analysis.conflicts.conflictCount} 个冲突项 (严重程度: ${analysis.conflicts.severity})`
                : '冲突检测：无冲突'
            }
            description={
              <div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    聚类内冲突 ({analysis.conflicts.intraCluster.length}个):
                  </div>
                  {analysis.conflicts.intraCluster.length > 0 ? (
                    <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
                      {analysis.conflicts.intraCluster.map((conflict, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          <strong>{conflict.cluster_name}</strong>: {conflict.description}
                          <br />
                          <span style={{ fontSize: 12, color: '#666' }}>
                            方差: {conflict.variance.toFixed(2)}, {conflict.suggestion}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ paddingLeft: 20, color: '#52c41a', marginBottom: 8 }}>
                      ✓ 各聚类内问题得分一致性良好
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    聚类间冲突 ({analysis.conflicts.interCluster.length}个):
                  </div>
                  {analysis.conflicts.interCluster.length > 0 ? (
                    <ul style={{ paddingLeft: 20 }}>
                      {analysis.conflicts.interCluster.map((conflict, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {conflict.description}
                          <br />
                          <span style={{ fontSize: 12, color: '#666' }}>{conflict.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ paddingLeft: 20, color: '#52c41a' }}>
                      ✓ 聚类间成熟度符合逻辑依赖关系
                    </div>
                  )}
                </div>
              </div>
            }
            type={analysis.conflicts.hasConflict ? getSeverityType(analysis.conflicts.severity) : 'success'}
            showIcon
            icon={analysis.conflicts.hasConflict ? <WarningOutlined /> : <CheckCircleOutlined />}
            style={{ marginBottom: 24 }}
          />

          {/* 总体成熟度 */}
          <Card title={<Space><BarChartOutlined />总体成熟度</Space>} style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <div className="text-center">
                  <Statistic
                    title="成熟度等级"
                    value={analysis.overall.maturityLevel.toFixed(2)}
                    suffix="/ 5.0"
                    valueStyle={{ color: '#1890ff', fontSize: 48 }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Tag color={getGradeColor(analysis.overall.grade)} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {analysis.overall.grade}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
                    {analysis.overall.description}
                  </div>
                </div>
              </Col>
              <Col xs={24} md={16}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="计算公式">
                    <code style={{ backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
                      {analysis.overall.calculation.formula}
                    </code>
                  </Descriptions.Item>
                  <Descriptions.Item label="总得分">
                    <strong style={{ fontSize: 18 }}>{analysis.overall.calculation.totalScore}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="满分">
                    <strong style={{ fontSize: 18 }}>{analysis.overall.calculation.maxScore}</strong>
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 16 }}>
                  <Progress
                    percent={getMaturityProgress(analysis.overall.maturityLevel)}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                    format={(percent) => `${analysis.overall.maturityLevel.toFixed(2)} / 5.0`}
                  />
                </div>
              </Col>
            </Row>
          </Card>

          {/* TOP 5 短板和优势 */}
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <FallOutlined style={{ color: '#ff4d4f' }} />
                    <span style={{ color: '#ff4d4f' }}>TOP 5 短板</span>
                  </Space>
                }
              >
                {analysis.topShortcomings.map((item) => (
                  <div key={item.rank} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Tag color="red" style={{ minWidth: 30, textAlign: 'center' }}>
                        {item.rank}
                      </Tag>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{item.cluster_name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          成熟度: {item.maturityLevel.toFixed(2)} (差距: {item.gap.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <RiseOutlined style={{ color: '#52c41a' }} />
                    <span style={{ color: '#52c41a' }}>TOP 5 优势</span>
                  </Space>
                }
              >
                {analysis.topStrengths.map((item) => (
                  <div key={item.rank} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Tag color="green" style={{ minWidth: 30, textAlign: 'center' }}>
                        {item.rank}
                      </Tag>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{item.cluster_name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          成熟度: {item.maturityLevel.toFixed(2)} (优势: {item.advantage.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          {/* 统计信息 */}
          <Card title={<Space><InfoCircleOutlined />统计信息</Space>} style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic title="总问题数" value={analysis.statistics.totalQuestions} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总聚类数" value={analysis.statistics.totalClusters} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="平均聚类成熟度"
                  value={analysis.statistics.averageClusterMaturity.toFixed(2)}
                  precision={2}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="成熟度标准差"
                  value={analysis.statistics.clusterMaturityStdDev.toFixed(2)}
                  precision={2}
                />
              </Col>
            </Row>
          </Card>

          {/* 成熟度分布 */}
          <Card
            title={<Space><BarChartOutlined />成熟度分布</Space>}
            extra={<span style={{ fontSize: 12, color: '#666' }}>按聚类成熟度等级统计</span>}
            style={{ marginBottom: 24 }}
          >
            <Row gutter={16}>
              {[1, 2, 3, 4, 5].map((level) => {
                const count = analysis.distribution[`level_${level}` as keyof typeof analysis.distribution]
                const levelRange = level === 1 ? '0-1分' : level === 2 ? '1-2分' : level === 3 ? '2-3分' : level === 4 ? '3-4分' : '4-5分'
                return (
                  <Col key={level} xs={24} sm={12} md={4}>
                    <Statistic
                      title={
                        <div>
                          <div>Level {level}</div>
                          <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>({levelRange})</div>
                        </div>
                      }
                      value={count}
                      suffix="个聚类"
                      valueStyle={{ fontSize: 24 }}
                    />
                  </Col>
                )
              })}
            </Row>
          </Card>

          {/* 各聚类详情 */}
          <Card title={<Space><TrophyOutlined />各聚类详细成熟度 ({analysis.clusterMaturity.length}个)</Space>}>
            <Collapse
              accordion
              items={analysis.clusterMaturity.map((cluster) => ({
                key: cluster.cluster_id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <span style={{ fontWeight: 'bold' }}>{cluster.cluster_name}</span>
                      <Tag color={getGradeColor(cluster.grade)}>{cluster.grade}</Tag>
                      {cluster.isShortcoming && <Tag color="red">短板</Tag>}
                    </Space>
                    <Space style={{ fontSize: 12, color: '#666' }}>
                      <span>成熟度: {cluster.maturityLevel.toFixed(2)}</span>
                      <Divider type="vertical" />
                      <span>维度: {cluster.dimension}</span>
                      <Divider type="vertical" />
                      <span>问题数: {cluster.questionsCount}</span>
                    </Space>
                  </div>
                ),
                extra: (
                  <code style={{ fontSize: 11, backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
                    {cluster.calculation}
                  </code>
                ),
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <h4 style={{ marginBottom: 16 }}>问题详情</h4>
                    {cluster.questions.map((question, idx) => (
                      <div
                        key={question.question_id}
                        style={{
                          marginBottom: 12,
                          padding: 12,
                          backgroundColor: '#fafafa',
                          borderRadius: 4,
                          borderLeft: '3px solid #1890ff',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Tag>{idx + 1}</Tag>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, marginBottom: 4 }}>{question.question_text}</div>
                            <div style={{ fontSize: 13, color: '#1890ff', marginBottom: 4 }}>
                              选择: {question.selected_option_text || '未选择'}
                            </div>
                            <Space size="small" style={{ fontSize: 12, color: '#666' }}>
                              <span>得分: {question.score}/5</span>
                              <Divider type="vertical" />
                              <span>等级: Level {question.level}</span>
                            </Space>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
          </Card>

          {/* 底部操作 */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Space size="large">
              <Button size="large" icon={<PrinterOutlined />} onClick={() => window.print()}>
                打印报告
              </Button>
              <Button
                size="large"
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleGenerateActionPlan}
              >
                生成改进措施
              </Button>
            </Space>
          </div>

          {/* 目标成熟度设置对话框 */}
          <Modal
            title={
              <Space>
                <BulbOutlined style={{ color: '#1890ff' }} />
                <span>设置改进目标</span>
              </Space>
            }
            open={modalVisible}
            onOk={handleConfirmTarget}
            onCancel={() => setModalVisible(false)}
            okText="开始生成"
            cancelText="取消"
            width={600}
          >
            <div style={{ padding: '20px 0' }}>
              <Alert
                message="当前成熟度分析"
                description={
                  <div style={{ marginTop: 8 }}>
                    <div>
                      <strong>总体成熟度:</strong> {analysis?.overall.maturityLevel.toFixed(2)} ({analysis?.overall.grade})
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <strong>主要短板:</strong>
                    </div>
                    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                      {analysis?.topShortcomings.slice(0, 3).map((item) => (
                        <li key={item.rank}>
                          {item.cluster_name} (成熟度: {item.maturityLevel.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12 }}>选择目标成熟度等级:</h4>
                <Radio.Group
                  value={targetMaturity}
                  onChange={(e) => setTargetMaturity(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {[3, 4, 5].map((level) => {
                      const disabled = analysis ? level <= analysis.overall.maturityLevel : false
                      const levelNames = {
                        3: '充分规范级',
                        4: '系统优化级',
                        5: '卓越级',
                      }
                      return (
                        <Radio
                          key={level}
                          value={level}
                          disabled={disabled}
                          style={{
                            display: 'block',
                            padding: '12px',
                            border: '1px solid #d9d9d9',
                            borderRadius: 4,
                            backgroundColor: disabled ? '#f5f5f5' : 'white',
                          }}
                        >
                          <div>
                            <strong>Level {level} - {levelNames[level as 3 | 4 | 5]}</strong>
                            {disabled && <Tag color="default" style={{ marginLeft: 8 }}>已达成</Tag>}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            {level === 3 && '建立完善的数据安全管理制度和流程'}
                            {level === 4 && '持续优化并形成闭环管理机制'}
                            {level === 5 && '达到行业领先水平，具备最佳实践'}
                          </div>
                        </Radio>
                      )
                    })}
                  </Space>
                </Radio.Group>
              </div>

              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>或自定义目标成熟度:</h4>
                <InputNumber
                  min={analysis ? analysis.overall.maturityLevel + 0.1 : 1}
                  max={5}
                  step={0.1}
                  value={targetMaturity}
                  onChange={(value) => value && setTargetMaturity(value)}
                  style={{ width: 200 }}
                  precision={1}
                />
                <span style={{ marginLeft: 8, color: '#666' }}>
                  (范围: {analysis ? (analysis.overall.maturityLevel + 0.1).toFixed(1) : '1.0'} - 5.0)
                </span>
              </div>

              {analysis && targetMaturity > analysis.overall.maturityLevel && (
                <Alert
                  message={`将生成从 ${analysis.overall.maturityLevel.toFixed(2)} 提升到 ${targetMaturity.toFixed(1)} 的改进措施`}
                  description={`差距: ${(targetMaturity - analysis.overall.maturityLevel).toFixed(2)} 分`}
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </div>
          </Modal>
        </>
      )}
    </main>
  )
}
