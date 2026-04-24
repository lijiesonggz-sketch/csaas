'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  type ApplicableSector,
  type ControlPointMaturityLevel,
  type ControlPointRecord,
  type ControlPointStatus,
  listControlPoints,
} from '@/lib/api/control-points'
import { getTaxonomyTree } from '@/lib/api/knowledge-graph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatAuthoritativeScorePercent } from '@/lib/utils/authoritative-score'

const MATURITY_OPTIONS: Array<ControlPointMaturityLevel | 'all'> = [
  'all',
  'hard',
  'draft-hard',
  'candidate',
  'retired',
]
const SECTOR_OPTIONS: Array<ApplicableSector | 'all'> = [
  'all',
  '银行',
  '证券',
  '保险',
  '基金',
  '期货',
  '通用',
]
const PAGE_SIZE = 10

function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

type ControlPointDirectorySelectorProps = {
  actionLabel?: string
  buttonLabel?: string
  disabled?: boolean
  excludeControlIds?: string[]
  onPreview?: (controlId: string) => void
  onSelect: (control: ControlPointRecord) => void
  status?: ControlPointStatus
}

export function ControlPointDirectorySelector({
  actionLabel = '添加为映射',
  buttonLabel = '搜索控制点',
  disabled = false,
  excludeControlIds = [],
  onPreview,
  onSelect,
  status = 'ACTIVE',
}: ControlPointDirectorySelectorProps) {
  const searchRequestId = useRef(0)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState({
    l1Code: 'all',
    l2Code: 'all',
    controlFamily: 'all',
    maturityLevel: 'all' as ControlPointMaturityLevel | 'all',
    applicableSector: 'all' as ApplicableSector | 'all',
  })
  const [taxonomyTree, setTaxonomyTree] = useState<
    Array<{
      l1Code: string
      l1Name: string
      children: Array<{ l2Code: string; l2Name: string }>
    }>
  >([])
  const [controlFamilies, setControlFamilies] = useState<string[]>([])
  const [results, setResults] = useState<ControlPointRecord[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const l2Options = useMemo(() => {
    if (filters.l1Code === 'all') {
      return taxonomyTree.flatMap((item) => item.children)
    }

    return taxonomyTree.find((item) => item.l1Code === filters.l1Code)?.children ?? []
  }, [filters.l1Code, taxonomyTree])
  const visibleResults = useMemo(() => {
    const excludeSet = new Set(excludeControlIds)
    return results.filter((item) => !excludeSet.has(item.controlId))
  }, [excludeControlIds, results])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false

    async function collectAllControlFamilies() {
      const families = new Set<string>()
      let currentPage = 1
      let totalItems = 0
      let collected = 0

      do {
        const result = await listControlPoints({
          page: currentPage,
          limit: 100,
          status,
        })
        result.items.forEach((item) => {
          if (item.controlFamily) {
            families.add(item.controlFamily)
          }
        })
        totalItems = result.total
        collected += result.items.length
        if (result.items.length === 0) {
          break
        }
        currentPage += 1
      } while (collected < totalItems)

      return Array.from(families).sort((left, right) => left.localeCompare(right))
    }

    async function loadMeta() {
      try {
        const [taxonomyResult, families] = await Promise.all([
          getTaxonomyTree(),
          collectAllControlFamilies(),
        ])

        if (cancelled) return
        setTaxonomyTree(
          taxonomyResult.map((item) => ({
            l1Code: item.l1Code,
            l1Name: item.l1Name,
            children: item.children.map((child) => ({
              l2Code: child.l2Code,
              l2Name: child.l2Name,
            })),
          })),
        )
        setControlFamilies(families)
      } catch (loadError) {
        if (!cancelled) {
          toast.error(errorMessage(loadError, '加载控制点目录元数据失败'))
        }
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [status])

  async function handleSearch(nextPage = 1) {
    const requestId = searchRequestId.current + 1
    searchRequestId.current = requestId
    try {
      setLoading(true)
      setHasSearched(true)
      const result = await listControlPoints({
        page: nextPage,
        limit: PAGE_SIZE,
        status,
        keyword: keyword.trim() || undefined,
        l1Code: filters.l1Code === 'all' ? undefined : filters.l1Code,
        l2Code: filters.l2Code === 'all' ? undefined : filters.l2Code,
        controlFamily: filters.controlFamily === 'all' ? undefined : filters.controlFamily,
        maturityLevel: filters.maturityLevel === 'all' ? undefined : filters.maturityLevel,
        applicableSector:
          filters.applicableSector === 'all' ? undefined : filters.applicableSector,
      })
      if (requestId !== searchRequestId.current) return
      setPage(nextPage)
      setResults(result.items)
      setTotal(result.total)
    } catch (searchError) {
      if (requestId !== searchRequestId.current) return
      toast.error(errorMessage(searchError, '搜索控制点失败'))
    } finally {
      if (requestId === searchRequestId.current) {
        setLoading(false)
      }
    }
  }

  return (
    <div data-testid="control-point-directory-selector" className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索 control code / control name"
        />
        <Button
          variant="outline"
          className="rounded-sm"
          onClick={() => void handleSearch(1)}
          disabled={loading || disabled}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              {buttonLabel}
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <Label>一级分类</Label>
          <Select
            value={filters.l1Code}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                l1Code: value,
                l2Code: 'all',
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {taxonomyTree.map((item) => (
                <SelectItem key={item.l1Code} value={item.l1Code}>
                  {item.l1Code} · {item.l1Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>二级分类</Label>
          <Select
            value={filters.l2Code}
            onValueChange={(value) => setFilters((current) => ({ ...current, l2Code: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {l2Options.map((item) => (
                <SelectItem key={item.l2Code} value={item.l2Code}>
                  {item.l2Code} · {item.l2Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>控制族</Label>
          <Select
            value={filters.controlFamily}
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, controlFamily: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {controlFamilies.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>成熟度</Label>
          <Select
            value={filters.maturityLevel}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                maturityLevel: value as ControlPointMaturityLevel | 'all',
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATURITY_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>适用行业</Label>
          <Select
            value={filters.applicableSector}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                applicableSector: value as ApplicableSector | 'all',
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTOR_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasSearched && (
        <>
          <div className="space-y-2 rounded-sm border border-dashed border-[#CBD5E1] p-3">
            {visibleResults.length === 0 ? (
              <div className="rounded-sm border border-[#E2E8F0] px-3 py-4 text-sm text-[#64748B]">
                {total === 0
                  ? '暂无符合条件的控制点。'
                  : '当前页结果已被已关联控制点过滤，请尝试翻页或调整筛选条件。'}
              </div>
            ) : (
              visibleResults.map((item) => (
                <div
                  key={item.controlId}
                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-[#1E3A5F]">
                      {onPreview ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => onPreview(item.controlId)}
                        >
                          {item.controlCode} · {item.controlName}
                        </button>
                      ) : (
                        `${item.controlCode} · ${item.controlName}`
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#64748B]">
                      <span>
                        {item.controlFamily} · {item.l1Code} / {item.l2Code}
                      </span>
                      {item.maturityLevel && <Badge variant="outline">{item.maturityLevel}</Badge>}
                      <span>score {formatAuthoritativeScorePercent(item.authoritativeScore)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-sm"
                    disabled={disabled}
                    onClick={() => onSelect(item)}
                  >
                    {actionLabel}
                  </Button>
                </div>
              ))
            )}
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                disabled={page <= 1 || loading}
                onClick={() => void handleSearch(page - 1)}
              >
                上一页
              </Button>
              <span className="text-xs text-[#64748B]">
                第 {page} / {totalPages} 页
              </span>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                disabled={page >= totalPages || loading}
                onClick={() => void handleSearch(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
