'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Link,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Divider,
  TextField,
} from '@mui/material'
import {
  ExpandMore,
  CheckCircle,
  ContentCopy,
  FavoriteBorder,
  Share,
  MarkEmailRead,
  Warning,
  Security,
  Replay,
} from '@mui/icons-material'
import {
  CompliancePlaybook,
  ChecklistItem,
  Solution,
  getCompliancePlaybook,
  submitChecklist,
  markCompliancePushAsRead,
} from '@/lib/api/radar'
import { message } from 'antd'

/**
 * 应对剧本弹窗属性
 */
interface CompliancePlaybookModalProps {
  visible: boolean
  pushId: string
  organizationId: string  // 添加 organizationId 属性
  push?: {
    complianceRiskCategory?: string
    penaltyCase?: string
    policyRequirements?: string
  }
  onClose: () => void
}

/**
 * CompliancePlaybookModal组件 - 合规应对剧本弹窗
 *
 * Story 4.3 - Phase 4 Task 4.1-4.7
 *
 * 功能：
 * - 显示完整应对剧本内容（6个区域）
 * - 自查清单勾选和提交
 * - 整改方案对比表格
 * - 汇报模板复制
 * - 政策依据链接
 * - 加载状态管理（loading, generating, failed）
 */
export const CompliancePlaybookModal: React.FC<CompliancePlaybookModalProps> = ({
  visible,
  pushId,
  organizationId,
  push,
  onClose,
}) => {
  // 状态管理
  const [playbookStatus, setPlaybookStatus] = useState<'loading' | 'generating' | 'ready' | 'failed'>('loading')
  const [playbook, setPlaybook] = useState<CompliancePlaybook | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [copyButtonText, setCopyButtonText] = useState('复制汇报模板')
  const [retryCount, setRetryCount] = useState(0)  // 用于重试机制 (Issue #6)

  // 加载应对剧本数据 (Task 5.1) - 修复 Issue #6: 添加 retryCount 依赖
  useEffect(() => {
    const loadPlaybook = async () => {
      if (!pushId || !visible || !organizationId) return

      try {
        setPlaybookStatus('loading')
        const data = await getCompliancePlaybook(pushId, organizationId)
        setPlaybook(data)
        setPlaybookStatus('ready')

        // 加载本地保存的勾选状态
        const saved = localStorage.getItem(`checklist-${pushId}`)
        if (saved) {
          setCheckedItems(new Set(JSON.parse(saved)))
        }
      } catch (error: any) {
        // 剧本生成中，3秒后重试
        if (error.status === 202) {
          setPlaybookStatus('generating')
          setTimeout(() => loadPlaybook(), 3000)
        }
        // 剧本生成失败
        else if (error.status === 500) {
          setPlaybookStatus('failed')
        } else {
          message.error('获取应对剧本失败')
          setPlaybookStatus('failed')
        }
      }
    }

    loadPlaybook()
  }, [pushId, visible, organizationId, retryCount])  // 添加 retryCount 和 organizationId 依赖以支持重试

  // 持久化勾选状态 (Task 4.3)
  useEffect(() => {
    if (pushId && visible) {
      localStorage.setItem(`checklist-${pushId}`, JSON.stringify([...checkedItems]))
    }
  }, [checkedItems, pushId, visible])

  // 勾选/取消勾选自查项
  const handleToggleCheck = (itemId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // 提交自查结果 (Task 5.2)
  const handleSubmitChecklist = async () => {
    if (!playbook) return

    // 数据完整性验证
    const checkedArray = Array.from(checkedItems)
    const uncheckedArray = playbook.checklistItems
      .filter((item) => !checkedItems.has(item.id))
      .map((item) => item.id)

    if (checkedArray.length === 0) {
      message.error('至少需要勾选一项')
      return
    }

    try {
      await submitChecklist(pushId, organizationId, {
        checkedItems: checkedArray,
        uncheckedItems: uncheckedArray,
      })

      message.success('自查完成！建议选择整改方案并向上级汇报')
      setSubmitted(true)
    } catch (error: any) {
      if (error.status === 400) {
        message.error('数据不完整，请检查所有项目')
      } else if (error.status === 404) {
        message.error('应对剧本不存在')
      } else {
        message.error('提交失败，请稍后重试')
      }
    }
  }

  // 复制汇报模板 (Task 4.5)
  const handleCopyTemplate = async () => {
    if (!playbook) return

    const reportTemplate = playbook.reportTemplate

    // 优先使用 clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(reportTemplate)
        message.success('已复制！可直接粘贴到邮件或报告中')
        setCopyButtonText('已复制！')
        setTimeout(() => setCopyButtonText('复制汇报模板'), 1000)
        return
      } catch (err) {
        console.warn('Clipboard API failed, falling back to execCommand', err)
      }
    }

    // 降级方案: execCommand
    const textarea = document.createElement('textarea')
    textarea.value = reportTemplate
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (successful) {
      message.success('已复制！请手动粘贴 (Ctrl+C)')
      setCopyButtonText('已复制！')
      setTimeout(() => setCopyButtonText('复制汇报模板'), 1000)
    } else {
      message.error('复制失败，请手动选择文本复制')
    }
  }

  // 计算完成进度
  const completedCount = checkedItems.size
  const totalCount = playbook?.checklistItems.length || 0
  const isAllChecked = completedCount === totalCount && totalCount > 0

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      maxWidth={false}  // 修复 Issue #4: 禁用预设 maxWidth,使用自定义宽度
      sx={{
        '& .MuiDialog-paper': {
          width: '800px',
          maxWidth: '800px',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="error" />
          <Typography variant="h5" fontWeight="bold">
            合规应对剧本
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 加载状态 (Task 5.1) */}
        {playbookStatus === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress color="error" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              正在加载应对剧本...
            </Typography>
          </Box>
        )}

        {/* 生成中状态 */}
        {playbookStatus === 'generating' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress color="warning" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              正在生成应对剧本，请稍候...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (系统将在3秒后自动重试)
            </Typography>
          </Box>
        )}

        {/* 失败状态 - 修复 Issue #6: 使用 retryCount 而不是页面重载 */}
        {playbookStatus === 'failed' && (
          <Box sx={{ py: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              应对剧本生成失败，请联系管理员
            </Alert>
            <Button
              variant="outlined"
              startIcon={<Replay />}
              onClick={() => setRetryCount(prev => prev + 1)}
            >
              重试
            </Button>
          </Box>
        )}

        {/* 准备就绪 - 显示完整内容 */}
        {playbookStatus === 'ready' && playbook && (
          <Box sx={{ mt: 1 }}>
            {/* Part 1: 风险详情区域 (Task 4.2) */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning color="error" />
                  <Typography fontWeight="bold">风险详情</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* 风险类别 - 修复 Issue #3: 使用 push.complianceRiskCategory */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        风险类别：
                      </Typography>
                      <Chip label={push?.complianceRiskCategory || '合规风险'} color="error" size="small" />
                    </Box>
                  </Grid>

                  {/* 政策要求 - 修复 Issue #2, #5 (Code Review 2026-01-31): 从真实数据读取 + 格式验证 */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      政策要求：
                    </Typography>
                    {push?.policyRequirements ? (
                      <List dense>
                        {(() => {
                          // 修复 Issue #5: 智能分割政策要求，支持多种格式
                          // 1. 尝试按换行符分割
                          // 2. 如果分割后只有1项且很长，尝试按句号分割
                          let requirements = push.policyRequirements.split('\n').filter(r => r.trim())
                          if (requirements.length === 1 && requirements[0].length > 100) {
                            requirements = requirements[0].split(/。(?=[^。]*$)/).filter(r => r.trim())
                            if (requirements.length === 1) {
                              requirements = requirements[0].split(/；/).filter(r => r.trim())
                            }
                          }
                          return requirements.map((req, idx) => (
                            <ListItem key={idx}>
                              <ListItemText primary={`• ${req.trim()}`} />
                            </ListItem>
                          ))
                        })()}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        暂无政策要求信息
                      </Typography>
                    )}
                  </Grid>

                  {/* 信息来源 */}
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      生成时间: {new Date(playbook.generatedAt).toLocaleString('zh-CN')}
                    </Typography>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Part 2: 自查清单区域 (Task 4.3) */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  <Typography fontWeight="bold">自查清单</Typography>
                  <Chip
                    label={`已完成 ${completedCount}/${totalCount}`}
                    size="small"
                    color={isAllChecked ? 'success' : 'default'}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {playbook.checklistItems.map((item) => (
                    <ListItem
                      key={item.id}
                      button
                      onClick={() => handleToggleCheck(item.id)}
                      sx={{ borderRadius: 1, mb: 1, border: '1px solid', borderColor: 'divider' }}
                    >
                      <Checkbox
                        edge="start"
                        checked={checkedItems.has(item.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" component="span">
                              {item.order + 1}. {item.text}
                            </Typography>
                            <Chip label={item.category} size="small" variant="outlined" />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>

                {/* 提交按钮 */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={!isAllChecked || submitted}
                    onClick={handleSubmitChecklist}
                    startIcon={<CheckCircle />}
                  >
                    {submitted ? '已提交' : '提交自查结果'}
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Part 3: 整改方案对比区域 (Task 4.4) */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontWeight="bold">整改方案对比</Typography>
                  <Chip label="推荐方案已高亮" size="small" color="success" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>方案名称</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>投入成本</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>预期收益</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>ROI评分</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>实施周期</TableCell>
                      </TableRow>
                      {playbook.solutions.map((solution) => {
                        const maxRoiScore = Math.max(...playbook.solutions.map((s) => s.roiScore))
                        const isRecommended = solution.roiScore === maxRoiScore

                        return (
                          <TableRow
                            key={solution.name}
                            sx={{
                              backgroundColor: isRecommended ? 'success.light' : 'inherit',
                              fontWeight: isRecommended ? 'bold' : 'normal',
                            }}
                          >
                            <TableCell>
                              {solution.name}
                              {isRecommended && (
                                <Chip label="推荐" size="small" color="success" sx={{ ml: 1 }} />
                              )}
                            </TableCell>
                            <TableCell>¥{solution.estimatedCost.toLocaleString()}</TableCell>
                            <TableCell>¥{solution.expectedBenefit.toLocaleString()}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 60,
                                    height: 6,
                                    bgcolor: 'grey.200',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: `${(solution.roiScore / 10) * 100}%`,
                                      height: '100%',
                                      bgcolor: isRecommended ? 'success.main' : 'primary.main',
                                    }}
                                  />
                                </Box>
                                <Typography variant="body2">{solution.roiScore.toFixed(1)}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{solution.implementationTime}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>

            {/* Part 4: 汇报模板区域 (Task 4.5) */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontWeight="bold">汇报模板</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    mb: 2,
                  }}
                >
                  {playbook.reportTemplate}
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  onClick={handleCopyTemplate}
                  fullWidth
                >
                  {copyButtonText}
                </Button>
              </AccordionDetails>
            </Accordion>

            {/* Part 5: 政策依据区域 (Task 4.6) */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontWeight="bold">政策依据</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {playbook.policyReference.map((policy, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={
                          // 修复 Issue #2 (Code Review 2026-01-31): 使用真实的 policy URL
                          // 如果 policy 是有效 URL (http/https)，则使用 Link 组件
                          // 否则显示为普通文本（可能是政策名称或描述）
                          /^https?:\/\//.test(policy) ? (
                            <Link
                              href={policy}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'primary.main' }}
                            >
                              {policy}
                            </Link>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {policy}
                            </Typography>
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </DialogContent>

      {/* Part 6: 操作按钮区域 (Task 4.7) - 修复 Issue #1: 添加实际功能 */}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          startIcon={<FavoriteBorder />}
          color="secondary"
          onClick={() => {
            message.info('收藏功能开发中')
          }}
        >
          收藏
        </Button>
        <Button
          startIcon={<Share />}
          onClick={() => {
            // 复制分享链接到剪贴板
            const shareUrl = `${window.location.origin}/radar/compliance?pushId=${pushId}`
            navigator.clipboard.writeText(shareUrl).then(() => {
              message.success('分享链接已复制到剪贴板')
            }).catch(() => {
              message.error('复制失败，请手动复制链接')
            })
          }}
        >
          分享
        </Button>
        <Button
          startIcon={<MarkEmailRead />}
          onClick={async () => {
            try {
              await markCompliancePushAsRead(pushId)
              message.success('已标记为已读')
              onClose()
            } catch (error) {
              message.error('标记失败，请稍后重试')
            }
          }}
        >
          标记已读
        </Button>
        <Divider orientation="vertical" flexItem />
        <Button onClick={onClose} variant="outlined">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  )
}
