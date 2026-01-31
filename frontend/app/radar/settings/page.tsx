'use client'

/**
 * 雷达配置管理页面 (Story 5.1 - Phase 3)
 *
 * 功能：
 * - 显示关注技术领域列表
 * - 添加关注领域（预设选项 + 自定义输入）
 * - 删除关注领域（带确认）
 * - 空状态友好提示
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
  Skeleton,
  Modal,
  TextField,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import { Button, Empty, message } from 'antd'
import { Add, Delete } from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getWatchedTopics,
  createWatchedTopic,
  deleteWatchedTopic,
  WatchedTopic,
  CreateWatchedTopicDto,
  getWatchedPeers,
  createWatchedPeer,
  deleteWatchedPeer,
  WatchedPeer,
  CreateWatchedPeerDto,
} from '@/lib/api/radar'
import { INSTITUTION_PRESETS, INDUSTRY_LABELS, IndustryKey } from '@/lib/constants/institution-presets'

// 预设技术领域选项
const PRESET_TOPICS = [
  { name: '云原生', desc: '容器化、微服务、Kubernetes等' },
  { name: 'AI应用', desc: '机器学习、大模型、智能客服等' },
  { name: '移动金融安全', desc: '移动端安全、生物识别等' },
  { name: '成本优化', desc: 'FinOps、资源优化等' },
  { name: 'DevOps', desc: 'CI/CD、自动化运维等' },
  { name: '数据安全', desc: '数据加密、隐私保护等' },
  { name: '区块链', desc: '分布式账本、智能合约等' },
  { name: '开放银行', desc: 'Open API、生态合作等' },
]

export default function RadarSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [topics, setTopics] = useState<WatchedTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)

  // Story 5.2: WatchedPeer state
  const [peers, setPeers] = useState<WatchedPeer[]>([])
  const [peersLoading, setPeersLoading] = useState(true)
  const [addPeerModalVisible, setAddPeerModalVisible] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryKey>('banking')
  const [selectedPeer, setSelectedPeer] = useState('')
  const [customPeerName, setCustomPeerName] = useState('')
  const [customInstitutionType, setCustomInstitutionType] = useState('')
  const [peerSubmitting, setPeerSubmitting] = useState(false)

  // 获取 organizationId：优先从 URL 参数，其次从 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 优先从 URL 参数获取
      const urlOrgId = searchParams.get('orgId')
      if (urlOrgId) {
        setOrganizationId(urlOrgId)
        // 同时保存到 localStorage 以便后续使用
        localStorage.setItem('organizationId', urlOrgId)
      } else {
        // 如果 URL 没有，尝试从 localStorage 获取
        const storedOrgId = localStorage.getItem('organizationId')
        if (storedOrgId) {
          setOrganizationId(storedOrgId)
        } else {
          setAuthError(true)
          message.error('未找到组织信息，请从雷达首页进入')
        }
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (organizationId) {
      loadTopics()
      loadPeers()
    }
  }, [organizationId])

  const loadTopics = async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      const data = await getWatchedTopics(organizationId)
      setTopics(data)
    } catch (error: any) {
      message.error(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!organizationId) {
      message.error('组织信息缺失，无法添加')
      return
    }

    const topicName = selectedTopic || customTopic
    if (!topicName) {
      message.warning('请选择或输入领域名称')
      return
    }

    setSubmitting(true)
    try {
      await createWatchedTopic(organizationId, {
        topicName,
        topicType: 'tech',
      })
      message.success('已添加关注领域!系统将推送相关技术趋势')
      setAddModalVisible(false)
      setSelectedTopic('')
      setCustomTopic('')
      loadTopics()
    } catch (error: any) {
      message.error(error.message || '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (topicId: string, topicName: string) => {
    // 使用Ant Design的Modal.confirm
    const { Modal: AntModal } = require('antd')
    AntModal.confirm({
      title: '确定取消关注该领域吗?',
      content: `取消后,系统将不再推送"${topicName}"相关内容`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!organizationId) {
          message.error('组织信息缺失')
          return
        }
        try {
          await deleteWatchedTopic(topicId, organizationId)
          message.success('已取消关注')
          loadTopics()
        } catch (error: any) {
          message.error(error.message || '删除失败')
        }
      },
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Story 5.2: Load watched peers
  const loadPeers = async () => {
    if (!organizationId) return

    setPeersLoading(true)
    try {
      const data = await getWatchedPeers(organizationId)
      setPeers(data)
    } catch (error: any) {
      message.error(error.message || '加载关注同业失败')
    } finally {
      setPeersLoading(false)
    }
  }

  // Story 5.2: Add watched peer
  const handleAddPeer = async () => {
    if (!organizationId) {
      message.error('组织信息缺失，无法添加')
      return
    }

    let peerName = ''
    let industry = selectedIndustry
    let institutionType = ''

    if (selectedPeer) {
      const preset = INSTITUTION_PRESETS[selectedIndustry].find((p) => p.name === selectedPeer)
      if (preset) {
        peerName = preset.name
        institutionType = preset.type
      }
    } else if (customPeerName && customInstitutionType) {
      peerName = customPeerName
      institutionType = customInstitutionType
    }

    if (!peerName || !institutionType) {
      message.warning('请选择或输入完整的同业机构信息')
      return
    }

    setPeerSubmitting(true)
    try {
      await createWatchedPeer(organizationId, {
        peerName,
        industry,
        institutionType,
      })
      message.success('已添加关注同业!系统将推送相关行业动态')
      setAddPeerModalVisible(false)
      setSelectedPeer('')
      setCustomPeerName('')
      setCustomInstitutionType('')
      loadPeers()
    } catch (error: any) {
      message.error(error.message || '添加失败')
    } finally {
      setPeerSubmitting(false)
    }
  }

  // Story 5.2: Delete watched peer
  const handleDeletePeer = (peerId: string, peerName: string) => {
    const { Modal: AntModal } = require('antd')
    AntModal.confirm({
      title: '确定取消关注该同业机构吗?',
      content: `取消后,系统将不再推送"${peerName}"相关内容`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!organizationId) {
          message.error('组织信息缺失')
          return
        }
        try {
          await deleteWatchedPeer(peerId, organizationId)
          message.success('已取消关注')
          loadPeers()
        } catch (error: any) {
          message.error(error.message || '删除失败')
        }
      },
    })
  }

  // Story 5.2: Get industry and institution type labels
  const getIndustryLabel = (industry: string) => {
    return INDUSTRY_LABELS[industry as IndustryKey] || industry
  }

  const getInstitutionTypeLabel = (type: string) => {
    return type
  }

  // 如果认证失败，显示错误状态
  if (authError) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="error" sx={{ mb: 2 }}>
          无法访问
        </Typography>
        <Typography variant="body1" color="text.secondary">
          未找到组织信息，请从雷达首页进入
        </Typography>
        <Button type="primary" onClick={() => router.push('/radar')} sx={{ mt: 2 }}>
          返回雷达首页
        </Button>
      </Box>
    )
  }

  // 等待 organizationId 加载
  if (!organizationId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 面包屑导航 */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink
          href={`/radar${organizationId ? `?orgId=${organizationId}` : ''}`}
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.preventDefault()
            router.push(`/radar${organizationId ? `?orgId=${organizationId}` : ''}`)
          }}
        >
          雷达首页
        </MuiLink>
        <Typography color="text.primary">配置管理</Typography>
      </Breadcrumbs>

      {/* 页面标题 */}
      <Typography variant="h4" sx={{ mt: 2, mb: 3 }}>
        雷达配置管理
      </Typography>

      {/* 关注技术领域配置区域 */}
      <Card>
        <CardHeader
          title="关注技术领域"
          action={
            <Button
              type="primary"
              icon={<Add />}
              onClick={() => setAddModalVisible(true)}
            >
              添加关注领域
            </Button>
          }
        />
        <CardContent>
          {loading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rectangular" height={120} />
                </Grid>
              ))}
            </Grid>
          ) : topics.length === 0 ? (
            <Empty description="暂无关注领域,点击上方按钮添加" />
          ) : (
            <Grid container spacing={2}>
              {topics.map((topic) => (
                <Grid item xs={12} sm={6} md={4} key={topic.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {topic.topicName}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(topic.id, topic.topicName)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        添加时间: {formatDate(topic.createdAt)}
                      </Typography>
                      {topic.relatedPushCount !== undefined && topic.relatedPushCount > 0 && (
                        <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                          已推送 {topic.relatedPushCount} 条相关内容
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Story 5.2: 关注同业机构配置区域 */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title="关注同业机构"
          action={
            <Button
              type="primary"
              icon={<Add />}
              onClick={() => setAddPeerModalVisible(true)}
            >
              添加关注同业
            </Button>
          }
        />
        <CardContent>
          {peersLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rectangular" height={120} />
                </Grid>
              ))}
            </Grid>
          ) : peers.length === 0 ? (
            <Empty description="暂无关注同业,点击上方按钮添加" />
          ) : (
            <Grid container spacing={2}>
              {peers.map((peer) => (
                <Grid item xs={12} sm={6} md={4} key={peer.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>
                            {peer.peerName}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                            <Chip
                              label={getIndustryLabel(peer.industry)}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                            <Chip
                              label={peer.institutionType}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeletePeer(peer.id, peer.peerName)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        添加时间: {formatDate(peer.createdAt)}
                      </Typography>
                      {peer.relatedPushCount !== undefined && peer.relatedPushCount > 0 && (
                        <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                          已推送 {peer.relatedPushCount} 条相关内容
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* 添加关注领域弹窗 */}
      <Modal
        open={addModalVisible}
        onClose={() => !submitting && setAddModalVisible(false)}
        aria-labelledby="add-topic-modal"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
            添加关注领域
          </Typography>

          {/* 预设选项 */}
          <RadioGroup
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value)
              setCustomTopic('')
            }}
          >
            {PRESET_TOPICS.map((topic) => (
              <FormControlLabel
                key={topic.name}
                value={topic.name}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">{topic.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {topic.desc}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
            ))}
          </RadioGroup>

          <Divider sx={{ my: 2 }}>或</Divider>

          {/* 自定义输入 */}
          <TextField
            fullWidth
            label="自定义领域名称"
            value={customTopic}
            onChange={(e) => {
              setCustomTopic(e.target.value)
              setSelectedTopic('')
            }}
            placeholder="输入自定义技术领域"
            disabled={submitting}
          />

          {/* 操作按钮 */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setAddModalVisible(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="primary" onClick={handleAdd} loading={submitting}>
              确认
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Story 5.2: 添加关注同业弹窗 */}
      <Modal
        open={addPeerModalVisible}
        onClose={() => !peerSubmitting && setAddPeerModalVisible(false)}
        aria-labelledby="add-peer-modal"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
            添加关注同业
          </Typography>

          {/* 行业选择 */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>行业类别</InputLabel>
            <Select
              value={selectedIndustry}
              label="行业类别"
              onChange={(e) => {
                setSelectedIndustry(e.target.value as IndustryKey)
                setSelectedPeer('')
              }}
              disabled={peerSubmitting}
            >
              {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 预设选项 */}
          <RadioGroup
            value={selectedPeer}
            onChange={(e) => {
              setSelectedPeer(e.target.value)
              setCustomPeerName('')
            }}
          >
            {INSTITUTION_PRESETS[selectedIndustry].map((peer) => (
              <FormControlLabel
                key={peer.name}
                value={peer.name}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">{peer.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {peer.type} - {peer.desc}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
            ))}
          </RadioGroup>

          <Divider sx={{ my: 2 }}>或</Divider>

          {/* 自定义输入 */}
          <TextField
            fullWidth
            label="自定义机构名称"
            value={customPeerName}
            onChange={(e) => {
              setCustomPeerName(e.target.value)
              setSelectedPeer('')
            }}
            placeholder="输入自定义机构名称"
            disabled={peerSubmitting}
            sx={{ mb: 2 }}
          />

          {/* 自定义类型输入 */}
          {customPeerName && (
            <TextField
              fullWidth
              label="机构类型"
              value={customInstitutionType}
              onChange={(e) => setCustomInstitutionType(e.target.value)}
              placeholder="例如：城商行、券商、寿险公司"
              helperText="请输入机构的具体类型"
              disabled={peerSubmitting}
              sx={{ mb: 2 }}
            />
          )}

          {/* 操作按钮 */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setAddPeerModalVisible(false)} disabled={peerSubmitting}>
              取消
            </Button>
            <Button type="primary" onClick={handleAddPeer} loading={peerSubmitting}>
              确认
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  )
}
