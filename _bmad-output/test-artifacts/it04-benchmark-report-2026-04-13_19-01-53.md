# IT04 Benchmark Report

- Generated: 2026-04-13T19:01:53.294Z
- Dataset: D:\Csaas\backend\src\modules\case-import-orchestrator\testing\it04-benchmark-cases.fixture.json
- Taxonomy mapping: D:\Csaas\docs\it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv
- Classification source: semantic mapping CSV heuristic

## Summary

- Total cases: 30
- Taxonomy hits: 25
- Failure mode hits: 25
- Control hits: 25
- Evidence hits: 25
- Full-chain hits: 25
- Gate: PASS (minimum 10)

## Miss Categories

- Taxonomy: 5
- Failure mode: 0
- Control: 0
- Evidence: 0

## Full-Chain Hits

| Case ID | Title | L2 | Controls | Evidence |
| --- | --- | --- | --- | --- |
| IT04-BM-001 | EAST 报送口径审批缺失导致错报 | IT04-03 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-CONFIG-001 |
| IT04-BM-002 | 报送参数未经审批直接生效 | IT04-03 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-CONFIG-001 |
| IT04-BM-003 | 监管报送配置变更无留痕 | IT04-03 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-CONFIG-001 |
| IT04-BM-004 | EAST 字段映射关系错误 | IT04-04 | CTRL-DQ-001, CTRL-DQ-002, CTRL-REP-001, CTRL-REP-002 | EVD-REP-MAP-001 |
| IT04-BM-005 | 监管字段映射长期未维护 | IT04-04 | CTRL-DQ-001, CTRL-DQ-002, CTRL-REP-001, CTRL-REP-002 | EVD-REP-MAP-001 |
| IT04-BM-006 | 报送字段映射校验缺位 | IT04-04 | CTRL-DQ-001, CTRL-DQ-002, CTRL-REP-001, CTRL-REP-002 | EVD-REP-MAP-001 |
| IT04-BM-007 | 监管报表未双人复核直接报送 | IT04-05 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-REVIEW-001 |
| IT04-BM-008 | 报表生成后复核缺失 | IT04-05 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-REVIEW-001 |
| IT04-BM-009 | 监管系统报送前无人复核 | IT04-05 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 | EVD-REP-REVIEW-001 |
| IT04-BM-010 | 非现场监管报表迟报 | IT04-07 | CTRL-REP-004 | EVD-REP-TIMELY-001 |
| IT04-BM-011 | 监管台账报送无时效预警 | IT04-07 | CTRL-REP-004 | EVD-REP-TIMELY-001 |
| IT04-BM-013 | EAST 数据质量自动校验缺失 | IT04-04 | CTRL-DQ-001, CTRL-DQ-002, CTRL-REP-001, CTRL-REP-002 | EVD-DQ-RULE-001 |
| IT04-BM-014 | 关键字段缺少规则校验 | IT04-04 | CTRL-DQ-001, CTRL-DQ-002, CTRL-REP-001, CTRL-REP-002 | EVD-DQ-RULE-001 |
| IT04-BM-016 | 多系统数据口径不一致 | IT04-06 | CTRL-DQ-002, CTRL-DQ-003 | EVD-DQ-TRACE-001 |
| IT04-BM-018 | 报送层与源系统无法对齐 | IT04-06 | CTRL-DQ-002, CTRL-DQ-003 | EVD-DQ-TRACE-001 |
| IT04-BM-019 | 总账分账未自动勾稽 | IT04-06 | CTRL-DQ-002, CTRL-DQ-003 | EVD-DQ-RECON-001 |
| IT04-BM-020 | 监管报表与账簿差异未复核 | IT04-06 | CTRL-DQ-002, CTRL-DQ-003 | EVD-DQ-RECON-001 |
| IT04-BM-021 | 关键业务报表缺少勾稽控制 | IT04-06 | CTRL-DQ-002, CTRL-DQ-003 | EVD-DQ-RECON-001 |
| IT04-BM-022 | 投保信息录入更新迟缓 | IT04-10 | CTRL-TL-001 | EVD-TL-MONITOR-001 |
| IT04-BM-023 | 监管登记信息补录超期 | IT04-10 | CTRL-TL-001 | EVD-TL-MONITOR-001 |
| IT04-BM-024 | 业务信息维护不及时 | IT04-10 | CTRL-TL-001 | EVD-TL-MONITOR-001 |
| IT04-BM-025 | 历史报送差错整改未执行 | IT04-08 | CTRL-REC-001 | EVD-REC-CLOSE-001 |
| IT04-BM-027 | 历史监管问题屡查屡犯 | IT04-08 | CTRL-REC-001 | EVD-REC-CLOSE-001 |
| IT04-BM-028 | 向监管提供虚假报表 | IT04-11 | CTRL-FAL-001, CTRL-REP-003 | EVD-FAL-AUDIT-001 |
| IT04-BM-030 | 虚假监管资料未被拦截 | IT04-11 | CTRL-FAL-001, CTRL-REP-003 | EVD-FAL-AUDIT-001 |

## Gaps

| Case ID | Expected L2 | Actual L2 | Miss Category | Expected Controls | Actual Controls |
| --- | --- | --- | --- | --- | --- |
| IT04-BM-012 | IT04-07 | IT04-05 | taxonomy | CTRL-REP-004 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 |
| IT04-BM-015 | IT04-04 | IT04-03 | taxonomy | CTRL-DQ-001 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 |
| IT04-BM-017 | IT04-06 | IT04-05 | taxonomy | CTRL-DQ-002 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 |
| IT04-BM-026 | IT04-08 | IT04-05 | taxonomy | CTRL-REC-001 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 |
| IT04-BM-029 | IT04-11 | IT04-05 | taxonomy | CTRL-FAL-001 | CTRL-REP-001, CTRL-REP-002, CTRL-REP-003 |