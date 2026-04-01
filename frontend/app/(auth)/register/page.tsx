'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <div className="min-h-screen bg-[#FEFDFB] py-12 flex items-center">
      <div className="w-full max-w-md mx-auto px-4">
        <Card className="border border-[#E2E8F0] shadow-sm rounded-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#1E3A5F] py-10 px-6 text-center">
            <div className="relative z-10">
              <h1 className="text-2xl font-bold text-white mb-2 font-[var(--font-plus-jakarta)]">
                Csaas 注册
              </h1>
              <p className="text-white/80 text-sm font-[var(--font-inter)]">
                创建您的账号，开始使用
              </p>
            </div>
          </div>

          {/* Form */}
          <CardContent className="p-8 pt-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#1E3A5F]">姓名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="name"
                    name="name"
                    placeholder="请输入姓名"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    className={`pl-10 h-11 rounded-sm bg-white border-[#E2E8F0] ${
                      touched.name && errors.name
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#059669]'
                    }`}
                  />
                </div>
                {touched.name && errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1E3A5F]">邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="请输入邮箱"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    className={`pl-10 h-11 rounded-sm bg-white border-[#E2E8F0] ${
                      touched.email && errors.email
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#059669]'
                    }`}
                  />
                </div>
                {touched.email && errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#1E3A5F]">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码（至少8个字符）"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                    className={`pl-10 pr-10 h-11 rounded-sm bg-white border-[#E2E8F0] ${
                      touched.password && errors.password
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#059669]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E3A5F]"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[#1E3A5F]">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    className={`pl-10 pr-10 h-11 rounded-sm bg-white border-[#E2E8F0] ${
                      touched.confirmPassword && errors.confirmPassword
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#059669]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E3A5F]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-[#1E3A5F]">角色</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => handleChange('role', value)}
                >
                  <SelectTrigger
                    id="role"
                    aria-label="角色"
                    onBlur={() => handleBlur('role')}
                    className={`h-11 rounded-sm bg-white border-[#E2E8F0] ${
                      touched.role && errors.role
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'focus-visible:ring-[#059669]'
                    }`}
                  >
                    <SelectValue placeholder="请选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultant">主咨询师</SelectItem>
                    <SelectItem value="client_pm">企业PM</SelectItem>
                    <SelectItem value="respondent">被调研者</SelectItem>
                  </SelectContent>
                </Select>
                {touched.role && errors.role && (
                  <p className="text-sm text-red-500">{errors.role}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#1E3A5F] hover:bg-[#162e4d] text-white font-medium rounded-sm"
              >
                {loading ? '注册中...' : '注册'}
              </Button>

              <p className="text-sm text-[#94A3B8] text-center font-[var(--font-inter)]">
                已有账号？{' '}
                <Link
                  href="/login"
                  className="text-[#059669] font-semibold hover:underline"
                >
                  立即登录
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Back to home */}
        <p className="text-sm text-[#94A3B8] text-center mt-8 font-[var(--font-inter)]">
          <Link
            href="/"
            className="text-[#94A3B8] hover:text-[#1E3A5F]"
          >
            ← 返回首页
          </Link>
        </p>
      </div>
    </div>
  )
}
