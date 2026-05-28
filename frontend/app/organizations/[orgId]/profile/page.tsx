'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ArrowLeft, AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { UserRole } from '@/lib/auth/types'
import {
  OrganizationProfile,
  OrganizationProfileAssetBucket,
  OrganizationProfileCiioStatus,
  OrganizationProfileCriticalSystemLevel,
  OrganizationProfileIndustry,
  OrganizationProfileImportantDataStatus,
  OrganizationProfileLegalPersonType,
  OrganizationProfileOption,
  OrganizationProfileOutsourcingLevel,
  OrganizationProfilePublicServiceScope,
  OrganizationProfileRegulatoryAttentionLevel,
  ORGANIZATION_PROFILE_ASSET_BUCKET_OPTIONS,
  ORGANIZATION_PROFILE_CIIO_STATUS_OPTIONS,
  ORGANIZATION_PROFILE_CRITICAL_SYSTEM_LEVEL_OPTIONS,
  ORGANIZATION_PROFILE_IMPORTANT_DATA_STATUS_OPTIONS,
  ORGANIZATION_PROFILE_INDUSTRY_OPTIONS,
  ORGANIZATION_PROFILE_LEGAL_PERSON_TYPE_OPTIONS,
  ORGANIZATION_PROFILE_OUTSOURCING_LEVEL_OPTIONS,
  ORGANIZATION_PROFILE_PUBLIC_SERVICE_SCOPE_OPTIONS,
  ORGANIZATION_PROFILE_REGULATORY_ATTENTION_LEVEL_OPTIONS,
  UpsertOrganizationProfilePayload,
} from '@/lib/types/organization'
import { OrganizationProfileRequestError, organizationsApi } from '@/lib/api/organizations'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type BooleanFormValue = '' | 'true' | 'false'

type ProfileFormState = {
  industry: OrganizationProfileIndustry | ''
  legalPersonType: OrganizationProfileLegalPersonType | ''
  assetBucket: OrganizationProfileAssetBucket | ''
  hasPersonalInfo: BooleanFormValue
  crossBorderData: BooleanFormValue
  importantDataStatus: OrganizationProfileImportantDataStatus | ''
  ciioStatus: OrganizationProfileCiioStatus | ''
  hasDatacenter: BooleanFormValue
  usesCloud: BooleanFormValue
  outsourcingLevel: OrganizationProfileOutsourcingLevel | ''
  criticalSystemLevel: OrganizationProfileCriticalSystemLevel | ''
  hasOnlineTrading: BooleanFormValue
  hasAiServices: BooleanFormValue
  publicServiceScope: OrganizationProfilePublicServiceScope | ''
  regulatoryAttentionLevel: OrganizationProfileRegulatoryAttentionLevel | ''
  recentMajorIncident: BooleanFormValue
}

type FieldKey = keyof ProfileFormState

type SelectFieldConfig = {
  key: FieldKey
  label: string
  options: OrganizationProfileOption<string>[]
}

const BOOLEAN_OPTIONS: OrganizationProfileOption<'true' | 'false'>[] = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
]

const EMPTY_FORM_STATE: ProfileFormState = {
  industry: '',
  legalPersonType: '',
  assetBucket: '',
  hasPersonalInfo: '',
  crossBorderData: '',
  importantDataStatus: '',
  ciioStatus: '',
  hasDatacenter: '',
  usesCloud: '',
  outsourcingLevel: '',
  criticalSystemLevel: '',
  hasOnlineTrading: '',
  hasAiServices: '',
  publicServiceScope: '',
  regulatoryAttentionLevel: '',
  recentMajorIncident: '',
}

