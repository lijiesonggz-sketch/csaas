import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const DEFAULT_USER_EMAIL = 'consultant-a@example.com'

type DensityLabel = '紧凑' | '默认' | '舒适'
const DENSITY_VALUE_BY_LABEL: Record<DensityLabel, string> = {
  紧凑: 'compact',
  默认: 'default',
  舒适: 'comfortable',
}

test.use({ viewport: DESKTOP_VIEWPORT })

function skipMobileProject(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name.startsWith('Mobile'),
    'Story 2.3 advisory E2E smoke is desktop-only; desktop-required fallback is covered separately.'
  )
}

async function mockAdvisorySession(page: Page, email = DEFAULT_USER_EMAIL) {
  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: email,
          name: 'ThinkTank Consultant',
          email,
          role: 'consultant',
          organizationId: 'org-123',
        },
        accessToken: `token-for-${email}`,
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )
}

async function mockAdvisoryAccess(
  page: Page,
  options: { allowed?: boolean; status?: number; message?: string } = {}
) {
  const { allowed = true, status = 200, message } = options
  await page.route('**/api/advisory/access**', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body:
        status === 403
          ? JSON.stringify({
              success: false,
              reason: 'module_disabled',
              message: message ?? 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
            })
          : JSON.stringify({ success: true, data: { allowed, module: 'thinktank' } }),
    })
  )
}

async function remockAuthorizedAdvisory(page: Page, email = DEFAULT_USER_EMAIL) {
  await page.unroute('**/api/auth/session**').catch(() => undefined)
  await page.unroute('**/api/advisory/access**').catch(() => undefined)
  await mockAdvisorySession(page, email)
  await mockAdvisoryAccess(page)
}

async function openAuthorizedAdvisory(page: Page, email = DEFAULT_USER_EMAIL) {
  await remockAuthorizedAdvisory(page, email)
  const accessReady = page.waitForResponse(
    (response) => response.url().includes('/api/advisory/access') && response.status() === 200
  )
  await page.goto('/advisory')
  await accessReady
  await expect(page.getByRole('region', { name: '咨询对话工作区' })).toBeVisible()
}

function readingDensityControl(page: Page): Locator {
  return page
    .getByRole('radiogroup', { name: /阅读密度/ })
    .or(page.getByRole('group', { name: /阅读密度/ }))
    .or(page.getByRole('combobox', { name: /阅读密度/ }))
}

async function selectDensityByKeyboard(page: Page, label: DensityLabel) {
  const radio = page.getByRole('radio', { name: label })
  if ((await radio.count()) > 0) {
    await radio.focus()
    await page.keyboard.press('Space')
    return
  }

  const combobox = page.getByRole('combobox', { name: /阅读密度/ })
  if ((await combobox.count()) > 0) {
    await combobox.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('option', { name: label }).click()
    return
  }

  const button = page.getByRole('button', { name: new RegExp(label) })
  await button.focus()
  await page.keyboard.press('Enter')
}

async function selectDensity(page: Page, label: DensityLabel) {
  const visibleLabel = readingDensityControl(page).getByText(label, { exact: true })
  if ((await visibleLabel.count()) > 0) {
    await visibleLabel.click()
    return
  }

  const combobox = page.getByRole('combobox', { name: /阅读密度/ })
  if ((await combobox.count()) > 0) {
    await combobox.click()
    await page.getByRole('option', { name: label }).click()
    return
  }

  await page.getByRole('button', { name: new RegExp(label) }).click()
}

async function expectSelectedDensity(page: Page, label: DensityLabel) {
  await expect(page.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
    'data-reading-density',
    DENSITY_VALUE_BY_LABEL[label]
  )

  const radio = page.getByRole('radio', { name: label })
  if ((await radio.count()) > 0) {
    await expect(radio.first()).toHaveAttribute('aria-checked', 'true')
    return
  }

  const combobox = page.getByRole('combobox', { name: /阅读密度/ })
  if ((await combobox.count()) > 0) {
    await expect(combobox).toContainText(label)
  }
}

