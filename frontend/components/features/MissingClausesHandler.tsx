'use client'

/**
 * 缺失条款处理组件
 * 用于显示和分配缺失的条款到聚类
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Plus, CheckCircle, AlertTriangle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ClusterClause {
  source_document_id: string
  source_document_name: string
  clause_id: string
  clause_text: string
  rationale: string
}

interface Cluster {
  id: string
  name: string
  description: string
  clauses: ClusterClause[]
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface Category {
  id: string
  name: string
  description: string
  clusters: Cluster[]
}

interface DocumentCoverage {
  total_clauses: number
  clustered_clauses: number
  missing_clause_ids: string[]
}

interface MissingClauseInfo {
  clauseId: string
  documentId: string
  documentName: string
  clauseText: string
}

interface Props {
  taskId: string // 任务ID，用于保存到后端
  coverageByDocument: Record<string, DocumentCoverage>
  documents: Array<{ id: string; name: string; content: string }>
  categories: Category[]
  onUpdateClustering: (updatedCategories: Category[]) => void
}

export default function MissingClausesHandler({
  taskId,
  coverageByDocument,
  documents,
  categories,
  onUpdateClustering,
}: Props) {
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [newClusterModalVisible, setNewClusterModalVisible] = useState(false)
  const [selectedMissingClause, setSelectedMissingClause] = useState<MissingClauseInfo | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({}) // clauseId -> clusterId
  const [saving, setSaving] = useState(false) // 保存到后端的状态
  const [saveError, setSaveError] = useState<string | null>(null) // 保存错误
  const [formData, setFormData] = useState({
    clusterName: '',
    clusterDescription: '',
    rationale: '',
    importance: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    riskLevel: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
  })

  // 提取所有缺失条款信息
  const extractMissingClauses = (): MissingClauseInfo[] => {
    const missingClauses: MissingClauseInfo[] = []

    // 遍历每个文档
    documents.forEach((doc) => {
      // 从文档内容中提取所有条款ID
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = [...new Set(allClauseMatches)] // 去重

      // 从categories中提取该文档已聚类的条款ID
      const clusteredClauseIds = new Set<string>()
      categories.forEach((category) => {
        category.clusters.forEach((cluster) => {
          cluster.clauses.forEach((clause) => {
            if (clause.source_document_id === doc.id) {
              clusteredClauseIds.add(clause.clause_id)
            }
          })
        })
      })

      // 找出缺失的条款
      const missingIds = allClauseIds.filter((id) => !clusteredClauseIds.has(id))

      if (missingIds.length > 0) {
        missingIds.forEach((clauseId) => {
          // 从文档内容中提取条款文本（修复：从条款标题提取到下一个条款标题之前）
          const regex = new RegExp(`${clauseId}([\\s\\S]*?)(?=第[一二三四五六七八九十百千]+条|$)`, 'i')
          const match = doc.content.match(regex)
          let clauseText = '条款内容未找到'

          if (match) {
            // 提取内容并截断到合理长度（最多300字）
            clauseText = match[1].trim().substring(0, 300)
            // 如果截断了，添加省略号
            if (match[1].trim().length > 300) {
              clauseText += '...'
            }
          }

          missingClauses.push({
            clauseId,
            documentId: doc.id,
            documentName: doc.name,
            clauseText,
          })
        })
      }
    })

    return missingClauses
  }

  const missingClauses = extractMissingClauses()

  // 检查是否有覆盖率不完整的情况
  const hasIncompleteCoverage = Object.values(coverageByDocument).some(
    (stats) => (stats.missing_clause_ids?.length || 0) > 0 || stats.clustered_clauses < stats.total_clauses
  )
  const getClusterOptions = () => {
    return categories.flatMap((category) => ({
      category,
      clusters: category.clusters,
    }))
  }

  // 处理分配到现有聚类
  const handleAssignToCluster = (missingClause: MissingClauseInfo) => {
    setSelectedMissingClause(missingClause)
    setAssignModalVisible(true)
  }

  // 确认分配
  const confirmAssign = () => {
    if (!selectedMissingClause || !selectedClusterId) return

    // 更新分配记录
    setAssignments({
      ...assignments,
      [selectedMissingClause.clauseId]: selectedClusterId,
    })

    setAssignModalVisible(false)
    setSelectedMissingClause(null)
    setSelectedClusterId(null)
  }

  // 处理新建聚类
  const handleCreateNewCluster = (missingClause: MissingClauseInfo) => {
    setSelectedMissingClause(missingClause)
    setNewClusterModalVisible(true)
  }

  // 确认新建聚类
  const confirmCreateCluster = async () => {
    if (!selectedMissingClause) return
    if (!formData.clusterName.trim()) return

    try {
      // 找到第一个大类，或者让用户选择
      const targetCategory = categories[0]

      // 创建新聚类
      const newCluster: Cluster = {
        id: `cluster_${Date.now()}`,
        name: formData.clusterName,
        description: formData.clusterDescription || '用户手动创建的聚类',
        clauses: [
          {
            source_document_id: selectedMissingClause.documentId,
            source_document_name: selectedMissingClause.documentName,
            clause_id: selectedMissingClause.clauseId,
            clause_text: selectedMissingClause.clauseText,
            rationale: formData.rationale || '用户手动添加的缺失条款',
          },
        ],
        importance: formData.importance || 'MEDIUM',
        risk_level: formData.riskLevel || 'MEDIUM',
      }

      // 更新categories
      const updatedCategories = categories.map((cat) => {
        if (cat.id === targetCategory.id) {
          return {
            ...cat,
            clusters: [...cat.clusters, newCluster],
          }
        }
        return cat
      })

      // 移除已处理的缺失条款
      setAssignments({
        ...assignments,
        [selectedMissingClause.clauseId]: newCluster.id,
      })

      // 通知父组件更新
      onUpdateClustering(updatedCategories)

      setNewClusterModalVisible(false)
      setFormData({
        clusterName: '',
        clusterDescription: '',
        rationale: '',
        importance: 'MEDIUM',
        riskLevel: 'MEDIUM',
      })
      setSelectedMissingClause(null)
    } catch (error) {
      console.error('Failed to create cluster:', error)
    }
  }

  // 批量应用所有分配并保存到后端
  const handleApplyAllAssignments = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      // 1. 构建更新后的categories
      const updatedCategories = categories.map((category) => ({
        ...category,
        clusters: category.clusters.map((cluster) => {
          // 找到应该分配到这个聚类的缺失条款
          const newClauses = Object.entries(assignments)
            .filter(([_, clusterId]) => clusterId === cluster.id)
            .map(([clauseId, _]) => {
              const missingClause = missingClauses.find((mc) => mc.clauseId === clauseId)
              if (!missingClause) return null

              return {
                source_document_id: missingClause.documentId,
                source_document_name: missingClause.documentName,
                clause_id: missingClause.clauseId,
                clause_text: missingClause.clauseText,
                rationale: '用户手动添加的缺失条款',
              }
            })
            .filter(Boolean) as ClusterClause[]

          return {
            ...cluster,
            clauses: [...cluster.clauses, ...newClauses],
          }
        }),
      }))

      // 2. 保存到后端
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const response = await fetch(`${apiUrl}/ai-generation/clustering/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          categories: updatedCategories,
        }),
      })

      if (!response.ok) {
        throw new Error(`保存失败: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '保存失败')
      }

      // 3. 更新前端状态
      onUpdateClustering(updatedCategories)
      setAssignments({})

      // 4. 显示成功消息
      toast.success('聚类结果已保存到数据库！')
    } catch (error: any) {
      console.error('保存聚类结果失败:', error)
      setSaveError(error.message || '保存失败，请重试')
      toast.error(`保存失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (missingClauses.length === 0) {
    // 没有明确的缺失条款，但检查覆盖率是否完整
    if (hasIncompleteCoverage) {
      const incompleteDocs = Object.entries(coverageByDocument)
        .filter(([_, stats]) => stats.clustered_clauses < stats.total_clauses)
        .map(([docId, stats]) => {
          const doc = documents.find((d) => d.id === docId)
          return `${doc?.name || docId} (${stats.clustered_clauses}/${stats.total_clauses})`
        })

      return (
        <Alert className="border-[#BFDBFE] bg-[#EFF6FF]">
          <AlertTriangle className="h-4 w-4 text-[#1E3A5F]" />
          <AlertDescription>
            <div>
              <p className="font-semibold text-[#1E3A5F] mb-2">覆盖率统计信息</p>
              <p>以下文档的覆盖率统计显示可能存在差异：</p>
              <ul className="list-disc ml-5 mt-2">
                {incompleteDocs.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-[#64748B]">
                注意：文档中所有"第XX条"格式的条款都已被聚类。差异可能来自统计方法或非标准格式的条款。
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <Alert className="border-[#D1FAE5] bg-[#FEFDFB]">
        <CheckCircle className="h-4 w-4 text-[#059669]" />
        <AlertDescription className="text-[#059669]">
          所有条款已完整覆盖 - 没有缺失的条款需要处理
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="border-[#FEF3C7] bg-[#FFFBEB]">
        <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
        <AlertDescription className="text-[#92400E]">
          发现缺失条款 - 共发现 {missingClauses.length} 个缺失条款，您可以手动将其分配到现有聚类或新建聚类
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">缺失条款列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {missingClauses.map((missingClause, index) => {
              const isAssigned = assignments[missingClause.clauseId]

              return (
                <Card
                  key={missingClause.clauseId}
                  className={cn(
                    'border',
                    isAssigned && 'border-[#059669] bg-[#D1FAE5]'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-[#1E3A5F] text-[#1E3A5F]">
                            {missingClause.documentName}
                          </Badge>
                          <span className="font-mono font-semibold text-sm">{missingClause.clauseId}</span>
                          {isAssigned && (
                            <Badge className="bg-[#059669] text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              已分配
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-[#475569]">{missingClause.clauseText}</p>

                      {!isAssigned && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAssignToCluster(missingClause)}
                            className="bg-[#1E3A5F] hover:bg-[#0F2847] text-white"
                          >
                            分配到现有聚类
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateNewCluster(missingClause)}
                            className="border-[#E2E8F0] text-[#64748B]"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            新建聚类
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {Object.keys(assignments).length > 0 && (
            <>
              <div className="h-px bg-[#E2E8F0] my-4" />
              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={handleApplyAllAssignments}
                  className="bg-[#1E3A5F] hover:bg-[#0F2847] text-white"
                >
                  应用所有分配 ({Object.keys(assignments).length})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 分配到现有聚类的对话框 */}
      <Dialog open={assignModalVisible} onOpenChange={setAssignModalVisible}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#1E3A5F]">分配条款到聚类: {selectedMissingClause?.clauseId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMissingClause && (
              <>
                <Alert className="border-[#BFDBFE] bg-[#EFF6FF]">
                  <AlertDescription className="text-[#1E3A5F]">
                    {selectedMissingClause.clauseText}
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="cluster-select">选择目标聚类</Label>
                  <Select value={selectedClusterId || ''} onValueChange={setSelectedClusterId}>
                    <SelectTrigger id="cluster-select">
                      <SelectValue placeholder="选择目标聚类" />
                    </SelectTrigger>
                    <SelectContent>
                      {getClusterOptions().map(({ category, clusters }) =>
                        clusters.map((cluster) => (
                          <SelectItem key={cluster.id} value={cluster.id}>
                            {category.name} / {cluster.name} ({cluster.clauses.length}个条款)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setAssignModalVisible(false)
                setSelectedMissingClause(null)
                setSelectedClusterId(null)
              }}
              className="border-[#E2E8F0] text-[#64748B]"
            >
              取消
            </Button>
            <Button
              onClick={confirmAssign}
              className="bg-[#1E3A5F] hover:bg-[#0F2847] text-white"
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建聚类的对话框 */}
      <Dialog open={newClusterModalVisible} onOpenChange={setNewClusterModalVisible}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#1E3A5F]">新建聚类: {selectedMissingClause?.clauseId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMissingClause && (
              <>
                <Alert className="border-[#BFDBFE] bg-[#EFF6FF]">
                  <AlertDescription className="text-[#1E3A5F]">
                    {selectedMissingClause.clauseText}
                  </AlertDescription>
                </Alert>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cluster-name">聚类名称 <span className="text-[#DC2626]">*</span></Label>
                    <Input
                      id="cluster-name"
                      placeholder="例如：访问控制管理"
                      value={formData.clusterName}
                      onChange={(e) => setFormData({ ...formData, clusterName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cluster-desc">聚类描述</Label>
                    <Textarea
                      id="cluster-desc"
                      rows={3}
                      placeholder="描述该聚类的作用和范围（可选）"
                      value={formData.clusterDescription}
                      onChange={(e) => setFormData({ ...formData, clusterDescription: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rationale">归类理由</Label>
                    <Textarea
                      id="rationale"
                      rows={2}
                      placeholder="说明为什么将这些条款归入此聚类（可选）"
                      value={formData.rationale}
                      onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="importance">重要性</Label>
                      <Select
                        value={formData.importance}
                        onValueChange={(value) => setFormData({ ...formData, importance: value as 'HIGH' | 'MEDIUM' | 'LOW' })}
                      >
                        <SelectTrigger id="importance">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HIGH">高</SelectItem>
                          <SelectItem value="MEDIUM">中</SelectItem>
                          <SelectItem value="LOW">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="risk-level">风险级别</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value) => setFormData({ ...formData, riskLevel: value as 'HIGH' | 'MEDIUM' | 'LOW' })}
                      >
                        <SelectTrigger id="risk-level">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HIGH">高</SelectItem>
                          <SelectItem value="MEDIUM">中</SelectItem>
                          <SelectItem value="LOW">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setNewClusterModalVisible(false)
                setFormData({ clusterName: '', clusterDescription: '', rationale: '', importance: 'MEDIUM', riskLevel: 'MEDIUM' })
                setSelectedMissingClause(null)
              }}
              className="border-[#E2E8F0] text-[#64748B]"
            >
              取消
            </Button>
            <Button
              onClick={confirmCreateCluster}
              className="bg-[#1E3A5F] hover:bg-[#0F2847] text-white"
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
