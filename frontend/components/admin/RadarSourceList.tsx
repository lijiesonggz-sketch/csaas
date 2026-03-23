'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Typography,
  Switch,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * RadarSourceList 组件属性
 */
interface RadarSourceListProps {
  sources: RadarSource[]
  loading?: boolean
  error?: string | null
  onEdit: (source: RadarSource) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTestCrawl: (id: string) => void
}

/**
 * 类别标签配置
 */
const categoryConfig: Record<
  'tech' | 'industry' | 'compliance',
  { label: string; color: 'primary' | 'secondary' | 'warning' }
> = {
  tech: { label: '技术雷达', color: 'primary' },
  industry: { label: '行业雷达', color: 'secondary' },
  compliance: { label: '合规雷达', color: 'warning' },
}

/**
 * 类型标签配置
 */
const typeConfig: Record<
  'wechat' | 'recruitment' | 'conference' | 'website',
  { label: string; icon: string }
> = {
  wechat: { label: '微信公众号', icon: '💬' },
  recruitment: { label: '招聘网站', icon: '💼' },
  conference: { label: '会议/活动', icon: '🎤' },
  website: { label: '网站', icon: '🌐' },
}

/**
 * 状态标签配置
 */
const statusConfig: Record<
  'pending' | 'success' | 'failed',
  { label: string; color: 'default' | 'success' | 'error' }
> = {
  pending: { label: '待爬取', color: 'default' },
  success: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
}

/**
 * RadarSourceList 组件
 *
 * Story 3.1: 信息源配置管理列表
 *
 * 功能：
 * - 显示所有信息源配置
 * - 支持启用/禁用切换
 * - 支持编辑、删除操作
 * - 支持测试爬虫功能
 * - 显示最后爬取状态
 */
export function RadarSourceList({
  sources,
  loading = false,
  error = null,
  onEdit,
  onCreate,
  onDelete,
  onToggleActive,
  onTestCrawl,
}: RadarSourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个信息源吗？')) {
      setDeletingId(id)
      try {
        await onDelete(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleTestCrawl = async (id: string) => {
    setTestingId(id)
    try {
      await onTestCrawl(id)
    } finally {
      setTestingId(null)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  return (
    <Box>
      {/* 头部操作栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h1">
          雷达信息源配置
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreate}
        >
          添加信息源
        </Button>
      </Box>

      {/* 信息源列表 */}
      {sources.length === 0 ? (
        <Alert severity="info">
          暂无信息源配置，点击"添加信息源"按钮创建第一个信息源。
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>信息源名称</TableCell>
                <TableCell>类别</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>同业机构</TableCell>
                <TableCell>爬取频率</TableCell>
                <TableCell>最后爬取状态</TableCell>
                <TableCell>启用状态</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {source.source}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={categoryConfig[source.category].label}
                      color={categoryConfig[source.category].color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{typeConfig[source.type].icon}</span>
                      <Typography variant="body2">
                        {typeConfig[source.type].label}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={source.url}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {source.url}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {source.peerName ? (
                      <Typography variant="body2">{source.peerName}</Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {source.crawlSchedule}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Chip
                        label={statusConfig[source.lastCrawlStatus].label}
                        color={statusConfig[source.lastCrawlStatus].color}
                        size="small"
                      />
                      {source.lastCrawledAt && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(source.lastCrawledAt).toLocaleString('zh-CN')}
                        </Typography>
                      )}
                      {source.lastCrawlError && (
                        <Tooltip title={source.lastCrawlError}>
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{
                              maxWidth: 150,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {source.lastCrawlError}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={source.isActive}
                      onChange={() => onToggleActive(source.id)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="测试爬虫">
                        <IconButton
                          size="small"
                          onClick={() => handleTestCrawl(source.id)}
                          disabled={testingId === source.id}
                          aria-label={`测试 ${source.source} 爬虫`}
                        >
                          {testingId === source.id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <TestIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          onClick={() => onEdit(source)}
                          aria-label={`编辑 ${source.source}`}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(source.id)}
                          disabled={deletingId === source.id}
                          aria-label={`删除 ${source.source}`}
                        >
                          {deletingId === source.id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <DeleteIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
