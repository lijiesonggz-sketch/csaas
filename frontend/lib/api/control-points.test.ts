import {
  createControlEvidenceMap,
  createControlPackItem,
  createControlPoint,
  createQuestionItem,
  createRemediationAction,
  createClauseControlMap,
  deleteClauseControlMap,
  deleteControlEvidenceMap,
  deleteControlPackItem,
  getControlPoint,
  getControlPointEvidences,
  getControlPointPackLinks,
  getControlPointQuestions,
  getControlPointRegulatoryLinks,
  getControlPointRemediations,
  listControlPackCatalog,
  listControlPoints,
  searchEvidenceTypes,
  searchQuestionItems,
  updateControlPoint,
  updateControlPointStatus,
  updateQuestionItem,
  updateRemediationAction,
} from './control-points'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = jest.requireMock('../utils/api').apiFetch as jest.Mock

describe('Control Points API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds list query with core filters', async () => {
    mockApiFetch.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    await listControlPoints({
      page: 1,
      limit: 20,
      status: 'ACTIVE',
      keyword: '报送',
      l1Code: 'IT04',
      l2Code: 'IT04-01',
      controlFamily: '治理',
      failureModeId: 'fm-1',
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/control-points?page=1&limit=20&status=ACTIVE&keyword=%E6%8A%A5%E9%80%81&l1Code=IT04&l2Code=IT04-01&controlFamily=%E6%B2%BB%E7%90%86&failureModeId=fm-1',
      { cache: 'no-store' },
    )
  })

  it('reads detail and status updates from control-point endpoints', async () => {
    mockApiFetch.mockResolvedValue({})

    await getControlPoint('control-1')
    await updateControlPoint('control-1', { controlName: '更新后的控制点' })
    await updateControlPointStatus('control-1', { status: 'INACTIVE' })

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/control-points/control-1',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/control-points/control-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlName: '更新后的控制点' }),
      },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/knowledge-graph/control-points/control-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      },
    )
  })

  it('creates control points and child resources through the existing admin endpoints', async () => {
    mockApiFetch.mockResolvedValue({})

    await createControlPoint({
      controlCode: 'CTRL-IT04-999',
      controlName: '测试控制点',
      l1Code: 'IT04',
      l2Code: 'IT04-01',
      controlFamily: '治理',
      controlType: 'preventive',
      mandatoryDefault: true,
      riskLevelDefault: 'HIGH',
    })
    await createControlEvidenceMap({
      controlId: 'control-1',
      evidenceId: 'evidence-1',
      requiredLevel: 'REQUIRED',
      frequency: 'MONTHLY',
      ownerRole: '数据治理岗',
      samplingRequirement: 'FULL',
    })
    await createQuestionItem({
      controlId: 'control-1',
      questionCode: 'Q-CTRL-001',
      questionText: '是否执行复核？',
      questionType: 'SINGLE_CHOICE',
      answerSchema: { expectedAnswer: '是' },
    })
    await createRemediationAction({
      controlId: 'control-1',
      actionCode: 'RA-CTRL-001',
      actionTitle: '补齐复核流程',
    })
    await createControlPackItem({
      controlId: 'control-1',
      packId: 'pack-1',
      itemRole: 'INCLUDE',
      priority: 100,
    })
    await createClauseControlMap({
      controlId: 'control-1',
      clauseId: 'clause-1',
      mappingType: 'direct',
      reviewStatus: 'PENDING',
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/control-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlCode: 'CTRL-IT04-999',
        controlName: '测试控制点',
        l1Code: 'IT04',
        l2Code: 'IT04-01',
        controlFamily: '治理',
        controlType: 'preventive',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
      }),
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/control-evidence-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'control-1',
        evidenceId: 'evidence-1',
        requiredLevel: 'REQUIRED',
        frequency: 'MONTHLY',
        ownerRole: '数据治理岗',
        samplingRequirement: 'FULL',
      }),
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/question-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'control-1',
        questionCode: 'Q-CTRL-001',
        questionText: '是否执行复核？',
        questionType: 'SINGLE_CHOICE',
        answerSchema: { expectedAnswer: '是' },
      }),
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/remediation-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'control-1',
        actionCode: 'RA-CTRL-001',
        actionTitle: '补齐复核流程',
      }),
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/control-pack-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'control-1',
        packId: 'pack-1',
        itemRole: 'INCLUDE',
        priority: 100,
      }),
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/clause-control-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'control-1',
        clauseId: 'clause-1',
        mappingType: 'direct',
        reviewStatus: 'PENDING',
      }),
    })
  })

  it('loads management tab resources and deletes mapping resources', async () => {
    mockApiFetch.mockResolvedValue({})

    await getControlPointEvidences('control-1')
    await getControlPointQuestions('control-1')
    await getControlPointRemediations('control-1')
    await getControlPointPackLinks('control-1')
    await getControlPointRegulatoryLinks('control-1')
    await deleteControlEvidenceMap('map-1')
    await deleteControlPackItem('pack-item-1')
    await deleteClauseControlMap('clause-map-1')

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/control-points/control-1/evidences',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/control-points/control-1/questions',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/knowledge-graph/control-points/control-1/remediations',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      4,
      '/api/admin/knowledge-graph/control-points/control-1/pack-links',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      5,
      '/api/admin/knowledge-graph/control-points/control-1/regulatory-links',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      6,
      '/api/admin/knowledge-graph/control-evidence-maps/map-1',
      { method: 'DELETE' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      7,
      '/api/admin/knowledge-graph/control-pack-items/pack-item-1',
      { method: 'DELETE' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      8,
      '/api/admin/knowledge-graph/clause-control-maps/clause-map-1',
      { method: 'DELETE' },
    )
  })

  it('searches evidence and question catalogs and derives a unique pack catalog', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      })
      .mockResolvedValueOnce([
        {
          packId: 'pack-1',
          packCode: 'PACK-BASE-CYBER',
          packName: '基础网络安全包',
          packType: 'base',
          packVersion: 'stable',
        },
        {
          packId: 'pack-2',
          packCode: 'PACK-SECTOR-BANK',
          packName: '银行业增强包',
          packType: 'sector',
          packVersion: 'preview',
        },
      ])

    await searchEvidenceTypes({ keyword: '日志' })
    await searchQuestionItems({ controlId: 'control-1', keyword: '复核' })
    const catalog = await listControlPackCatalog()

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/evidence-types?page=1&limit=10&keyword=%E6%97%A5%E5%BF%97',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/question-items?page=1&limit=10&controlId=control-1&keyword=%E5%A4%8D%E6%A0%B8',
      { cache: 'no-store' },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/knowledge-graph/control-packs',
      { cache: 'no-store' },
    )
    expect(catalog).toEqual([
      {
        packId: 'pack-1',
        packCode: 'PACK-BASE-CYBER',
        packName: '基础网络安全包',
        packType: 'base',
        packVersion: 'stable',
      },
      {
        packId: 'pack-2',
        packCode: 'PACK-SECTOR-BANK',
        packName: '银行业增强包',
        packType: 'sector',
        packVersion: 'preview',
      },
    ])
  })

  it('updates question items and remediation actions through their existing endpoints', async () => {
    mockApiFetch.mockResolvedValue({})

    await updateQuestionItem('question-1', { questionText: '更新后的题目' })
    await updateRemediationAction('action-1', { actionTitle: '更新后的整改动作' })

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/question-items/question-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: '更新后的题目' }),
      },
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/remediation-actions/action-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTitle: '更新后的整改动作' }),
      },
    )
  })
})
