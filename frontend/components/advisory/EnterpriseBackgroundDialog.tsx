'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Save } from 'lucide-react'
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
  ORGANIZATION_CONTEXT_NAME_MAX_LENGTH,
  ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE,
  ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE,
  ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH,
  type OrganizationContextSaved,
  type SaveOrganizationContextInput,
} from '@/lib/advisory/organization-context'

interface EnterpriseBackgroundDialogProps {
  open: boolean
  mode: 'first-use' | 'settings'
  initialContext?: OrganizationContextSaved | null
  saving?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onSave: (input: SaveOrganizationContextInput) => Promise<void> | void
  onSkip?: () => void
}

export function EnterpriseBackgroundDialog({
  open,
  mode,
  initialContext,
  saving = false,
  error,
  onOpenChange,
  onSave,
  onSkip,
}: EnterpriseBackgroundDialogProps) {
  const [organizationName, setOrganizationName] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [industryError, setIndustryError] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const organizationNameRef = useRef<HTMLInputElement>(null)
  const industryRef = useRef<HTMLInputElement>(null)
  const sizeRef = useRef<HTMLInputElement>(null)
  const isSubmitting = saving || submitting
  const title = mode === 'settings' ? '企业背景设置' : '企业背景'
  const description =
    mode === 'settings'
      ? '更新后的企业背景会用于后续咨询。'
      : '企业名称用于后续推荐和工作流提示；行业与规模可以稍后补充。'

  useEffect(() => {
    if (!open) return
    setOrganizationName(initialContext?.organizationName ?? '')
    setIndustry(initialContext?.industry ?? '')
    setSize(initialContext?.size ?? '')
    setLocalError(null)
    setIndustryError(null)
    setSizeError(null)
    window.setTimeout(() => organizationNameRef.current?.focus(), 0)
  }, [initialContext, open])

  const handleSave = async () => {
    const normalizedOrganizationName = normalizeOrganizationContextText(organizationName)
    const normalizedIndustry = normalizeOrganizationContextText(industry)
    const normalizedSize = normalizeOrganizationContextText(size)

    if (!normalizedOrganizationName || !hasVisibleText(normalizedOrganizationName)) {
      setLocalError(ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE)
      organizationNameRef.current?.focus()
      return
    }
    if (normalizedOrganizationName.length > ORGANIZATION_CONTEXT_NAME_MAX_LENGTH) {
      setLocalError(ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE)
      organizationNameRef.current?.focus()
      return
    }
    if (normalizedIndustry.length > ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH) {
      setIndustryError(`行业不能超过 ${ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH} 个字符。`)
      industryRef.current?.focus()
      return
    }
    if (normalizedSize.length > ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH) {
      setSizeError(`规模不能超过 ${ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH} 个字符。`)
      sizeRef.current?.focus()
      return
    }

    setLocalError(null)
    setIndustryError(null)
    setSizeError(null)
    setSubmitting(true)
    try {
      await onSave({
        organizationName: normalizedOrganizationName,
        industry: hasVisibleText(normalizedIndustry) ? normalizedIndustry : undefined,
        size: hasVisibleText(normalizedSize) ? normalizedSize : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="enterprise-background-description"
        className="max-w-md rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] text-[hsl(var(--advisory-foreground))]"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[hsl(var(--advisory-icon-bg))]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription id="enterprise-background-description">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enterprise-background-name">企业名称</Label>
            <Input
              ref={organizationNameRef}
              id="enterprise-background-name"
              value={organizationName}
              maxLength={ORGANIZATION_CONTEXT_NAME_MAX_LENGTH + 1}
              aria-invalid={Boolean(localError)}
              aria-describedby={localError ? 'enterprise-background-name-error' : undefined}
              disabled={isSubmitting}
              onChange={(event) => {
                setOrganizationName(event.target.value)
                setLocalError(null)
              }}
              className="rounded-sm border-[hsl(var(--advisory-border))]"
            />
            {localError && (
              <p
                id="enterprise-background-name-error"
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {localError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="enterprise-background-industry">行业</Label>
            <Input
              ref={industryRef}
              id="enterprise-background-industry"
              value={industry}
              maxLength={ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH + 1}
              aria-invalid={Boolean(industryError)}
              aria-describedby={industryError ? 'enterprise-background-industry-error' : undefined}
              disabled={isSubmitting}
              onChange={(event) => {
                setIndustry(event.target.value)
                setIndustryError(null)
              }}
              className="rounded-sm border-[hsl(var(--advisory-border))]"
            />
            {industryError && (
              <p
                id="enterprise-background-industry-error"
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {industryError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="enterprise-background-size">规模</Label>
            <Input
              ref={sizeRef}
              id="enterprise-background-size"
              value={size}
              maxLength={ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH + 1}
              aria-invalid={Boolean(sizeError)}
              aria-describedby={sizeError ? 'enterprise-background-size-error' : undefined}
              disabled={isSubmitting}
              onChange={(event) => {
                setSize(event.target.value)
                setSizeError(null)
              }}
              className="rounded-sm border-[hsl(var(--advisory-border))]"
            />
            {sizeError && (
              <p
                id="enterprise-background-size-error"
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {sizeError}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-sm border border-[hsl(var(--destructive))] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          {mode === 'first-use' && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onSkip}
              className="h-9 rounded-sm px-3"
            >
              跳过
            </Button>
          )}
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSave()}
            className="h-9 rounded-sm px-3"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? '保存中' : mode === 'settings' ? '保存' : '保存并开始'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function hasVisibleText(value: string): boolean {
  return normalizeOrganizationContextText(value).length > 0
}

function normalizeOrganizationContextText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\p{C}+/gu, '')
    .trim()
}