async function visibleBox(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

function parseRgb(color: string): [number, number, number] {
  const channels = color
    .match(/\d+(\.\d+)?/g)
    ?.slice(0, 3)
    .map(Number)
  expect(channels).toHaveLength(3)
  return channels as [number, number, number]
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(parseRgb(foreground))
  const backgroundLuminance = relativeLuminance(parseRgb(background))
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

test.describe('Story 2.3 - Theme, Density, and Compatibility Baseline', () => {
  test('[2.3-E2E-001][P0] AC2 - reading density control is keyboard-operable and updates advisory reading state', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await openAuthorizedAdvisory(page)

    await expect(readingDensityControl(page)).toBeVisible()
    await expect(readingDensityControl(page).getByText('紧凑', { exact: true })).toBeVisible()
    await expect(readingDensityControl(page).getByText('默认', { exact: true })).toBeVisible()
    await expect(readingDensityControl(page).getByText('舒适', { exact: true })).toBeVisible()

    await selectDensityByKeyboard(page, '紧凑')

    await expectSelectedDensity(page, '紧凑')
    await expect(page.getByRole('status', { name: 'ThinkTank 工作台状态' })).toContainText(
      /阅读密度|紧凑/
    )
    await expect(page.getByRole('region', { name: '咨询对话工作区' })).toContainText('Quick Consult')
    await expect(page.getByRole('region', { name: '咨询对话工作区' })).toContainText(
      '选择一个工作流后，对话将在这里开始。'
    )
    await expect(page.getByRole('complementary', { name: '咨询工作流导航' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
  })

  test('[2.3-E2E-002][P0] AC2 - reading density persists per signed-in user and does not leak between users', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await openAuthorizedAdvisory(page, 'consultant-a@example.com')
    await selectDensity(page, '舒适')

    const reloadUserA = page.waitForResponse(
      (response) => response.url().includes('/api/advisory/access') && response.status() === 200
    )
    await page.reload()
    await reloadUserA
    await expectSelectedDensity(page, '舒适')

    await remockAuthorizedAdvisory(page, 'consultant-b@example.com')
    const loadUserB = page.waitForResponse(
      (response) => response.url().includes('/api/advisory/access') && response.status() === 200
    )
    await page.reload()
    await loadUserB
    await expectSelectedDensity(page, '默认')

    await selectDensity(page, '紧凑')
    await remockAuthorizedAdvisory(page, 'consultant-a@example.com')
    const reloadUserAAgain = page.waitForResponse(
      (response) => response.url().includes('/api/advisory/access') && response.status() === 200
    )
    await page.reload()
    await reloadUserAAgain
    await expectSelectedDensity(page, '舒适')
  })

  test('[2.3-E2E-003][P0] AC1/AC3 - advisory shell remains readable when hosted under the CSAAS dark class', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await page.addInitScript(() => document.documentElement.classList.add('dark'))
    await openAuthorizedAdvisory(page)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '咨询工作流导航' })).toBeVisible()
    await expect(page.getByRole('region', { name: '咨询对话工作区' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
    await expect(readingDensityControl(page)).toBeVisible()

    const colors = await page
      .getByRole('region', { name: '咨询对话工作区' })
      .evaluate((element) => {
        const style = window.getComputedStyle(element)
        return { backgroundColor: style.backgroundColor, color: style.color }
      })
    expect(contrastRatio(colors.color, colors.backgroundColor)).toBeGreaterThanOrEqual(4.5)
  })

  test('[2.3-E2E-004][P0] AC2 - desktop layout constraints keep shell regions stable and non-overlapping', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await openAuthorizedAdvisory(page)

    const header = await visibleBox(page.getByRole('banner'))
    const workflow = await visibleBox(page.getByRole('complementary', { name: '咨询工作流导航' }))
    const chat = await visibleBox(page.getByRole('region', { name: '咨询对话工作区' }))
    const drawer = await visibleBox(page.getByRole('complementary', { name: '咨询文档抽屉' }))
    const density = await visibleBox(readingDensityControl(page))

    expect.soft(Math.round(header.height)).toBe(56)
    expect.soft(Math.round(workflow.width)).toBe(240)
    expect.soft(Math.round(drawer.width)).toBe(64)
    expect.soft(chat.width).toBeGreaterThanOrEqual(480)
    expect.soft(workflow.x + workflow.width).toBeLessThanOrEqual(chat.x + 1)
    expect.soft(chat.x + chat.width).toBeLessThanOrEqual(drawer.x + 1)
    expect.soft(density.y).toBeGreaterThanOrEqual(chat.y)
    expect.soft(density.y + density.height).toBeLessThanOrEqual(chat.y + 96)
  })

  test('[2.3-E2E-005][P0] AC2/AC3 - preference hydration keeps loading denied desktop-required and authorized states stable', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await mockAdvisorySession(page)
    let releaseAccess!: () => void
    const accessGate = new Promise<void>((resolve) => {
      releaseAccess = resolve
    })
    await page.route('**/api/advisory/access**', async (route) => {
      await accessGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { allowed: true, module: 'thinktank' } }),
      })
    })

    await page.goto('/advisory')
    await expect(page.getByRole('status', { name: 'ThinkTank 访问验证状态' })).toHaveText(
      '正在验证 ThinkTank 访问权限'
    )
    releaseAccess()
    await expect(page.getByRole('region', { name: '咨询对话工作区' })).toBeVisible()
    await expect(readingDensityControl(page)).toBeVisible()

    await page.unroute('**/api/advisory/access**')
    await mockAdvisoryAccess(page, {
      status: 403,
      allowed: false,
      message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
    })
    const deniedAccess = page.waitForResponse(
      (response) => response.url().includes('/api/advisory/access') && response.status() === 403
    )
    await page.reload()
    await deniedAccess
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'ThinkTank 当前未在本租户启用，请联系管理员开通。' })
    ).toContainText('ThinkTank 当前未在本租户启用，请联系管理员开通。')

    await page.setViewportSize({ width: 900, height: 800 })
    await remockAuthorizedAdvisory(page)
    const narrowAccess = page.waitForResponse(
      (response) => response.url().includes('/api/advisory/access') && response.status() === 200
    )
    await page.goto('/advisory')
    await narrowAccess
    await expect(page.getByRole('status', { name: 'ThinkTank 桌面端要求' })).toContainText(
      'ThinkTank MVP 当前需要桌面端宽屏使用'
    )
  })

  test('[2.3-E2E-006][P2] AC3 - configured desktop browser projects smoke-test the advisory shell baseline', async ({
    browserName,
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    expect(['chromium', 'firefox', 'webkit']).toContain(browserName)
    await openAuthorizedAdvisory(page)

    await expect(page.getByRole('heading', { name: 'ThinkTank' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'ThinkTank 工作台状态' })).toContainText(
      'ThinkTank 已启用'
    )
    await expect(readingDensityControl(page)).toBeVisible()
    await expect(page.getByRole('button', { name: '打开咨询文档抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(page.getByRole('heading', { name: 'Quick Consult' })).toBeVisible()
    await expect(page.getByText('选择一个工作流后，对话将在这里开始。')).toBeVisible()
  })
})
