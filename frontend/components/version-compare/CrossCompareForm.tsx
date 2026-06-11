'use client'

import { Loader2, Network, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

interface CrossCompareFormProps {
  documents: Array<{ id: string; name: string }>
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onCompare: () => void
  loading: boolean
  progressPercentage?: number
  progressMessage?: string
}

export function CrossCompareForm({
  documents,
  selectedIds,
  onSelectionChange,
  onCompare,
  loading,
  progressPercentage,
  progressMessage,
}: CrossCompareFormProps) {
  const toggle = (docId: string) => {
    onSelectionChange(
      selectedIds.includes(docId)
        ? selectedIds.filter((id) => id !== docId)
        : [...selectedIds, docId]
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <Network className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">选择要交叉分析的标准文档</h3>
        <p className="text-sm text-[#94A3B8]">
          选择2个及以上来自不同监管机构的标准/管理办法，AI将按主题聚类并检测要求冲突、生成就高执行基线
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {documents.map((doc) => (
          <label
            key={doc.id}
            className="flex items-center gap-3 p-4 border border-[#E2E8F0] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <Checkbox
              checked={selectedIds.includes(doc.id)}
              onCheckedChange={() => toggle(doc.id)}
            />
            <FileText className="w-4 h-4 text-[#64748B] flex-shrink-0" />
            <span className="text-sm text-[#1E3A5F]">{doc.name}</span>
          </label>
        ))}
      </div>

      <div className="text-center">
        <Button
          onClick={onCompare}
          disabled={loading || selectedIds.length < 2}
          className="bg-[#1E3A5F] hover:bg-[#152a47] text-white px-6"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Network className="w-4 h-4 mr-2" />
              开始交叉分析（已选 {selectedIds.length} 个）
            </>
          )}
        </Button>
        {selectedIds.length < 2 && !loading && (
          <p className="mt-2 text-xs text-[#94A3B8]">请至少选择2个文档</p>
        )}
      </div>

      {loading && (
        <div className="mt-8">
          <Progress value={progressPercentage || 0} className="h-2 mb-4" />
          <p className="text-center text-sm text-[#94A3B8]">
            {progressMessage || '正在进行多标准交叉分析...'}
          </p>
        </div>
      )}
    </div>
  )
}
