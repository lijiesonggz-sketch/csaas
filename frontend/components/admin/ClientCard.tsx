/**
 * ClientCard Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 客户卡片组件 - 显示客户基本信息和操作按钮
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Edit,
  Trash2,
  Settings,
  Building2,
  User,
  Mail,
  TrendingUp,
} from 'lucide-react'
import {
  Client,
  IndustryType,
  OrganizationScale,
  OrganizationStatus,
} from '@/lib/api/clients'

interface ClientCardProps {
  client: Client
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onConfig: (client: Client) => void
  selected?: boolean
  onSelect?: (client: Client, selected: boolean) => void
}

// 行业类型标签映射
const INDUSTRY_LABELS: Record<IndustryType, string> = {
  [IndustryType.BANKING]: '银行',
  [IndustryType.SECURITIES]: '证券',
  [IndustryType.INSURANCE]: '保险',
  [IndustryType.ENTERPRISE]: '企业',
}

// 机构规模标签映射
const SCALE_LABELS: Record<OrganizationScale, string> = {
  [OrganizationScale.LARGE]: '大型',
  [OrganizationScale.MEDIUM]: '中型',
  [OrganizationScale.SMALL]: '小型',
}

// 状态标签映射
const STATUS_LABELS: Record<OrganizationStatus, string> = {
  [OrganizationStatus.ACTIVE]: '活跃',
  [OrganizationStatus.INACTIVE]: '停用',
  [OrganizationStatus.TRIAL]: '试用',
}

// 状态 Badge 变体映射
const STATUS_VARIANTS: Record<
  OrganizationStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [OrganizationStatus.ACTIVE]: 'default',
  [OrganizationStatus.INACTIVE]: 'secondary',
  [OrganizationStatus.TRIAL]: 'outline',
}

export function ClientCard({
  client,
  onEdit,
  onDelete,
  onConfig,
  selected = false,
  onSelect,
}: ClientCardProps) {
  const handleCardClick = () => {
    if (onSelect) {
      onSelect(client, !selected)
    }
  }

  return (
    <Card
      className={`
        h-full flex flex-col cursor-pointer transition-all
        ${selected ? 'border-2 border-primary' : 'border hover:border-primary/50'}
        hover:shadow-md
      `}
      onClick={onSelect ? handleCardClick : undefined}
    >
      <CardContent className="flex-1 pt-6">
        {/* 客户名称和状态 */}
        <div className="flex items-start gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold mb-2 truncate">{client.name}</h3>
            <div className="flex flex-wrap gap-2">
              {client.status && (
                <Badge variant={STATUS_VARIANTS[client.status]}>
                  {STATUS_LABELS[client.status]}
                </Badge>
              )}
              {client.industryType && (
                <Badge variant="outline">
                  {INDUSTRY_LABELS[client.industryType]}
                </Badge>
              )}
              {client.scale && (
                <Badge variant="outline">
                  {SCALE_LABELS[client.scale]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 联系信息 */}
        <div className="space-y-2 mb-4">
          {client.contactPerson && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {client.contactPerson}
              </span>
            </div>
          )}
          {client.contactEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {client.contactEmail}
              </span>
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="flex gap-2 p-2 bg-muted rounded-lg mb-3">
          <div className="flex-1 text-center">
            <p className="text-lg font-semibold text-primary">
              {client.userCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">用户数</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-semibold text-primary">
              {client.pushCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">推送数</p>
          </div>
        </div>

        {/* 推送配置信息 */}
        {(client.pushStartTime || client.dailyPushLimit) && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">推送配置:</p>
            <p className="text-sm">
              {client.pushStartTime && client.pushEndTime
                ? `${client.pushStartTime} - ${client.pushEndTime}`
                : '未设置'}
              {client.dailyPushLimit && ` · 每日${client.dailyPushLimit}条`}
            </p>
          </div>
        )}

        {/* 最后推送时间 */}
        {client.lastPushAt && (
          <div className="mt-1">
            <p className="text-xs text-muted-foreground">
              最后推送: {new Date(client.lastPushAt).toLocaleString('zh-CN')}
            </p>
          </div>
        )}
      </CardContent>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-1 p-4 pt-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onConfig(client)
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>推送配置</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(client)
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>编辑</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(client)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </Card>
  )
}
