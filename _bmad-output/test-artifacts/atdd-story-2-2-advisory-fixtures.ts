import type { ThinkTankAccessResult } from '@/lib/advisory/access'

export const story22AuthenticatedSession = {
  user: {
    name: 'ThinkTank Consultant',
    email: 'consultant@example.com',
    role: 'consultant',
    organizationId: 'org-123',
  },
}

export const story22DesktopAccess: ThinkTankAccessResult = {
  allowed: true,
  module: 'thinktank',
}

export const story22DeniedAccess: ThinkTankAccessResult = {
  allowed: false,
  module: 'thinktank',
  message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}

export const story22DisabledTenantAccess: ThinkTankAccessResult = {
  allowed: false,
  module: 'thinktank',
  reason: 'module_disabled',
  message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
}

export const story22LandmarkLabels = {
  workflowSidebar: '咨询工作流导航',
  conversationRegion: '咨询对话工作区',
  documentDrawer: '咨询文档抽屉',
  workflowNav: '咨询工作流',
}

export const story22StateCopy = {
  accessLoading: '正在验证 ThinkTank 访问权限',
  viewportLoading: '正在准备 ThinkTank 工作区',
  desktopRequired: 'ThinkTank MVP 当前需要桌面端宽屏使用',
  noActiveSession: '暂无活动会话',
  enabled: '已启用',
  emptyConversation: '选择一个工作流后，对话将在这里开始。',
  drawerUnavailable: '文档抽屉将在报告草稿接入后开放',
}

export function installStory22MatchMedia(desktop: boolean) {
  let matchesDesktop = desktop
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()

  const getListeners = (query: string) => {
    if (!listeners.has(query)) {
      listeners.set(query, new Set())
    }
    return listeners.get(query)!
  }

  const readMatches = (query: string) => {
    if (query.includes('1024px')) return matchesDesktop
    if (query.includes('767px')) return false
    return false
  }

  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    get matches() {
      return readMatches(query)
    },
    media: query,
    onchange: null,
    addListener: jest.fn((listener: (event: MediaQueryListEvent) => void) => {
      getListeners(query).add(listener)
    }),
    removeListener: jest.fn((listener: (event: MediaQueryListEvent) => void) => {
      getListeners(query).delete(listener)
    }),
    addEventListener: jest.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') getListeners(query).add(listener)
    }),
    removeEventListener: jest.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') getListeners(query).delete(listener)
      },
    ),
    dispatchEvent: jest.fn(),
  }))

  return {
    setDesktop(next: boolean) {
      matchesDesktop = next
      getListeners('(min-width: 1024px)').forEach((listener) => {
        listener({ matches: next, media: '(min-width: 1024px)' } as MediaQueryListEvent)
      })
    },
  }
}
