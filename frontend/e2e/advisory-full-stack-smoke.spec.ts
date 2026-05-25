import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type Response as PlaywrightResponse } from '@playwright/test'

type QueryResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rows: T[]
  rowCount: number | null
}

type PgClient = {
  connect: () => Promise<void>
  end: () => Promise<void>
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<QueryResult<T>>
}

type PgClientConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const { Client } = requireFromWorkspace('pg') as {
  Client: new (config: PgClientConfig) => PgClient
}
const bcrypt = requireFromWorkspace('bcryptjs') as {
  hash: (password: string, saltRounds: number) => Promise<string>
}

const SMOKE_FIXTURE = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  userId: '22222222-2222-4222-8222-222222222223',
  organizationId: '22222222-2222-4222-8222-222222222224',
  memberId: '22222222-2222-4222-8222-222222222225',
  moduleConfigId: '22222222-2222-4222-8222-222222222226',
  outputId: '22222222-2222-4222-8222-222222222227',
  email: 'thinktank-fullstack-smoke@example.com',
  password: 'FullStackSmoke!2026',
} as const

const REQUIRED_ADVISORY_TABLES = [
  'advisory_module_configs',
  'organization_context',
  'workflow_sessions',
  'workflow_checkpoints',
  'conversation_messages',
  'workflow_outputs',
  'quick_consult_contexts',
  'recommendation_feedback',
  'output_ratings',
  'output_knowledge_base_associations',
] as const

const REQUIRED_ADVISORY_MIGRATIONS = [
  'CreateAdvisoryModuleConfigs1772000000029',
  'CreateAdvisoryWorkflowSessions1772000000030',
  'CreateAdvisoryConversationMessages1772000000031',
  'CreateAdvisoryWorkflowOutputs1772000000033',
  'CreateAdvisoryQuickConsultContexts1772000000034',
  'CreateAdvisoryRecommendationFeedback1772000000035',
  'CreateAdvisoryOrganizationContext1772000000036',
  'CreateAdvisoryWorkflowCheckpoints1772000000037',
  'CreateAdvisoryOutputRatings1772000000038',
  'CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039',
  'AddAdvisorySafeExitLifecycleStatuses1772000000040',
] as const

