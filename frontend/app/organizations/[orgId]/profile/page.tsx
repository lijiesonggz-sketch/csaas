'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { toast } from 'sonner'
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
import {
  OrganizationProfileRequestError,
  organizationsApi,
} from '@/lib/api/organizations'

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
      { key: 'assetBucket', label: '资产规模档位', options: ORGANIZATION_PROFILE_ASSET_BUCKET_OPTIONS },
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
  expectedUpdatedAt?: string,
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

  return (
    role === UserRole.ADMIN ||
    role === UserRole.CONSULTANT ||
    organizationRole === 'admin'
  )
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
    [session?.user?.organizationRole, session?.user?.role],
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
      if (
        error instanceof OrganizationProfileRequestError &&
        error.code === 'not_found'
      ) {
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
        toPayload(formState, lastUpdatedAt),
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Box sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={() => router.back()}>
              返回
            </Button>
          </Box>
          <Typography variant="h4" component="h1" gutterBottom>
            机构画像配置
          </Typography>
          <Typography variant="body1" color="text.secondary">
            配置机构的 16 个最小必需画像字段，供 KG 规则引擎推导适用控制点使用。
          </Typography>
        </Box>

        {!activeOrgId && (
          <Alert severity="error">未找到组织信息，无法进入机构画像配置页。</Alert>
        )}

        {isReadOnly && !loadError && (
          <Alert severity="info">
            当前账号仅可查看机构画像，不能修改。
          </Alert>
        )}

        {loadError ? (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Alert severity="error">{loadError}</Alert>
              <Box>
                <Button variant="contained" onClick={() => void loadProfile()}>
                  重试
                </Button>
              </Box>
            </Stack>
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              {isFirstTimeConfig && (
                <Alert severity="info">
                  首次配置机构画像。当前机构还没有画像记录，请先完成首次配置。
                </Alert>
              )}

              {saveError && <Alert severity="error">{saveError}</Alert>}

              {saveSuccessMessage && <Alert severity="success">{saveSuccessMessage}</Alert>}

              {lastUpdatedAt && (
                <Typography variant="body2" color="text.secondary">
                  最近保存：{formatUpdatedAt(lastUpdatedAt)}
                </Typography>
              )}

              {FIELD_SECTIONS.map((section) => (
                <Stack spacing={2} key={section.title}>
                  <Box>
                    <Typography variant="h6">{section.title}</Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                    }}
                  >
                    {section.fields.map((field) => (
                      <TextField
                        key={field.key}
                        fullWidth
                        select
                        label={field.label}
                        value={formState[field.key]}
                        disabled={isReadOnly || saving}
                        error={Boolean(errors[field.key])}
                        helperText={errors[field.key] || ' '}
                        InputLabelProps={{ shrink: true }}
                        onChange={(event) =>
                          handleFieldChange(field.key, event.target.value)
                        }
                        SelectProps={{ displayEmpty: true }}
                      >
                        <MenuItem value="">
                          {`请选择${field.label}`}
                        </MenuItem>
                        {field.options.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    ))}
                  </Box>
                </Stack>
              ))}

              {!isReadOnly && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存画像'}
                  </Button>
                </Box>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
