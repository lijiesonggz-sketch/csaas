import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserRole } from './types'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[NextAuth] authorize called with:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
        })

        if (!credentials?.email || !credentials?.password) {
          throw new Error('请输入邮箱和密码')
        }

        try {
          // Call backend API to verify credentials
          const apiUrl =
            process.env.INTERNAL_API_URL ||
            process.env.NEXT_PUBLIC_API_URL ||
            'http://localhost:3000'
          console.log('[NextAuth] Calling backend API:', apiUrl)

          const res = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          console.log('[NextAuth] Backend response status:', res.status)

          const data = await res.json()
          console.log('[NextAuth] Backend response data:', {
            success: data.success,
            hasUser: !!data.data?.user,
            hasToken: !!data.data?.access_token
          })

          if (!res.ok) {
            console.error('[NextAuth] Login failed:', data)
            throw new Error(data.message || '登录失败')
          }

          // Return user object with token
          const user = {
            id: data.data.user.id,
            email: data.data.user.email,
            name: data.data.user.name,
            role: data.data.user.role,
            tenantId: data.data.user.tenantId,
            organizationId: data.data.user.organizationId,
            organizationRole: data.data.user.organizationRole,
            accessToken: data.data.access_token,
          }

          console.log('[NextAuth] Returning user:', {
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
            hasAccessToken: !!user.accessToken
          })

          return user
        } catch (error) {
          console.error('Login error:', error)
          throw new Error(error instanceof Error ? error.message : '登录失败')
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.tenantId = user.tenantId
        token.organizationId = user.organizationId
        token.organizationRole = user.organizationRole
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.user = {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as UserRole,
        tenantId: token.tenantId as string,
        organizationId: token.organizationId as string,
        organizationRole: token.organizationRole as string,
      }
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
