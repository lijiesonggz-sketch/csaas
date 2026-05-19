export const story21DesktopAccess = {
  allowed: true,
  module: 'thinktank',
} as const

export const story21DeniedAccess = {
  allowed: false,
  module: 'thinktank',
  message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
} as const

export const story21DisabledTenantAccess = {
  allowed: false,
  module: 'thinktank',
  reason: 'module_disabled',
  message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
} as const

export const story21AuthenticatedSession = {
  user: {
    id: '770e8400-e29b-41d4-a716-446655440021',
    email: 'consultant@example.com',
    name: 'ThinkTank Consultant',
    role: 'consultant',
    organizationId: '660e8400-e29b-41d4-a716-446655440021',
  },
} as const

export const story21ExpectedShellRegions = {
  globalBanner: 'banner',
  globalNavigationName: '主导航',
  advisorySidebarName: '咨询工作流导航',
  conversationWorkspaceName: '咨询对话工作区',
  documentDrawerName: '咨询文档抽屉',
  collapsedDocumentDrawerButtonName: '展开咨询文档抽屉',
} as const

export const story21DesktopRequiredMessage = 'ThinkTank MVP 当前需要桌面端宽屏使用'
export const story21WorkspaceHeading = 'ThinkTank'
export const story21ConversationEmptyState = '选择一个工作流后，对话将在这里开始。'
export const story21DocumentDrawerCollapsedText = '文档'

export function installStory21MatchMedia(matchesDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('1024px') ? matchesDesktop : false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