test.describe('ThinkTank full-stack smoke', () => {
  test.beforeAll(async () => {
    await withDb(async (client) => {
      await assertAdvisorySchemaReady(client)
      await cleanupSmokeFixture(client)
      await seedSmokeFixture(client)
    })
  })

  test.afterAll(async () => {
    await withDb(async (client) => {
      await cleanupSmokeFixture(client)
    })
  })

  test('[P0][FULLSTACK] opens ThinkTank, persists org context, launches, exits, and tombstones output', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.stack ?? error.message)
    })
    await page.setViewportSize({ width: 1440, height: 900 })

    await test.step('login through the real NextAuth credentials flow', async () => {
      await page.goto('/login')
      await page.getByLabel('邮箱').fill(SMOKE_FIXTURE.email)
      await page.getByLabel('密码').fill(SMOKE_FIXTURE.password)

      const loginResponsePromise = waitForApiResponse(
        page,
        '/api/auth/callback/credentials',
        'POST'
      )
      await page.getByRole('button', { name: /^登录$/ }).click()
      await expectOk(await loginResponsePromise, 'NextAuth credentials login')
      await page.waitForURL('**/dashboard', { timeout: 30_000 })
    })

    let sessionId = ''

    await test.step('open ThinkTank through real advisory API proxies', async () => {
      const accessPromise = waitForApiResponse(page, '/api/advisory/access')
      const workflowsPromise = waitForApiResponse(page, '/api/advisory/workflows')
      const contextPromise = waitForApiResponse(page, '/api/advisory/organization-context')
      const unfinishedPromise = waitForApiResponse(page, '/api/advisory/sessions/unfinished')
      const historyPromise = waitForApiResponse(page, '/api/advisory/sessions/history')

      await page.goto('/advisory')

      await expectOk(await accessPromise, 'ThinkTank access')
      await expectOk(await workflowsPromise, 'ThinkTank workflow catalog')
      await expectOk(await contextPromise, 'organization context load')
      await expectOk(await unfinishedPromise, 'unfinished sessions load')
      await expectOk(await historyPromise, 'session history load')

      await expect(page.getByRole('region', { name: '咨询对话工作区' })).toBeVisible()
      await expect(page.getByRole('dialog', { name: '企业背景' })).toBeVisible()
    })

    await test.step('persist enterprise background through the real organization-context endpoint', async () => {
      const dialog = page.getByRole('dialog', { name: '企业背景' })
      await expect(dialog).toBeVisible()
      await page.getByLabel('企业名称').fill('ThinkTank Full-stack Smoke Co.')
      await page.getByLabel('行业').fill('企业软件')
      await page.getByLabel('规模').fill('100-500人')

      const saveContextPromise = waitForApiResponse(
        page,
        '/api/advisory/organization-context',
        'PUT'
      )
      await page.getByRole('button', { name: '保存并开始' }).click()
      await expectOk(await saveContextPromise, 'organization context save')
      await expect(dialog).toBeHidden()
      await expect(page.getByRole('heading', { name: /^ThinkTank$/ })).toBeVisible()
      await expect(page.getByText('已启用', { exact: true })).toBeVisible()
    })

    await test.step('launch a real workflow session and load its messages', async () => {
      const launchPromise = waitForApiResponse(
        page,
        '/api/advisory/workflows/brainstorming/launch',
        'POST'
      )
      const messagesPromise = page.waitForResponse(
        (response) => {
          const url = new URL(response.url())
          return (
            response.request().method() === 'GET' &&
            url.pathname.startsWith('/api/advisory/sessions/') &&
            url.pathname.endsWith('/messages')
          )
        },
        { timeout: 45_000 }
      )

      await page.getByRole('button', { name: /启动 Brainstorming/i }).click()

      const launchResponse = await launchPromise
      await expectOk(launchResponse, 'workflow launch')
      const launchBody = await launchResponse.json()
      const launchData = unwrapAdvisoryData<{
        sessionId?: string
        workflow?: { key?: string }
      }>(launchBody)
      sessionId = launchData?.sessionId ?? ''
      expect(sessionId, 'launch response should include sessionId').toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
      expect(launchData?.workflow?.key).toBe('brainstorming')

      await withDb((client) => seedDraftOutputForSession(client, sessionId))
      await expectOk(await messagesPromise, 'session messages load')
      await expect(page.getByRole('button', { name: '安全退出工作流' })).toBeVisible()
    })

    await test.step('safe-exit and delete the session through real lifecycle APIs', async () => {
      await page.getByRole('button', { name: '安全退出工作流' }).click()
      await expect(page.getByRole('alertdialog', { name: '退出 ThinkTank 工作流' })).toBeVisible()

      const exitPromise = waitForApiResponse(
        page,
        `/api/advisory/sessions/${sessionId}/exit`,
        'POST'
      )
      await page.getByRole('button', { name: '确认退出' }).click()
      await expectOk(await exitPromise, 'safe exit session')
      await expect(page.getByText('暂无活动会话', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: /移除会话 Brainstorming/i }).click()
      await expect(page.getByRole('alertdialog', { name: '删除 ThinkTank 会话' })).toBeVisible()

      const deletePromise = waitForApiResponse(
        page,
        `/api/advisory/sessions/${sessionId}`,
        'DELETE'
      )
      await page.getByRole('button', { name: '删除会话' }).click()
      const deleteResponse = await deletePromise
      await expectOk(deleteResponse, 'delete session')
      const deleteBody = await deleteResponse.json()
      const deleteData = unwrapAdvisoryData<{ outputIds?: string[] }>(deleteBody)
      expect(deleteData?.outputIds).toContain(SMOKE_FIXTURE.outputId)
      await expect(page.getByText('暂无活动会话', { exact: true })).toBeVisible()
    })

    await test.step('verify workflow_outputs tombstone metadata in PostgreSQL', async () => {
      await withDb(async (client) => {
        const result = await client.query<{
          status: string
          deleted_at: string | null
          deleted_by: string | null
          delete_source: string | null
          previous_status: string | null
        }>(
          `
          SELECT
            "status",
            "metadata" ->> 'deleted_at' AS deleted_at,
            "metadata" ->> 'deleted_by' AS deleted_by,
            "metadata" ->> 'delete_source' AS delete_source,
            "metadata" ->> 'previous_status' AS previous_status
          FROM "workflow_outputs"
          WHERE "tenant_id" = $1 AND "id" = $2
          `,
          [SMOKE_FIXTURE.tenantId, SMOKE_FIXTURE.outputId]
        )

        expect(result.rows).toHaveLength(1)
        expect(result.rows[0]).toMatchObject({
          status: 'deleted',
          deleted_by: SMOKE_FIXTURE.userId,
          delete_source: 'session_delete',
          previous_status: 'draft',
        })
        expect(result.rows[0].deleted_at).toBeTruthy()
      })
    })

    expect(
      pageErrors,
      `Unexpected browser page errors during full-stack smoke:\n${pageErrors.join('\n\n')}`
    ).toEqual([])
  })
})

