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
 * PeerCrawlerSourceList 组件属性
 */
interface PeerCrawlerSourceListProps {
  sources: RadarSource[]
  loading?: boolean
  error?: string | null
  onEdit: (source: RadarSource) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTestCrawl: (source: RadarSource) => void
}

/**
 * 类型标签配置
 */
const typeConfig: Record<
  'wechat' | 'recruitment' | 'conference' | 'website',
  { label: string; color: 'default' | 'primary' | 'secondary' | 'info' | 'success' }
> = {
  website: { label: '官网', color: 'primary' },
  wechat: { label: '公众号', color: 'success' },
  recruitment: { label: '招聘', color: 'secondary' },
  conference: { label: '会议', color: 'info' },
}

/**
 * 状态标签配置
 */
const statusConfig: Record<
  'pending' | 'success' | 'failed',
  { label: string; color: 'default' | 'success' | 'error' }
> = {
  pending: { label: '待采集', color: 'default' },
  success: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
}

/**
 * PeerCrawlerSourceList 组件
 *
 * Story 8.1: 同业采集源管理列表
 *
 * 功能：
 * - 显示同业采集源配置
 * - 支持启用/禁用切换
 * - 支持编辑、删除操作
 * - 支持测试采集功能
 * - 显示最后采集状态和成功率
 */
export function PeerCrawlerSourceList({
  sources,
  loading = false,
  error = null,
  onEdit,
  onCreate,
  onDelete,
  onToggleActive,
  onTestCrawl,
}: PeerCrawlerSourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个采集源吗？')) {
      setDeletingId(id)
      try {
        await onDelete(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleTestCrawl = async (source: RadarSource) => {
    setTestingId(source.id)
    try {
      await onTestCrawl(source)
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
        <Typography variant="h6" component="h2">
          采集源列表
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({sources.length} 个)
          </Typography>
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreate}
        >
          添加采集源
        </Button>
      </Box>

      {/* 采集源列表 */}
      {sources.length === 0 ? (
        <Alert severity="info">
          暂无采集源配置，点击"添加采集源"按钮创建第一个采集源。
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>同业机构名称</TableCell>
                <TableCell>来源类型</TableCell>
                <TableCell>采集URL</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>上次采集时间</TableCell>
                <TableCell>成功率</TableCell>
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
                    {source.peerName && (
                      <Typography variant="caption" color="text.secondary">
                        {source.peerName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={typeConfig[source.type].label}
                      color={typeConfig[source.type].color}
                      size="small"
                    />
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={statusConfig[source.lastCrawlStatus].label}
                        color={statusConfig[source.lastCrawlStatus].color}
                        size="small"
                      />
                      <Switch
                        checked={source.isActive}
                        onChange={() => onToggleActive(source.id)}
                        color="primary"
                        size="small"
                      />
                    </Box>
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
                            display: 'block',
                          }}
                        >
                          {source.lastCrawlError}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {source.lastCrawledAt ? (
                      <Typography variant="body2">
                        {new Date(source.lastCrawledAt).toLocaleString('zh-CN')}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        从未采集
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* TODO: 从API获取成功率 */}
                    <Typography variant="body2" color="text.secondary">
                      --
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="测试采集">
                        <IconButton
                          size="small"
                          onClick={() => handleTestCrawl(source)}
                          disabled={testingId === source.id}
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
