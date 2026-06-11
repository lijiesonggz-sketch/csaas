import { parseJsonWithRecovery } from './json-recovery.util'

describe('json-recovery.util', () => {
  describe('parseJsonWithRecovery', () => {
    it('should parse clean JSON', () => {
      const result = parseJsonWithRecovery<{ a: number }>('{"a": 1}')
      expect(result).toEqual({ a: 1 })
    })

    it('should parse JSON wrapped in markdown code block', () => {
      const text = '解读如下：\n```json\n{"key": "value", "n": 2}\n```\n以上。'
      expect(parseJsonWithRecovery(text)).toEqual({ key: 'value', n: 2 })
    })

    it('should extract JSON object from surrounding prose', () => {
      const text = '前置说明 {"items": [1, 2, 3]} 后置说明'
      expect(parseJsonWithRecovery(text)).toEqual({ items: [1, 2, 3] })
    })

    it('should fix trailing commas', () => {
      const text = '{"a": 1, "b": [1, 2,], }'
      expect(parseJsonWithRecovery(text)).toEqual({ a: 1, b: [1, 2] })
    })

    it('should recover truncated JSON by closing brackets', () => {
      const text = '{"results": [{"id": "1", "ok": true}, {"id": "2"'
      const parsed = parseJsonWithRecovery<any>(text)
      expect(parsed).not.toBeNull()
      expect(parsed.results[0]).toEqual({ id: '1', ok: true })
    })

    it('should return null for unparseable input', () => {
      expect(parseJsonWithRecovery('完全不是JSON的文本')).toBeNull()
      expect(parseJsonWithRecovery('')).toBeNull()
      expect(parseJsonWithRecovery(null as any)).toBeNull()
    })

    it('should validate with optional validator and reject mismatches', () => {
      const validator = (v: any) => Array.isArray(v?.items)
      expect(parseJsonWithRecovery('{"items": []}', validator)).toEqual({ items: [] })
      expect(parseJsonWithRecovery('{"other": 1}', validator)).toBeNull()
    })
  })
})
