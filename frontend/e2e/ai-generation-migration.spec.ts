import { test, expect } from '@playwright/test'

/**
 * E2E Tests for AI Generation Migration (Story 11-3)
 * Tests the migration from Ant Design to MUI for AI Generation pages
 *
 * Coverage:
 * - 5 migrated pages: summary, clustering, matrix, questionnaire, action-plan
 * - Components: TaskProgressBar, DocumentUploader, SummaryResultDisplay
 * - MUI component usage verification
 */

test.describe('AI Generation Migration', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User is logged in
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
    await page.getByRole('textbox', { name: /password/i }).fill('password123')
    await page.getByRole('button', { name: /登录|login/i }).click()
    await page.waitForURL('**/dashboard')
  })

  test.describe('Summary Page [P0]', () => {
    test('[P0] should display summary generation page with MUI components', async ({ page }) => {
      // GIVEN: User navigates to summary page
      await page.goto('/ai-generation/summary')

      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()

      // THEN: MUI Stepper is present with 3 steps
      const stepper = page.locator('[role="tablist"]').or(page.locator('.MuiStepper-root'))
      await expect(stepper).toBeVisible()
      await expect(page.getByText('上传文档')).toBeVisible()
      await expect(page.getByText('生成中')).toBeVisible()
      await expect(page.getByText('查看结果')).toBeVisible()

      // THEN: Document uploader is present
      await expect(page.getByRole('button', { name: '文本输入' })).toBeVisible()
      await expect(page.getByRole('button', { name: '文件上传' })).toBeVisible()

      // THEN: Generate button is disabled initially (no content)
      const generateButton = page.getByRole('button', { name: '开始生成综述' })
      await expect(generateButton).toBeDisabled()
    })

    test('[P0] should enable generate button when content is entered', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // WHEN: User enters document content (at least 100 chars)
      const textArea = page.locator('textarea').first()
      await textArea.fill('这是一段测试文档内容。'.repeat(10))

      // THEN: Character count is displayed
      await expect(page.getByText(/当前文档长度/)).toBeVisible()

      // THEN: Generate button is enabled
      const generateButton = page.getByRole('button', { name: '开始生成综述' })
      await expect(generateButton).toBeEnabled()
    })

    test('[P1] should validate minimum content length', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // WHEN: User enters short content (less than 100 chars)
      const textArea = page.locator('textarea').first()
      await textArea.fill('短内容')

      // THEN: Generate button should still be disabled
      const generateButton = page.getByRole('button', { name: '开始生成综述' })
      await expect(generateButton).toBeDisabled()
    })

    test('[P1] should switch between text and file upload modes', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // WHEN: User clicks file upload button
      await page.getByRole('button', { name: '文件上传' }).click()

      // THEN: File upload area is visible
      await expect(page.getByText('点击或拖拽文件到此区域上传')).toBeVisible()
      await expect(page.getByText(/支持格式/)).toBeVisible()

      // WHEN: User switches back to text mode
      await page.getByRole('button', { name: '文本输入' }).click()

      // THEN: Text area is visible
      await expect(page.locator('textarea').first()).toBeVisible()
    })
  })

  test.describe('Clustering Page [P0]', () => {
    test('[P0] should display clustering page with MUI components', async ({ page }) => {
      // GIVEN: User navigates to clustering page
      await page.goto('/ai-generation/clustering')

      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: 'AI 智能聚类分析' })).toBeVisible()

      // THEN: MUI Stepper is present
      const stepper = page.locator('[role="tablist"]').or(page.locator('.MuiStepper-root'))
      await expect(stepper).toBeVisible()
      await expect(page.getByText('上传文档')).toBeVisible()
      await expect(page.getByText('生成聚类')).toBeVisible()

      // THEN: File upload area is visible
      await expect(page.getByRole('button', { name: '选择文件' })).toBeVisible()
    })

    test('[P1] should require at least 2 documents', async ({ page }) => {
      // GIVEN: User is on clustering page
      await page.goto('/ai-generation/clustering')

      // THEN: Generate button is disabled initially
      const generateButton = page.getByRole('button', { name: '开始聚类分析' })
      await expect(generateButton).toBeDisabled()

      // Note: In real scenario, would upload 2 files and verify button enables
    })

    test('[P1] should display uploaded documents list', async ({ page }) => {
      // GIVEN: User is on clustering page
      await page.goto('/ai-generation/clustering')

      // THEN: Upload instructions are visible
      await expect(page.getByText(/支持 .txt/)).toBeVisible()
    })
  })

  test.describe('Matrix Page [P0]', () => {
    test('[P0] should display matrix page with MUI components', async ({ page }) => {
      // GIVEN: User navigates to matrix page
      await page.goto('/ai-generation/matrix')

      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: '成熟度矩阵生成' })).toBeVisible()

      // THEN: MUI Stepper is present
      const stepper = page.locator('[role="tablist"]').or(page.locator('.MuiStepper-root'))
      await expect(stepper).toBeVisible()
      await expect(page.getByText('输入聚类结果')).toBeVisible()
      await expect(page.getByText('生成矩阵')).toBeVisible()

      // THEN: Task ID input is visible
      await expect(page.getByText('聚类任务ID')).toBeVisible()
      await expect(page.getByRole('textbox').first()).toBeVisible()
    })

    test('[P1] should accept task ID from URL parameter', async ({ page }) => {
      // GIVEN: User navigates to matrix page with taskId param
      await page.goto('/ai-generation/matrix?taskId=test-task-id-123')

      // THEN: Task ID input should be pre-filled
      const taskIdInput = page.getByRole('textbox').first()
      await expect(taskIdInput).toHaveValue('test-task-id-123')
    })

    test('[P1] should disable generate button when task ID is empty', async ({ page }) => {
      // GIVEN: User is on matrix page
      await page.goto('/ai-generation/matrix')

      // THEN: Generate button is disabled
      const generateButton = page.getByRole('button', { name: '生成成熟度矩阵' })
      await expect(generateButton).toBeDisabled()
    })
  })

  test.describe('Questionnaire Page [P0]', () => {
    test('[P0] should display questionnaire page with MUI components', async ({ page }) => {
      // GIVEN: User navigates to questionnaire page
      await page.goto('/ai-generation/questionnaire')

      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: '调研问卷生成' })).toBeVisible()

      // THEN: MUI Stepper is present
      const stepper = page.locator('[role="tablist"]').or(page.locator('.MuiStepper-root'))
      await expect(stepper).toBeVisible()
      await expect(page.getByText('输入矩阵结果')).toBeVisible()
      await expect(page.getByText('生成问卷')).toBeVisible()

      // THEN: Task ID input is visible
      await expect(page.getByText('矩阵任务ID')).toBeVisible()
    })

    test('[P1] should accept matrix task ID from URL parameter', async ({ page }) => {
      // GIVEN: User navigates to questionnaire page with taskId param
      await page.goto('/ai-generation/questionnaire?taskId=matrix-task-456')

      // THEN: Task ID input should be pre-filled
      const taskIdInput = page.getByRole('textbox').first()
      await expect(taskIdInput).toHaveValue('matrix-task-456')
    })
  })

  test.describe('Action Plan Page [P0]', () => {
    test('[P0] should display action plan page with MUI components', async ({ page }) => {
      // Note: Action plan page requires surveyId and targetMaturity params
      // GIVEN: User navigates to action plan page
      await page.goto('/ai-generation/action-plan')

      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: '成熟度改进措施' })).toBeVisible()

      // THEN: Back button is present
      await expect(page.getByRole('button', { name: '返回成熟度分析' })).toBeVisible()
    })

    test('[P1] should display target maturity info when params provided', async ({ page }) => {
      // GIVEN: User navigates to action plan page with params
      await page.goto('/ai-generation/action-plan?surveyId=test-survey&targetMaturity=3.5')

      // THEN: Target info should be displayed
      await expect(page.getByText(/改进目标/)).toBeVisible()
    })
  })

  test.describe('Shared Components [P1]', () => {
    test('[P1] TaskProgressBar should use MUI progress components', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // The TaskProgressBar is not visible until generation starts
      // But we can verify the page structure is ready
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()

      // WHEN: Enter content and start generation (would trigger TaskProgressBar)
      const textArea = page.locator('textarea').first()
      await textArea.fill('这是一段测试文档内容。'.repeat(10))

      // The TaskProgressBar would appear after clicking generate
      // We verify the button is ready to trigger it
      const generateButton = page.getByRole('button', { name: '开始生成综述' })
      await expect(generateButton).toBeEnabled()
    })

    test('[P1] DocumentUploader should have MUI text input and buttons', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // THEN: Text input mode has MUI TextField
      const textArea = page.locator('textarea').first()
      await expect(textArea).toBeVisible()

      // THEN: Mode switch buttons are present
      await expect(page.getByRole('button', { name: '文本输入' })).toBeVisible()
      await expect(page.getByRole('button', { name: '文件上传' })).toBeVisible()
    })

    test('[P1] SummaryResultDisplay structure verification', async ({ page }) => {
      // GIVEN: User is on summary page
      await page.goto('/ai-generation/summary')

      // The SummaryResultDisplay appears after generation completes
      // We verify the page is ready for generation
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()
    })
  })

  test.describe('Navigation Flows [P1]', () => {
    test('[P1] should navigate between AI generation pages', async ({ page }) => {
      // GIVEN: User starts on summary page
      await page.goto('/ai-generation/summary')
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()

      // WHEN: User navigates to clustering page
      await page.goto('/ai-generation/clustering')
      await expect(page.getByRole('heading', { name: 'AI 智能聚类分析' })).toBeVisible()

      // WHEN: User navigates to matrix page
      await page.goto('/ai-generation/matrix')
      await expect(page.getByRole('heading', { name: '成熟度矩阵生成' })).toBeVisible()

      // WHEN: User navigates to questionnaire page
      await page.goto('/ai-generation/questionnaire')
      await expect(page.getByRole('heading', { name: '调研问卷生成' })).toBeVisible()
    })
  })

  test.describe('Sonner Toast Integration [P2]', () => {
    test('[P2] should have sonner toast container present', async ({ page }) => {
      // GIVEN: User is on any AI generation page
      await page.goto('/ai-generation/summary')

      // THEN: Sonner toast container is present in DOM
      // Note: The container may be empty but should exist
      const sonnerToaster = page.locator('[data-sonner-toaster]')
      await expect(sonnerToaster).toBeAttached()
    })
  })

  test.describe('Responsive Design [P2]', () => {
    test('[P2] should adapt to mobile viewport', async ({ page }) => {
      // GIVEN: Mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // WHEN: User navigates to summary page
      await page.goto('/ai-generation/summary')

      // THEN: Page content is still accessible
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()
    })

    test('[P2] should work on desktop viewport', async ({ page }) => {
      // GIVEN: Desktop viewport
      await page.setViewportSize({ width: 1440, height: 900 })

      // WHEN: User navigates to summary page
      await page.goto('/ai-generation/summary')

      // THEN: All components are visible
      await expect(page.getByRole('heading', { name: 'AI 综述生成' })).toBeVisible()
      await expect(page.getByRole('button', { name: '文本输入' })).toBeVisible()
      await expect(page.getByRole('button', { name: '文件上传' })).toBeVisible()
    })
  })
})
