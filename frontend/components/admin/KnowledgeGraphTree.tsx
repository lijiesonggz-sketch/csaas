'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TaxonomyTreeL1 } from '@/lib/api/knowledge-graph'

interface KnowledgeGraphTreeProps {
  tree: TaxonomyTreeL1[]
  selectedL2Code: string | null
  onSelectL2: (l2Code: string) => void
  searchQuery?: string
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function KnowledgeGraphTree({
  tree,
  selectedL2Code,
  onSelectL2,
  searchQuery = '',
}: KnowledgeGraphTreeProps) {
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())

  // Reset expanded state when search query is cleared
  useEffect(() => {
    if (!searchQuery) {
      setExpandedL1(new Set())
    }
  }, [searchQuery])

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree
    const q = searchQuery.toLowerCase()
    return tree
      .map((l1) => {
        const l1Match = l1.l1Code.toLowerCase().includes(q) || l1.l1Name.toLowerCase().includes(q)
        const matchedChildren = l1.children.filter(
          (l2) => l2.l2Code.toLowerCase().includes(q) || l2.l2Name.toLowerCase().includes(q)
        )
        if (l1Match) return l1
        if (matchedChildren.length > 0) return { ...l1, children: matchedChildren }
        return null
      })
      .filter(Boolean) as TaxonomyTreeL1[]
  }, [tree, searchQuery])

  function toggleL1(l1Code: string) {
    setExpandedL1((prev) => {
      const next = new Set(prev)
      if (next.has(l1Code)) next.delete(l1Code)
      else next.add(l1Code)
      return next
    })
  }

  if (filteredTree.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#64748B]">
        {searchQuery ? '未找到匹配的分类' : '暂无 IT 分类数据'}
      </div>
    )
  }

  return (
    <nav aria-label="IT 分类树" className="space-y-1">
      {filteredTree.map((l1) => {
        const isExpanded = expandedL1.has(l1.l1Code) || !!searchQuery
        return (
          <div key={l1.l1Code}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-[#1E3A5F] hover:bg-slate-50"
              onClick={() => toggleL1(l1.l1Code)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B]" />
              )}
              <FolderTree className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span className="truncate">
                {highlightMatch(`${l1.l1Code} ${l1.l1Name}`, searchQuery)}
              </span>
            </button>
            {isExpanded && (
              <div className="ml-6 space-y-0.5 border-l border-[#E2E8F0] pl-2">
                {l1.children.map((l2) => (
                  <button
                    key={l2.l2Code}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm transition ${
                      selectedL2Code === l2.l2Code
                        ? 'border-l-2 border-blue-500 bg-blue-50 font-medium text-[#1E3A5F]'
                        : 'text-[#475569] hover:bg-slate-50'
                    }`}
                    onClick={() => onSelectL2(l2.l2Code)}
                    aria-current={selectedL2Code === l2.l2Code ? 'true' : undefined}
                  >
                    <span className="truncate">
                      {highlightMatch(l2.l2Name, searchQuery)}
                    </span>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                      {l2.failureModeCount}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

