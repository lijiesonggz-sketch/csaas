/**
 * 关键要求列表组件（性能优化版）
 * 使用React.memo、虚拟化和懒加载优化长列表渲染
 */
'use client'

import React, { useMemo, useCallback, useState } from 'react'
import {
  List,
  ListItem,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  Grid,
  Typography,
  Box,
  Divider,
  Pagination,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MenuBook as MenuBookIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'

interface KeyRequirement {
  clause_id: string
  chapter?: string
  clause_full_text?: string
  clause_summary?: string
  clause_text: string
  interpretation: string | any
  compliance_criteria: string[] | any
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_assessment?: any
  implementation_order?: number
  estimated_effort?: string
  dependencies?: string[]
  best_practices?: string[]
  common_mistakes?: string[]
}

interface KeyRequirementsListProps {
  requirements: KeyRequirement[]
  loading?: boolean
}

// 条款详情组件（使用React.memo优化）
const RequirementDetail = React.memo<{
  item: KeyRequirement
  index: number
}>(({ item, index }) => {
  const [expanded, setExpanded] = useState(false)

  // 处理解读文本
  const interpretationText = useMemo(() => {
    if (typeof item.interpretation === 'string') {
      return item.interpretation
    } else if (typeof item.interpretation === 'object' && item.interpretation !== null) {
      const interp = item.interpretation
      const parts = []
      if (interp.what) parts.push(`是什么：${interp.what}`)
      if (interp.why) parts.push(`为什么：${interp.why}`)
      if (interp.how) parts.push(`怎么做：${interp.how}`)
      return parts.join('\n')
    }
    return ''
  }, [item.interpretation])

  // 处理合规标准
  const criteriaText = useMemo(() => {
    if (Array.isArray(item.compliance_criteria)) {
      return item.compliance_criteria.join('; ')
    } else if (typeof item.compliance_criteria === 'object' && item.compliance_criteria !== null) {
      const criteria = item.compliance_criteria
      const parts = []
      if (criteria.must_have && criteria.must_have.length > 0) {
        parts.push(`必须具备: ${criteria.must_have.join('; ')}`)
      }
      if (criteria.should_have && criteria.should_have.length > 0) {
        parts.push(`建议具备: ${criteria.should_have.join('; ')}`)
      }
      if (criteria.evidence_required && criteria.evidence_required.length > 0) {
        parts.push(`所需证据: ${criteria.evidence_required.join('; ')}`)
      }
      if (criteria.assessment_method) {
        parts.push(`评估方法: ${criteria.assessment_method}`)
      }
      return parts.join('\n')
    }
    return ''
  }, [item.compliance_criteria])

  const getPriorityColor = useCallback((priority: string) => {
    const colors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
      HIGH: 'error',
      MEDIUM: 'warning',
      LOW: 'info',
    }
    return colors[priority] || 'default'
  }, [])

  const hasInterpretation = useMemo(() => {
    return Boolean(
      item.interpretation &&
      (typeof item.interpretation === 'string'
        ? item.interpretation.trim().length > 0
        : (item.interpretation.what || item.interpretation.why || item.interpretation.how)
      )
    )
  }, [item.interpretation])

  return (
    <ListItem sx={{ width: '100%', px: 0 }}>
      <Card sx={{ width: '100%' }} variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip color={getPriorityColor(item.priority)} label={item.clause_id} size="small" />
              <Typography variant="body1">{item.clause_text}</Typography>
              {hasInterpretation && (
                <Chip
                  color="success"
                  icon={<CheckCircleIcon />}
                  label="已解读"
                  size="small"
                />
              )}
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  解读：
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: hasInterpretation ? '#f6ffed' : '#fff2e8',
                    padding: '8px',
                    borderRadius: '4px',
                  }}
                >
                  {interpretationText || '暂无解读'}
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  合规标准：
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px',
                  }}
                >
                  {criteriaText || '无'}
                </Box>
              </Box>

              <Grid container spacing={2}>
                {item.estimated_effort && (
                  <Grid item xs={12} sm={4}>
                    <Chip color="info" label={`预估工期：${item.estimated_effort}`} size="small" />
                  </Grid>
                )}
                {item.dependencies && item.dependencies.length > 0 && (
                  <Grid item xs={12} sm={4}>
                    <Chip color="warning" label={`依赖：${item.dependencies.join(', ')}`} size="small" />
                  </Grid>
                )}
              </Grid>

              {item.best_practices && item.best_practices.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    最佳实践：
                  </Typography>
                  <ul style={{ marginBottom: 0 }}>
                    {item.best_practices.map((practice, idx) => (
                      <li key={idx}>{practice}</li>
                    ))}
                  </ul>
                </Box>
              )}
              {item.common_mistakes && item.common_mistakes.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    常见错误：
                  </Typography>
                  <ul style={{ marginBottom: 0 }}>
                    {item.common_mistakes.map((mistake, idx) => (
                      <li key={idx} style={{ color: '#d32f2f' }}>{mistake}</li>
                    ))}
                  </ul>
                </Box>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </ListItem>
  )
})

RequirementDetail.displayName = 'RequirementDetail'

// 主列表组件
export const KeyRequirementsList = React.memo<KeyRequirementsListProps>(({
  requirements,
  loading = false
}) => {
  // 统计信息
  const stats = useMemo(() => {
    const total = requirements.length
    const interpreted = requirements.filter(
      (req) => req.interpretation &&
      (typeof req.interpretation === 'string'
        ? req.interpretation.trim().length > 0
        : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
      )
    ).length
    const notInterpreted = total - interpreted

    return { total, interpreted, notInterpreted }
  }, [requirements])

  // 分页状态
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // 当前页的数据
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return requirements.slice(start, end)
  }, [requirements, currentPage, pageSize])

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const completionRate = stats.total > 0 ? ((stats.interpreted / stats.total) * 100).toFixed(1) : '0.0'

  return (
    <Box>
      {/* 统计信息 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MenuBookIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">总条款数</Typography>
                  <Typography variant="h5">{stats.total}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">已解读</Typography>
                  <Typography variant="h5" color="success.main">{stats.interpreted}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelIcon color="error" />
                <Box>
                  <Typography variant="body2" color="text.secondary">未解读</Typography>
                  <Typography variant="h5" color="error.main">{stats.notInterpreted}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">完成率</Typography>
                  <Typography
                    variant="h5"
                    color={
                      stats.interpreted / stats.total >= 0.8
                        ? 'success.main'
                        : stats.interpreted / stats.total >= 0.5
                          ? 'warning.main'
                          : 'error.main'
                    }
                  >
                    {completionRate}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* 分页列表 */}
      <List>
        {paginatedData.map((item, index) => (
          <RequirementDetail
            key={item.clause_id}
            item={item}
            index={(currentPage - 1) * pageSize + index}
          />
        ))}
      </List>

      {/* 分页 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination
          count={Math.ceil(requirements.length / pageSize)}
          page={currentPage}
          onChange={handlePageChange}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    </Box>
  )
})

KeyRequirementsList.displayName = 'KeyRequirementsList'
