/**
 * ATDD Fixtures — Story 2-2: Seed Runner 扩展与旧数据退役
 *
 * 测试数据说明：
 * - 3 个非 retired 控制点 (idsToRetire) + 1 个已 retired 控制点 (alreadyRetiredId)
 * - 每个关联表有 3 条记录：2 条引用 idsToRetire，1 条引用 alreadyRetiredId
 * - 这模拟了"已退役控制点保留关联，未退役控制点关联被清理"的场景
 */

export const RETIRE_REASON = 'KG V2 重构全量替换'

// ---------------------------------------------------------------------------
// 控制点 fixture
// ---------------------------------------------------------------------------

export const idsToRetire = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
]

export const alreadyRetiredId = 'bbbbbbbb-0000-0000-0000-000000000001'

export const preExistingControlPoints = [
  {
    controlId: idsToRetire[0],
    controlCode: 'CTRL-OLD-001',
    maturityLevel: 'candidate',
    retiredReason: null,
  },
  {
    controlId: idsToRetire[1],
    controlCode: 'CTRL-OLD-002',
    maturityLevel: 'hard',
    retiredReason: null,
  },
  {
    controlId: idsToRetire[2],
    controlCode: 'CTRL-OLD-003',
    maturityLevel: 'draft-hard',
    retiredReason: null,
  },
  {
    controlId: alreadyRetiredId,
    controlCode: 'CTRL-RETIRED-001',
    maturityLevel: 'retired',
    retiredReason: 'Previous cleanup',
  },
]

// ---------------------------------------------------------------------------
// 关联表 fixture — 每个 3 条：2 条引用待退役控制点，1 条引用已退役控制点
// ---------------------------------------------------------------------------

export const preExistingControlPackItems = [
  { id: 'cpi-001', controlId: idsToRetire[0] },
  { id: 'cpi-002', controlId: idsToRetire[1] },
  { id: 'cpi-003', controlId: alreadyRetiredId },
]

export const preExistingClauseControlMaps = [
  { id: 'ccm-001', controlId: idsToRetire[0] },
  { id: 'ccm-002', controlId: idsToRetire[2] },
  { id: 'ccm-003', controlId: alreadyRetiredId },
]

export const preExistingCaseControlMaps = [
  { id: 'cacm-001', controlId: idsToRetire[1] },
  { id: 'cacm-002', controlId: idsToRetire[2] },
  { id: 'cacm-003', controlId: alreadyRetiredId },
]

export const preExistingQuestionItems = [
  { id: 'qi-001', controlId: idsToRetire[0] },
  { id: 'qi-002', controlId: idsToRetire[1] },
  { id: 'qi-003', controlId: alreadyRetiredId },
]

export const preExistingRemediationActions = [
  { id: 'ra-001', controlId: idsToRetire[0] },
  { id: 'ra-002', controlId: idsToRetire[2] },
  { id: 'ra-003', controlId: alreadyRetiredId },
]

// ---------------------------------------------------------------------------
// 期望的退役统计
// ---------------------------------------------------------------------------

export const expectedRetireSummary = {
  retiredCount: idsToRetire.length, // 3
  cleanedControlPackItems: 2,
  cleanedClauseControlMaps: 2,
  cleanedCaseControlMaps: 2,
  cleanedQuestionItems: 2,
  cleanedRemediationActions: 2,
}

// ---------------------------------------------------------------------------
// 种子控制点代码（6条种子数据）
// ---------------------------------------------------------------------------

export const seedControlPointCodes = [
  'CTRL-ACC-002',
  'CTRL-BCP-003',
  'CTRL-DG-004',
  'CTRL-DATA-011',
  'CTRL-AI-001',
  'CTRL-AI-002',
]

// ---------------------------------------------------------------------------
// 种子数据 maturity level 期望
// ---------------------------------------------------------------------------

export const expectedSeedMaturityAfterFullRun = 'candidate'
