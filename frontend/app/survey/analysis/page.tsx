'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Card,
  Spin,
  Alert,
  Button,
  Statistic,
  Row,
  Col,
  Collapse,
  Tag,
  Descriptions,
  Divider,
  Space,
  Progress,
  message,
  Modal,
  Radio,
  InputNumber,
} from 'antd'
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  TrophyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  RiseOutlined,
  FallOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { SurveyAPI } from '@/lib/api/survey'

const { Panel } = Collapse

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

export default function SurveyAnalysisPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const surveyId = searchParams?.get('surveyId')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MaturityAnalysisResult | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [targetMaturity, setTargetMaturity] = useState<number>(4)

  useEffect(() => {
    if (!surveyId) {
      setError('缺少问卷ID参数')
      setLoading(false)
      return
    }

    fetchAnalysis()
  }, [surveyId])

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await SurveyAPI.analyzeSurvey(surveyId!)

      if (response.success) {
        setAnalysis(response.data)
        message.success('成熟度分析完成')
      } else {
        throw new Error(response.message || '分析失败')
      }
    } catch (err: any) {
      console.error('分析失败:', err)
      setError(err.message || '加载成熟度分析失败')
      message.error(err.message || '加载成熟度分析失败')
    } finally {
      setLoading(false)
    }
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

    // 跳转到落地措施生成页面
    router.push(`/ai-generation/action-plan?surveyId=${surveyId}&targetMaturity=${targetMaturity}`)
    setModalVisible(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="正在分析成熟度..." />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 24px' }}>
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 24px' }}>
        <Alert message="未找到分析结果" description="未能找到该问卷的分析结果" type="info" showIcon />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>成熟度分析报告</h1>
            <div style={{ color: '#666', fontSize: 14 }}>
              <div>
                调研对象: {analysis.respondentInfo.name}
                {analysis.respondentInfo.department && ` - ${analysis.respondentInfo.department}`}
                {analysis.respondentInfo.position && ` - ${analysis.respondentInfo.position}`}
              </div>
              <div>提交时间: {new Date(analysis.respondentInfo.submittedAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
              返回
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
              打印报告
            </Button>
          </Space>
        </div>
      </div>

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
            <div style={{ textAlign: 'center' }}>
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

      {/* 各聚类详情 */}
      <Card title={<Space><TrophyOutlined />各聚类详细成熟度 ({analysis.clusterMaturity.length}个)</Space>}>
        <Collapse accordion>
          {analysis.clusterMaturity.map((cluster) => (
            <Panel
              header={
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
              }
              key={cluster.cluster_id}
              extra={
                <code style={{ fontSize: 11, backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
                  {cluster.calculation}
                </code>
              }
            >
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
            </Panel>
          ))}
        </Collapse>
      </Card>

      {/* 底部操作 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Space size="large">
          <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
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
    </div>
  )
}