const FIELD_SECTIONS: Array<{ title: string; fields: SelectFieldConfig[] }> = [
  {
    title: '基础机构属性',
    fields: [
      { key: 'industry', label: '所属行业', options: ORGANIZATION_PROFILE_INDUSTRY_OPTIONS },
      {
        key: 'legalPersonType',
        label: '法人主体类型',
        options: ORGANIZATION_PROFILE_LEGAL_PERSON_TYPE_OPTIONS,
      },
      {
        key: 'assetBucket',
        label: '资产规模档位',
        options: ORGANIZATION_PROFILE_ASSET_BUCKET_OPTIONS,
      },
      {
        key: 'regulatoryAttentionLevel',
        label: '监管关注等级',
        options: ORGANIZATION_PROFILE_REGULATORY_ATTENTION_LEVEL_OPTIONS,
      },
    ],
  },
  {
    title: '数据与系统',
    fields: [
      { key: 'hasPersonalInfo', label: '是否涉及个人信息', options: BOOLEAN_OPTIONS },
      { key: 'crossBorderData', label: '是否跨境处理数据', options: BOOLEAN_OPTIONS },
      {
        key: 'importantDataStatus',
        label: '重要数据识别情况',
        options: ORGANIZATION_PROFILE_IMPORTANT_DATA_STATUS_OPTIONS,
      },
      {
        key: 'ciioStatus',
        label: '关键信息基础设施认定情况',
        options: ORGANIZATION_PROFILE_CIIO_STATUS_OPTIONS,
      },
      { key: 'hasDatacenter', label: '是否自建机房', options: BOOLEAN_OPTIONS },
      { key: 'usesCloud', label: '是否使用云服务', options: BOOLEAN_OPTIONS },
      {
        key: 'outsourcingLevel',
        label: '外包依赖程度',
        options: ORGANIZATION_PROFILE_OUTSOURCING_LEVEL_OPTIONS,
      },
      {
        key: 'criticalSystemLevel',
        label: '关键系统等级',
        options: ORGANIZATION_PROFILE_CRITICAL_SYSTEM_LEVEL_OPTIONS,
      },
    ],
  },
  {
    title: '业务与监管',
    fields: [
      { key: 'hasOnlineTrading', label: '是否有线上交易', options: BOOLEAN_OPTIONS },
      { key: 'hasAiServices', label: '是否提供AI服务', options: BOOLEAN_OPTIONS },
      {
        key: 'publicServiceScope',
        label: '公共服务范围',
        options: ORGANIZATION_PROFILE_PUBLIC_SERVICE_SCOPE_OPTIONS,
      },
      { key: 'recentMajorIncident', label: '近一年是否发生重大事件', options: BOOLEAN_OPTIONS },
    ],
  },
]

function toBooleanFormValue(value: boolean): BooleanFormValue {
  return value ? 'true' : 'false'
}

function fromBooleanFormValue(value: BooleanFormValue): boolean {
  return value === 'true'
}

function toFormState(profile: OrganizationProfile): ProfileFormState {
  return {
    industry: profile.industry,
    legalPersonType: profile.legalPersonType,
    assetBucket: profile.assetBucket,
    hasPersonalInfo: toBooleanFormValue(profile.hasPersonalInfo),
    crossBorderData: toBooleanFormValue(profile.crossBorderData),
    importantDataStatus: profile.importantDataStatus,
    ciioStatus: profile.ciioStatus,
    hasDatacenter: toBooleanFormValue(profile.hasDatacenter),
    usesCloud: toBooleanFormValue(profile.usesCloud),
    outsourcingLevel: profile.outsourcingLevel,
    criticalSystemLevel: profile.criticalSystemLevel,
    hasOnlineTrading: toBooleanFormValue(profile.hasOnlineTrading),
    hasAiServices: toBooleanFormValue(profile.hasAiServices),
    publicServiceScope: profile.publicServiceScope,
    regulatoryAttentionLevel: profile.regulatoryAttentionLevel,
    recentMajorIncident: toBooleanFormValue(profile.recentMajorIncident),
  }
}

function validateForm(formState: ProfileFormState): Partial<Record<FieldKey, string>> {
  const nextErrors: Partial<Record<FieldKey, string>> = {}

  for (const section of FIELD_SECTIONS) {
    for (const field of section.fields) {
      if (!formState[field.key]) {
        nextErrors[field.key] = `请选择${field.label}`
      }
    }
  }

  return nextErrors
}