async function withDb<T>(work: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new Client(readDbConfig())
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

function readDbConfig(): PgClientConfig {
  const env = readEnvFile(path.join(REPO_ROOT, 'backend', '.env.development'))

  return {
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME ?? 'postgres',
    password: env.DB_PASSWORD ?? 'postgres',
    database: env.DB_DATABASE ?? 'csaas',
  }
}

function requireFromWorkspace(packageName: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(
    require.resolve(packageName, {
      paths: [path.join(REPO_ROOT, 'backend'), REPO_ROOT, path.join(REPO_ROOT, 'frontend')],
    })
  )
}

function readEnvFile(filePath: string): Record<string, string> {
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) return env
      env[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1)
      return env
    }, {})
}

async function assertAdvisorySchemaReady(client: PgClient) {
  const tableResult = await client.query<{ table_name: string; regclass: string | null }>(
    `
    SELECT required.table_name, to_regclass('public.' || required.table_name) AS regclass
    FROM unnest($1::text[]) AS required(table_name)
    `,
    [[...REQUIRED_ADVISORY_TABLES]]
  )
  const missingTables = tableResult.rows
    .filter((row) => !row.regclass)
    .map((row) => row.table_name)
    .sort()
  expect(
    missingTables,
    `Missing ThinkTank tables. Run backend migrations before full-stack smoke: ${missingTables.join(', ')}`
  ).toEqual([])

  const migrationResult = await client.query<{ name: string }>(
    `SELECT "name" FROM "migrations" WHERE "name" = ANY($1::text[])`,
    [[...REQUIRED_ADVISORY_MIGRATIONS]]
  )
  const applied = new Set(migrationResult.rows.map((row) => row.name))
  const missingMigrations = REQUIRED_ADVISORY_MIGRATIONS.filter((name) => !applied.has(name))
  expect(
    missingMigrations,
    `Missing ThinkTank migration records. Run backend migrations before full-stack smoke: ${missingMigrations.join(', ')}`
  ).toEqual([])
}

async function seedSmokeFixture(client: PgClient) {
  const passwordHash = await bcrypt.hash(SMOKE_FIXTURE.password, 10)

  await client.query(
    `
    INSERT INTO "tenants" (
      "id", "name", "subscription_tier", "is_active", "created_at", "updated_at"
    )
    VALUES ($1, 'ThinkTank Full-stack Smoke Tenant', 'pro', TRUE, NOW(), NOW())
    `,
    [SMOKE_FIXTURE.tenantId]
  )

  await client.query(
    `
    INSERT INTO "users" (
      "id",
      "email",
      "password_hash",
      "role",
      "name",
      "tenant_id",
      "created_at",
      "updated_at",
      "failed_login_attempts",
      "locked_until",
      "last_login_at"
    )
    VALUES ($1, $2, $3, 'admin', 'ThinkTank Smoke Admin', $4, NOW(), NOW(), 0, NULL, NULL)
    `,
    [SMOKE_FIXTURE.userId, SMOKE_FIXTURE.email, passwordHash, SMOKE_FIXTURE.tenantId]
  )

  await client.query(
    `
    INSERT INTO "organizations" (
      "id", "name", "tenant_id", "radar_activated", "status", "created_at", "updated_at"
    )
    VALUES ($1, 'ThinkTank Full-stack Smoke Org', $2, TRUE, 'active', NOW(), NOW())
    `,
    [SMOKE_FIXTURE.organizationId, SMOKE_FIXTURE.tenantId]
  )

  await client.query(
    `
    INSERT INTO "organization_members" ("id", "organization_id", "user_id", "role", "created_at")
    VALUES ($1, $2, $3, 'admin', NOW())
    `,
    [SMOKE_FIXTURE.memberId, SMOKE_FIXTURE.organizationId, SMOKE_FIXTURE.userId]
  )

  await client.query(
    `
    INSERT INTO "advisory_module_configs" (
      "id",
      "tenant_id",
      "module_key",
      "enabled",
      "allowed_roles",
      "data_retention_days",
      "privacy_confirmed_at",
      "privacy_confirmed_by",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at"
    )
    VALUES (
      $1,
      $2,
      'thinktank',
      TRUE,
      ARRAY['admin']::text[],
      90,
      NOW(),
      $3,
      $3,
      $3,
      NOW(),
      NOW()
    )
    `,
    [SMOKE_FIXTURE.moduleConfigId, SMOKE_FIXTURE.tenantId, SMOKE_FIXTURE.userId]
  )
}

