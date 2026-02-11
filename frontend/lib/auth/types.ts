export enum UserRole {
  CONSULTANT = 'consultant', // 主咨询师
  CLIENT_PM = 'client_pm', // 企业PM
  RESPONDENT = 'respondent', // 被调研者
  ADMIN = 'admin', // 管理员
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  tenantId?: string
  organizationId?: string
  organizationRole?: string
}

declare module 'next-auth' {
  interface Session {
    user: User
    accessToken: string
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    tenantId?: string
    organizationId?: string
    organizationRole?: string
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name: string
    role: UserRole
    tenantId?: string
    organizationId?: string
    organizationRole?: string
    accessToken: string
  }
}
