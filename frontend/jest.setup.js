// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { ReadableStream } from 'node:stream/web'
import { TextDecoder, TextEncoder } from 'node:util'

class TestHeaders {
  constructor(init = {}) {
    this.map = new Map()
    if (init instanceof TestHeaders) {
      init.forEach((value, key) => this.set(key, value))
      return
    }
    Object.entries(init).forEach(([key, value]) => this.set(key, value))
  }

  get(key) {
    return this.map.get(String(key).toLowerCase()) ?? null
  }

  set(key, value) {
    this.map.set(String(key).toLowerCase(), String(value))
  }

  forEach(callback) {
    this.map.forEach((value, key) => callback(value, key))
  }
}

class TestResponse {
  constructor(body = null, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.headers = new TestHeaders(init.headers)
    this.ok = this.status >= 200 && this.status < 300
  }

  async text() {
    if (typeof this.body === 'string') return this.body
    if (!this.body) return ''
    if (typeof this.body?.getReader === 'function') {
      const reader = this.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
      }
      return text + decoder.decode()
    }
    return String(this.body)
  }

  async json() {
    return JSON.parse(await this.text())
  }
}

global.ReadableStream = global.ReadableStream ?? ReadableStream
global.TextEncoder = global.TextEncoder ?? TextEncoder
global.TextDecoder = global.TextDecoder ?? TextDecoder
global.Headers = global.Headers ?? TestHeaders
global.Response = global.Response ?? TestResponse

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Suppress console errors during tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