function toPayload(
  formState: ProfileFormState,
  expectedUpdatedAt?: string
): UpsertOrganizationProfilePayload {
  return {
    industry: formState.industry as OrganizationProfileIndustry,
    legalPersonType: formState.legalPersonType as OrganizationProfileLegalPersonType,
    assetBucket: formState.assetBucket as OrganizationProfileAssetBucket,
    hasPersonalInfo: fromBooleanFormValue(formState.hasPersonalInfo),
    crossBorderData: fromBooleanFormValue(formState.crossBorderData),
    importantDataStatus: formState.importantDataStatus as OrganizationProfileImportantDataStatus,
    ciioStatus: formState.ciioStatus as OrganizationProfileCiioStatus,
    hasDatacenter: fromBooleanFormValue(formState.hasDatacenter),
    usesCloud: fromBooleanFormValue(formState.usesCloud),
    outsourcingLevel: formState.outsourcingLevel as OrganizationProfileOutsourcingLevel,
    criticalSystemLevel: formState.criticalSystemLevel as OrganizationProfileCriticalSystemLevel,
    hasOnlineTrading: fromBooleanFormValue(formState.hasOnlineTrading),
    hasAiServices: fromBooleanFormValue(formState.hasAiServices),
    publicServiceScope: formState.publicServiceScope as OrganizationProfilePublicServiceScope,
    regulatoryAttentionLevel:
      formState.regulatoryAttentionLevel as OrganizationProfileRegulatoryAttentionLevel,
    recentMajorIncident: fromBooleanFormValue(formState.recentMajorIncident),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  }
}

function canEditProfile(role?: string, organizationRole?: string): boolean {
  if (role === UserRole.CLIENT_PM || role === UserRole.RESPONDENT) {
    return false
  }

  return role === UserRole.ADMIN || role === UserRole.CONSULTANT || organizationRole === 'admin'
}

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleString('zh-CN', { hour12: false })
}

function getProfileErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof OrganizationProfileRequestError) {
    switch (error.code) {
      case 'not_found':
        return '当前机构还没有画像记录，请先完成首次配置。'
      case 'conflict':
        return '机构画像已被其他用户更新，请刷新后重新编辑。'
      case 'validation':
      case 'network':
      case 'unknown':
      default:
        return error.message || fallback
    }
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

export default function OrganizationProfilePage() {
  const params = useParams<{ orgId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()

  const routeOrgId = typeof params?.orgId === 'string' ? params.orgId : ''
  const activeOrgId = routeOrgId || session?.user?.organizationId || ''
  const isReadOnly = useMemo(
    () => !canEditProfile(session?.user?.role, session?.user?.organizationRole),
    [session?.user?.organizationRole, session?.user?.role]
  )

  const [formState, setFormState] = useState<ProfileFormState>(EMPTY_FORM_STATE)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [isFirstTimeConfig, setIsFirstTimeConfig] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>(undefined)

  const loadProfile = useCallback(async () => {
    if (!activeOrgId) {
      setLoading(false)
      setLoadError('未找到组织信息，无法加载机构画像。')
      return
    }

    setLoading(true)
    setLoadError(null)
    setSaveError(null)

    try {
      const profile = await organizationsApi.getOrganizationProfile(activeOrgId)
      setFormState(toFormState(profile))
      setErrors({})
      setIsFirstTimeConfig(false)
      setLastUpdatedAt(profile.updatedAt)
    } catch (error) {
      if (error instanceof OrganizationProfileRequestError && error.code === 'not_found') {
        setFormState(EMPTY_FORM_STATE)
        setErrors({})
        setIsFirstTimeConfig(true)
        setLastUpdatedAt(undefined)
        setLoadError(null)
      } else {
        setLoadError(getProfileErrorMessage(error, '加载机构画像失败，请稍后重试。'))
      }
    } finally {
      setLoading(false)
    }
  }, [activeOrgId])

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    void loadProfile()
  }, [loadProfile, status])

  const handleFieldChange = (key: FieldKey, value: string) => {
    setFormState((previous) => ({
      ...previous,
      [key]: value,
    }))
    setErrors((previous) => ({
      ...previous,
      [key]: undefined,
    }))
    setSaveError(null)
    setSaveSuccessMessage(null)
  }

  const handleSave = async () => {
    const validationErrors = validateForm(formState)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      toast.error('请先补全机构画像的必填字段。')
      return
    }

    if (!activeOrgId) {
      setSaveError('未找到组织信息，无法保存机构画像。')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const savedProfile = await organizationsApi.upsertOrganizationProfile(
        activeOrgId,
        toPayload(formState, lastUpdatedAt)
      )
      setFormState(toFormState(savedProfile))
      setIsFirstTimeConfig(false)
      setLastUpdatedAt(savedProfile.updatedAt)
      setSaveSuccessMessage('机构画像已保存。')
      toast.success('机构画像已保存。')
    } catch (error) {
      setSaveError(getProfileErrorMessage(error, '保存机构画像失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-[#FEFDFB]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#FEFDFB] min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button variant="outline" onClick={() => router.back()} className="rounded-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            机构画像配置
          </h1>
          <p className="text-[#94A3B8] mt-1">
            配置机构的 16 个最小必需画像字段，供 KG 规则引擎推导适用控制点使用。
          </p>
        </div>

        {!activeOrgId && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>未找到组织信息，无法进入机构画像配置页。</AlertDescription>
          </Alert>
        )}

        {isReadOnly && !loadError && (
          <Alert className="rounded-sm border-[#059669] bg-[#F0FDF4]">
            <Info className="h-4 w-4 text-[#059669]" />
            <AlertDescription className="text-[#059669]">
              当前账号仅可查看机构画像，不能修改。
            </AlertDescription>
          </Alert>
        )}

        {loadError ? (
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardContent className="p-6 space-y-4">
              <Alert variant="destructive" className="rounded-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
              <Button
                onClick={() => void loadProfile()}
                className="bg-[#1E3A5F] hover:bg-[#162e4d] rounded-sm"
              >
                重试
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardContent className="p-6 space-y-6">
              {isFirstTimeConfig && (
                <Alert className="rounded-sm border-[#059669] bg-[#F0FDF4]">
                  <Info className="h-4 w-4 text-[#059669]" />
                  <AlertDescription className="text-[#059669]">
                    首次配置机构画像。当前机构还没有画像记录，请先完成首次配置。
                  </AlertDescription>
                </Alert>
              )}

              {saveError && (
                <Alert variant="destructive" className="rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}

              {saveSuccessMessage && (
                <Alert className="rounded-sm border-[#059669] bg-[#F0FDF4]">
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                  <AlertDescription className="text-[#059669]">
                    {saveSuccessMessage}
                  </AlertDescription>
                </Alert>
              )}

              {lastUpdatedAt && (
                <p className="text-sm text-[#94A3B8]">最近保存：{formatUpdatedAt(lastUpdatedAt)}</p>
              )}

              {FIELD_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                      {section.title}
                    </h2>
                    <div className="h-px bg-[#E2E8F0] mt-2" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key} className="text-[#1E3A5F]">
                          {field.label}
                        </Label>
                        <Select
                          value={formState[field.key]}
                          onValueChange={(value) => handleFieldChange(field.key, value)}
                          disabled={isReadOnly || saving}
                        >
                          <SelectTrigger
                            className={`rounded-sm ${errors[field.key] ? 'border-red-500' : ''}`}
                            id={field.key}
                          >
                            <SelectValue placeholder={`请选择${field.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors[field.key] && (
                          <p className="text-sm text-red-600">{errors[field.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!isReadOnly && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存画像'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