async function seedDraftOutputForSession(client: PgClient, sessionId: string) {
  await client.query(
    `
    INSERT INTO "workflow_outputs" (
      "id",
      "tenant_id",
      "session_id",
      "actor_id",
      "workflow_key",
      "status",
      "title",
      "summary",
      "content_markdown",
      "sections",
      "ai_label_metadata",
      "metadata",
      "created_at",
      "updated_at"
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'brainstorming',
      'draft',
      'Full-stack smoke report draft',
      'Smoke output seeded to exercise session delete tombstoning.',
      '# Full-stack smoke report draft',
      '[]'::jsonb,
      '{"visible_label":"[AI Generated]"}'::jsonb,
      '{"source":"full_stack_smoke"}'::jsonb,
      NOW(),
      NOW()
    )
    `,
    [SMOKE_FIXTURE.outputId, SMOKE_FIXTURE.tenantId, sessionId, SMOKE_FIXTURE.userId]
  )
}

async function cleanupSmokeFixture(client: PgClient) {
  await client.query(`DELETE FROM "output_knowledge_base_associations" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "output_ratings" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "recommendation_feedback" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "quick_consult_contexts" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "workflow_checkpoints" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "conversation_messages" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "workflow_outputs" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "workflow_sessions" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "organization_context" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(`DELETE FROM "advisory_module_configs" WHERE "tenant_id" = $1`, [
    SMOKE_FIXTURE.tenantId,
  ])
  await client.query(
    `DELETE FROM "organization_members" WHERE "organization_id" = $1 OR "user_id" = $2`,
    [SMOKE_FIXTURE.organizationId, SMOKE_FIXTURE.userId]
  )
  await client.query(`DELETE FROM "organizations" WHERE "tenant_id" = $1`, [SMOKE_FIXTURE.tenantId])
  await client.query(`DELETE FROM "users" WHERE "id" = $1 OR "email" = $2`, [
    SMOKE_FIXTURE.userId,
    SMOKE_FIXTURE.email,
  ])
  await client.query(`DELETE FROM "tenants" WHERE "id" = $1`, [SMOKE_FIXTURE.tenantId])
}

function waitForApiResponse(page: Page, pathname: string, method = 'GET') {
  return page.waitForResponse(
    (response) => {
      const url = new URL(response.url())
      return url.pathname === pathname && response.request().method() === method
    },
    { timeout: 45_000 }
  )
}

async function expectOk(response: PlaywrightResponse, label: string) {
  if (response.ok()) return

  const body = await response.text().catch(() => '<unreadable response body>')
  expect(response.status(), `${label} failed: ${response.status()} ${body}`).toBeLessThan(400)
}

function unwrapAdvisoryData<T>(body: unknown): T | null {
  let current = body

  for (let depth = 0; depth < 3; depth += 1) {
    if (isRecord(current) && 'data' in current) {
      current = current.data
      continue
    }
    break
  }

  return current === null || current === undefined ? null : (current as T)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
