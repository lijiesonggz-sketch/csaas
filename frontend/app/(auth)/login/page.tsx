'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { message } from '@/lib/message'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loginError, setLoginError] = useState('')

  const validateEmail = (value: string): string => {
    if (!value) return '请输入邮箱'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '请输入有效的邮箱地址'
    return ''
  }

  const validatePassword = (value: string): string => {
    if (!value) return '请输入密码'
    return ''
  }

  const validateField = (field: string, value: string) => {
    let error = ''
    if (field === 'email') error = validateEmail(value)
    if (field === 'password') error = validatePassword(value)
    setErrors((prev) => ({ ...prev, [field]: error }))
    return error
  }

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    validateField(field, value)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoginError('')

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    setErrors({ email: emailError, password: passwordError })
    setTouched({ email: true, password: true })

    if (emailError || passwordError) return

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setLoginError(result.error)
      } else {
        message.success('登录成功!')
        router.push('/dashboard')
      }
    } catch (error) {
      setLoginError('登录失败，请重试')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 flex items-center">
      <div className="w-full max-w-md mx-auto px-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 py-8 px-6 text-center">
            <div className="relative z-10">
              {/* Logo */}
              <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <TrendingUp className="w-9 h-9 text-white" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-1">
                欢迎回来
              </h1>
              <p className="text-white/90 text-sm">
                登录您的 Csaas 账号
              </p>
            </div>
          </div>

          {/* Form */}
          <CardContent className="p-6 pt-4">
            {loginError && (
              <Alert variant="destructive" className="mb-4 rounded-lg">
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="请输入邮箱"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (touched.email) validateField('email', e.target.value)
                    }}
                    onBlur={() => handleBlur('email', email)}
                    className={`pl-10 h-11 rounded-lg bg-white ${
                      touched.email && errors.email
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : ''
                    }`}
                  />
                </div>
                {touched.email && errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (touched.password) validateField('password', e.target.value)
                    }}
                    onBlur={() => handleBlur('password', password)}
                    className={`pl-10 pr-10 h-11 rounded-lg bg-white ${
                      touched.password && errors.password
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg"
              >
                {loading ? '登录中...' : '登录'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-sm text-slate-500 text-center">
                还没有账号？{' '}
                <Link
                  href="/register"
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  立即注册
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Back to home */}
        <p className="text-sm text-slate-500 text-center mt-6">
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-700"
          >
            ← 返回首页
          </Link>
        </p>
      </div>
    </div>
  )
}
