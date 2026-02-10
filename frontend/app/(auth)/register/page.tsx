'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import Link from 'next/link'
import { useTheme } from '@mui/material/styles'
import { message } from '@/lib/message'

interface FormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: string
}

export default function RegisterPage() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState<FormValues>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'respondent',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validators: Record<string, (val: string, allValues?: FormValues) => string> = {
    name: (val) => (!val ? '请输入姓名' : ''),
    email: (val) => {
      if (!val) return '请输入邮箱'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return '请输入有效的邮箱地址'
      return ''
    },
    password: (val) => {
      if (!val) return '请输入密码'
      if (val.length < 8) return '密码至少8个字符'
      return ''
    },
    confirmPassword: (val, allValues) => {
      if (!val) return '请确认密码'
      if (allValues && val !== allValues.password) return '两次输入的密码不一致'
      return ''
    },
    role: (val) => (!val ? '请选择角色' : ''),
  }

  const validateField = (field: string, value: string, allValues?: FormValues) => {
    const error = validators[field]?.(value, allValues) || ''
    setErrors((prev) => ({ ...prev, [field]: error }))
    return error
  }

  const handleChange = (field: keyof FormValues, value: string) => {
    const newForm = { ...form, [field]: value }
    setForm(newForm)
    if (touched[field]) {
      validateField(field, value, newForm)
    }
    // Re-validate confirmPassword when password changes
    if (field === 'password' && touched.confirmPassword) {
      validateField('confirmPassword', newForm.confirmPassword, newForm)
    }
  }

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    validateField(field, form[field as keyof FormValues], form)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validate all fields
    const allTouched: Record<string, boolean> = {}
    const allErrors: Record<string, string> = {}
    let hasError = false

    for (const field of Object.keys(validators)) {
      allTouched[field] = true
      const error = validators[field](form[field as keyof FormValues], form)
      allErrors[field] = error
      if (error) hasError = true
    }

    setTouched(allTouched)
    setErrors(allErrors)
    if (hasError) return

    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          role: form.role,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || '注册失败')
      }

      message.success('注册成功! 请登录')
      router.push('/login')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '注册失败，请重试')
      console.error('Register error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card sx={{ width: 400, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h5"
            sx={{ textAlign: 'center', fontWeight: 600, mb: 3 }}
          >
            Csaas 注册
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              id="name"
              name="name"
              fullWidth
              label="姓名"
              placeholder="姓名"
              autoComplete="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              error={touched.name && !!errors.name}
              helperText={touched.name && errors.name}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlined />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              id="email"
              name="email"
              fullWidth
              label="邮箱"
              placeholder="邮箱"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              error={touched.email && !!errors.email}
              helperText={touched.email && errors.email}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              id="password"
              name="password"
              fullWidth
              label="密码"
              placeholder="密码"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              error={touched.password && !!errors.password}
              helperText={touched.password && errors.password}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="切换密码可见性"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              id="confirmPassword"
              name="confirmPassword"
              fullWidth
              label="确认密码"
              placeholder="确认密码"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              error={touched.confirmPassword && !!errors.confirmPassword}
              helperText={touched.confirmPassword && errors.confirmPassword}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="切换确认密码可见性"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              id="role"
              name="role"
              fullWidth
              select
              label="角色"
              value={form.role}
              onChange={(e) => handleChange('role', e.target.value)}
              onBlur={() => handleBlur('role')}
              error={touched.role && !!errors.role}
              helperText={touched.role && errors.role}
              sx={{ mb: 3 }}
            >
              <MenuItem value="consultant">主咨询师</MenuItem>
              <MenuItem value="client_pm">企业PM</MenuItem>
              <MenuItem value="respondent">被调研者</MenuItem>
            </TextField>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mb: 2, py: 1.2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '注册'}
            </Button>

            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              已有账号？{' '}
              <Link href="/login" style={{ color: theme.palette.primary.main }}>
                立即登录
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
