-- ============================================================
-- 雷达推送演示数据 Seed 脚本
-- 可重复执行：使用 ON CONFLICT 或先清理再插入
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 更新技术雷达 raw_contents（7条唯一记录）
-- ============================================================

UPDATE raw_contents SET
  title = '云原生架构在银行核心系统中的落地实践与挑战',
  summary = '随着金融行业数字化转型加速，云原生技术已成为银行IT架构升级的核心方向。本文深入分析了容器化、微服务、服务网格等云原生技术在银行核心业务系统中的应用现状，探讨了从传统单体架构向云原生架构迁移过程中面临的技术挑战、安全合规要求以及最佳实践路径。Gartner预测到2025年，超过75%的大型金融机构将采用云原生技术重构核心系统。',
  "fullContent" = '云原生架构正在重塑银行业IT基础设施。Kubernetes已成为容器编排的事实标准，配合Istio服务网格、Prometheus监控体系，构建起完整的云原生技术栈。在银行核心系统改造中，需要重点关注数据一致性、事务管理、灰度发布等关键技术点。同时，监管对金融云的安全要求也在不断提升，需要在架构设计阶段就充分考虑等保三级、数据本地化等合规要求。',
  url = 'https://www.infoq.cn/article/cloud-native-banking-2025',
  source = 'InfoQ中国',
  "publishDate" = NOW() - INTERVAL '3 days',
  author = '张明远'
WHERE id = '50de3d38-8925-4445-97a7-7b29f0e190cb';

UPDATE raw_contents SET
  title = 'AI大模型在金融风控领域的应用：从GPT到行业垂直模型',
  summary = '大语言模型技术正在深刻改变金融风控的技术范式。本文系统梳理了GPT-4、文心一言、通义千问等大模型在信贷审批、反欺诈、反洗钱等金融风控场景中的应用案例，分析了通用大模型与金融垂直模型的优劣对比，并提出了金融机构构建自有AI风控能力的技术路线图。',
  "fullContent" = '金融风控是AI大模型最具价值的应用场景之一。通过微调和RAG技术，大模型可以有效提升风控模型的准确率和解释性。本文介绍了多家银行在信贷风控、交易监控、客户尽调等场景的实践经验，包括模型选型、数据治理、模型评估等关键环节。同时探讨了大模型在金融领域面临的幻觉问题、数据隐私保护、模型可解释性等挑战及应对策略。',
  url = 'https://www.infoq.cn/article/ai-llm-financial-risk-2025',
  source = 'InfoQ中国',
  "publishDate" = NOW() - INTERVAL '5 days',
  author = '李思远'
WHERE id = 'e2721caa-bd60-4a6b-917d-07a185629054';

UPDATE raw_contents SET
  title = '分布式数据库TiDB/OceanBase在城商行的选型与实施指南',
  summary = '面对日益增长的数据处理需求，城商行纷纷将目光投向分布式数据库。本文对比分析了TiDB、OceanBase、GaussDB等主流分布式数据库在金融场景下的性能表现、运维复杂度和成本效益，结合多家城商行的实际选型经验，提供了从POC测试到生产上线的完整实施指南。',
  "fullContent" = '分布式数据库是银行去IOE战略的关键一环。本文从OLTP性能、分布式事务、数据一致性、运维工具链等维度对主流产品进行了深度评测。重点介绍了某城商行从Oracle迁移到OceanBase的全过程，包括SQL兼容性改造、数据迁移方案、性能调优策略以及灾备架构设计。同时分析了分布式数据库在核心账务系统中的适用性和局限性。',
  url = 'https://www.gartner.com/cn/articles/distributed-database-banking',
  source = 'Gartner',
  "publishDate" = NOW() - INTERVAL '7 days',
  author = '王建华'
WHERE id = '840501d3-6a8f-4b15-bb24-21c94408ebd9';

UPDATE raw_contents SET
  title = 'DevOps与CI/CD在金融机构的成熟度评估与提升路径',
  summary = 'ThoughtWorks最新技术雷达将金融DevOps列为"采纳"象限。本文基于对50家金融机构的调研数据，构建了金融DevOps成熟度模型，从流水线自动化、测试覆盖率、发布频率、变更失败率等维度评估现状，并提出了从L1到L5的渐进式提升路径。',
  "fullContent" = '金融机构的DevOps实践面临独特挑战：严格的变更管理流程、复杂的合规审计要求、多环境部署的一致性保障等。本文介绍了GitOps、蓝绿部署、金丝雀发布等现代化发布策略在银行环境中的适配方案，以及如何在保证安全合规的前提下提升交付效率。调研显示，成熟的DevOps实践可将发布周期从月级缩短至周级，变更失败率降低60%以上。',
  url = 'https://www.thoughtworks.com/radar/techniques/fintech-devops',
  source = 'ThoughtWorks',
  "publishDate" = NOW() - INTERVAL '10 days',
  author = '陈晓峰'
WHERE id = '6b97fb2f-9dfd-456b-8ccc-0555af1be074';

UPDATE raw_contents SET
  title = '零信任安全架构在银行网络安全体系中的实施框架',
  summary = '随着远程办公常态化和API开放银行的发展，传统边界安全模型已无法满足银行安全需求。本文详细阐述了零信任安全架构（ZTA）在银行环境中的实施框架，涵盖身份认证、微隔离、持续验证、最小权限等核心原则的落地方案，以及与现有安全体系的融合策略。',
  "fullContent" = '零信任架构的核心理念是"永不信任，始终验证"。在银行环境中实施零信任需要从网络层、应用层、数据层三个维度进行改造。本文介绍了SDP（软件定义边界）、SASE（安全访问服务边缘）等技术在银行网络中的部署实践，以及如何利用UEBA（用户实体行为分析）实现持续风险评估。同时探讨了零信任与等保2.0、GDPR等合规框架的对齐方案。',
  url = 'https://www.gartner.com/cn/articles/zero-trust-banking-2025',
  source = 'Gartner',
  "publishDate" = NOW() - INTERVAL '4 days',
  author = '刘安全'
WHERE id = '0067d18f-2a55-4e7e-a400-5655219e9216';

UPDATE raw_contents SET
  title = '低代码平台在银行业务系统开发中的价值评估与风险分析',
  summary = '低代码/无代码平台正在改变银行应用开发模式。Forrester报告显示，金融机构采用低代码平台可将应用交付速度提升5-10倍。本文评估了OutSystems、Mendix、用友YonBuilder等平台在银行信贷管理、客户服务、内部办公等场景的适用性，同时分析了供应商锁定、安全审计、性能瓶颈等潜在风险。',
  "fullContent" = '低代码平台在银行业的应用正从边缘系统向核心业务延伸。本文通过三个典型案例分析了低代码平台的投入产出比：某城商行使用低代码平台3个月完成了信贷审批流程重构，开发成本降低70%；某股份制银行利用低代码平台快速搭建了疫情期间的线上服务系统。同时也指出了低代码平台在复杂业务逻辑、高并发场景、系统集成等方面的局限性。',
  url = 'https://www.forrester.com/report/low-code-banking-assessment',
  source = 'Forrester',
  "publishDate" = NOW() - INTERVAL '8 days',
  author = '赵开发'
WHERE id = 'fad4fd10-48c7-49d7-8f9b-3b4478c70750';

UPDATE raw_contents SET
  title = 'API网关与开放银行技术标准：构建安全高效的API生态',
  summary = '开放银行已成为全球金融科技发展的重要趋势。本文深入分析了API网关在开放银行架构中的核心作用，对比了Kong、Apigee、WSO2等主流API网关产品的功能特性，探讨了OAuth2.0/OIDC认证、API限流熔断、数据脱敏等关键技术的实现方案，以及如何满足PSD2、央行开放银行标准等监管要求。',
  "fullContent" = 'API网关是开放银行架构的核心组件，承担着流量管理、安全防护、协议转换、监控审计等关键职责。本文介绍了某银行API网关平台的建设经验，日均处理API调用超过5000万次，99.99%可用性。重点讨论了API版本管理、灰度发布、开发者门户、API计量计费等运营能力的建设，以及如何通过API治理确保数据安全和合规。',
  url = 'https://www.infoq.cn/article/api-gateway-open-banking-2025',
  source = 'InfoQ中国',
  "publishDate" = NOW() - INTERVAL '6 days',
  author = '孙接口'
WHERE id = 'e0869fae-11fa-49ed-aef2-c8174a8b6a09';

-- ============================================================
-- 2. 更新行业雷达 raw_contents（6条唯一记录）
-- ============================================================

UPDATE raw_contents SET
  title = '招商银行：全栈云原生转型实践，核心系统容器化率达85%',
  summary = '招商银行自2022年启动全栈云原生转型战略，历时两年完成核心交易系统、信贷系统、支付系统的容器化改造。通过自研的金融级Kubernetes平台"招银云舟"，实现了核心系统容器化率85%、资源利用率提升40%、发布效率提升300%的显著成效。本文详细介绍了招行云原生转型的技术路线、组织变革和关键经验。',
  "fullContent" = '招商银行的云原生转型是国内银行业最具代表性的实践案例。项目团队超过200人，覆盖基础设施、中间件、应用架构三个层面。关键技术选型包括：Kubernetes 1.28、Istio 1.19服务网格、自研的分布式事务框架、基于OPA的策略引擎。在迁移过程中，采用了"双轨并行"策略，新老系统同时运行6个月，确保零故障切换。',
  url = 'https://mp.weixin.qq.com/s/cmb-cloud-native-2025',
  source = '招商银行技术公众号',
  "publishDate" = NOW() - INTERVAL '12 days',
  "peerName" = '招商银行',
  author = '招行技术团队'
WHERE id = '2547fc57-e308-4448-bce0-85d0a129f769';

UPDATE raw_contents SET
  title = '杭州银行：基于OceanBase的分布式核心系统建设',
  summary = '杭州银行成功将核心账务系统从Oracle迁移至OceanBase分布式数据库，成为首批完成核心系统国产化替代的城商行。项目历时18个月，涉及2000+存储过程改造、500+接口适配，最终实现了交易性能提升30%、存储成本降低50%的目标。',
  "fullContent" = '杭州银行核心系统国产化替代项目是城商行去IOE的标杆案例。技术团队采用了分阶段迁移策略：第一阶段完成查询类业务迁移，第二阶段完成交易类业务迁移，第三阶段完成批量处理迁移。在数据迁移过程中，自研了增量同步工具，确保迁移期间业务零中断。OceanBase的多副本一致性和自动故障恢复能力，满足了银行核心系统的高可用要求。',
  url = 'https://www.infoq.cn/article/hangzhou-bank-oceanbase',
  source = 'InfoQ中国',
  "publishDate" = NOW() - INTERVAL '15 days',
  "peerName" = '杭州银行',
  author = '杭州银行科技部'
WHERE id = '72d8a247-cf8e-4ad7-b816-c9f6318bb736';

UPDATE raw_contents SET
  title = '工商银行：智能风控平台建设，AI模型日均处理10亿笔交易',
  summary = '工商银行构建了业内领先的智能风控平台，集成了深度学习、图计算、联邦学习等前沿AI技术。平台日均处理交易监控超10亿笔，欺诈识别准确率达99.7%，误报率降低至0.1%以下。本文分享了工行在AI风控领域的技术架构、模型训练和工程化实践经验。',
  "fullContent" = '工商银行智能风控平台采用了"端-边-云"三层架构：端侧部署轻量级模型实现毫秒级实时决策，边缘层进行特征计算和模型推理，云端负责模型训练和策略管理。核心技术包括：基于GNN的关系图谱分析、基于Transformer的时序异常检测、基于联邦学习的跨机构风险共享。平台支持模型的A/B测试和自动化迭代，模型更新周期从月级缩短至周级。',
  url = 'https://tech.icbc.com.cn/ai-risk-platform',
  source = '工商银行技术博客',
  "publishDate" = NOW() - INTERVAL '9 days',
  "peerName" = '工商银行',
  author = '工行金融科技部'
WHERE id = '55730f65-6721-43fa-99ba-191bc1eff078';

UPDATE raw_contents SET
  title = '平安银行：低代码平台赋能业务敏捷，年交付应用超200个',
  summary = '平安银行自研低代码平台"星云"，通过可视化开发、组件化复用、自动化测试等能力，将业务应用开发周期从平均3个月缩短至2周。2024年通过该平台交付应用超200个，覆盖零售、对公、运营等多个业务条线，开发人效提升5倍。',
  "fullContent" = '平安银行"星云"低代码平台的核心设计理念是"业务人员可用、技术人员高效"。平台提供了300+预置业务组件、50+页面模板、完整的权限管理和审计日志功能。在技术架构上，采用了微前端+微服务的架构，支持组件的独立开发、测试和部署。平台还集成了AI辅助开发能力，可根据业务需求描述自动生成页面原型和数据模型。',
  url = 'https://mp.weixin.qq.com/s/pingan-lowcode-2025',
  source = '平安银行技术公众号',
  "publishDate" = NOW() - INTERVAL '11 days',
  "peerName" = '平安银行',
  author = '平安银行科技团队'
WHERE id = '04529a62-768d-4459-9193-7a61fbd9827b';

UPDATE raw_contents SET
  title = '宁波银行：全链路压测体系建设，保障双十一峰值稳定',
  summary = '宁波银行建立了完整的全链路压测体系，覆盖核心交易、支付清算、信贷审批等关键业务链路。通过影子库、流量录制回放、混沌工程等技术手段，实现了生产环境级别的压力测试能力，成功保障了双十一期间10倍峰值流量的系统稳定运行。',
  "fullContent" = '宁波银行全链路压测体系的建设经历了三个阶段：第一阶段建立基础压测能力，第二阶段实现生产环境压测，第三阶段引入混沌工程。核心技术包括：基于字节码增强的流量染色、基于影子表的数据隔离、基于Chaos Mesh的故障注入。压测平台支持自动化场景编排、实时监控大屏、智能瓶颈分析等功能，每月执行全链路压测2次以上。',
  url = 'https://www.infoq.cn/article/ningbo-bank-stress-testing',
  source = 'InfoQ中国',
  "publishDate" = NOW() - INTERVAL '14 days',
  "peerName" = '宁波银行',
  author = '宁波银行技术部'
WHERE id = '5c83e6ab-b21a-4c3d-805e-78b8bf9d8e38';

UPDATE raw_contents SET
  title = '南京银行：数据中台建设实践，打通全行数据孤岛',
  summary = '南京银行历时两年完成数据中台建设，整合了全行120+业务系统的数据资产，建立了统一的数据标准、数据质量管理和数据服务体系。数据中台日均处理数据量超50TB，支撑了精准营销、风险管理、监管报送等核心数据应用场景。',
  "fullContent" = '南京银行数据中台采用了"湖仓一体"架构，底层基于Apache Iceberg构建数据湖，上层通过Trino实现统一查询。数据治理方面，建立了覆盖全行的数据标准体系，包括2000+数据标准、500+数据质量规则。数据服务层提供了SQL查询、API服务、数据订阅等多种数据消费方式。项目实施过程中，最大的挑战是跨部门的数据标准统一和数据权限管理。',
  url = 'https://mp.weixin.qq.com/s/nanjing-bank-data-platform',
  source = '南京银行公众号',
  "publishDate" = NOW() - INTERVAL '18 days',
  "peerName" = '南京银行',
  author = '南京银行数据团队'
WHERE id = '6b35bf5d-5897-4230-b6b6-c0e53e42b68e';

-- ============================================================
-- 3. 更新合规雷达 raw_contents（3条唯一记录）
-- ============================================================

UPDATE raw_contents SET
  title = '央行发布《金融数据安全分级指南》，明确数据分类分级管理要求',
  summary = '中国人民银行正式发布《金融数据安全分级指南》（JR/T 0197-2025），要求金融机构在2025年底前完成全量数据资产的分类分级工作。指南将金融数据分为5个安全级别，明确了各级别数据的存储、传输、访问控制和销毁要求。未按期完成的机构将面临监管处罚。',
  "fullContent" = '《金融数据安全分级指南》是央行数据安全监管体系的核心文件。指南要求金融机构建立数据分类分级管理制度，配备专职数据安全管理人员，定期开展数据安全风险评估。对于C4级（高敏感）和C5级（极高敏感）数据，要求采用国密算法加密存储和传输，访问需经过多因素认证和审批流程。指南还明确了数据跨境传输的安全评估要求。',
  url = 'https://www.pbc.gov.cn/goutongjiaoliu/data-security-guide-2025',
  source = '中国人民银行',
  "publishDate" = NOW() - INTERVAL '2 days',
  "complianceData" = '{"type":"policy_draft","policyTitle":"金融数据安全分级指南","policyBasis":"JR/T 0197-2025","mainRequirements":"金融机构须在2025年底前完成全量数据资产分类分级，C4/C5级数据须国密加密","expectedImplementationDate":"2025-12-31"}'::jsonb,
  author = '中国人民银行'
WHERE id = '925de8e5-23fe-4b6c-af93-5111fc36e702';

UPDATE raw_contents SET
  title = '银保监会通报：某城商行因数据安全管理不到位被罚款680万元',
  summary = '银保监会近日通报，某城商行因存在客户信息泄露、数据备份不完整、未经授权的数据访问等多项数据安全违规行为，被处以680万元罚款，相关责任人被给予警告和罚款处分。此案是2025年以来金融数据安全领域最大罚单，对行业具有重要警示意义。',
  "fullContent" = '银保监会检查发现该行存在以下违规行为：1）客户敏感信息未加密存储，涉及超过50万客户记录；2）数据库访问权限管理混乱，存在共享账号和越权访问；3）数据备份策略不完善，RPO超过监管要求；4）未建立数据安全事件应急响应机制；5）第三方数据共享未进行安全评估。银保监会要求该行在6个月内完成整改，并提交整改报告。',
  url = 'https://www.cbirc.gov.cn/penalty/data-security-2025-001',
  source = '银保监会',
  "publishDate" = NOW() - INTERVAL '5 days',
  "complianceData" = '{"type":"penalty","penaltyInstitution":"某城商行","penaltyReason":"数据安全管理不到位，客户信息泄露","penaltyAmount":"680万元","penaltyDate":"2025-01-15","policyBasis":"《银行业金融机构数据治理指引》《个人信息保护法》"}'::jsonb,
  author = '银保监会'
WHERE id = '7a57cf1a-6d9a-4f3f-a223-15a5bbd8f86f';

UPDATE raw_contents SET
  title = '网信办《个人信息出境安全评估办法》修订版征求意见，金融机构影响分析',
  summary = '国家互联网信息办公室发布《个人信息出境安全评估办法》修订版征求意见稿，新增了金融行业个人信息出境的特别规定。修订版要求处理100万人以上个人信息的金融机构，在数据出境前须通过国家安全评估，并建立数据出境风险自评估机制。征求意见截止日期为2025年3月31日。',
  "fullContent" = '修订版主要变化包括：1）新增金融行业专章，明确金融数据出境的特殊要求；2）将安全评估触发门槛从累计向境外提供10万人信息调整为金融机构处理100万人以上信息即需评估；3）要求金融机构建立数据出境台账，记录出境数据类型、规模、目的地等信息；4）增加了对数据接收方的安全能力评估要求；5）明确了违规处罚标准，最高可处5000万元罚款。',
  url = 'https://www.cac.gov.cn/2025-01/cross-border-data-finance',
  source = '国家互联网信息办公室',
  "publishDate" = NOW() - INTERVAL '1 day',
  "complianceData" = '{"type":"policy_draft","policyTitle":"个人信息出境安全评估办法（修订版）","commentDeadline":"2025-03-31","mainRequirements":"处理100万人以上个人信息的金融机构须通过国家安全评估","expectedImplementationDate":"2025-06-01"}'::jsonb,
  author = '国家互联网信息办公室'
WHERE id = '1db2cc80-4b52-4c38-930e-ff5774dc2276';

-- ============================================================
-- 4. 更新技术雷达 analyzed_contents（7条）
-- ============================================================

UPDATE analyzed_contents SET
  "aiSummary" = '云原生技术已成为银行IT架构升级的核心方向，Kubernetes+Istio技术栈在核心系统中的应用日趋成熟。建议重点关注容器安全、服务网格性能优化和多集群管理等技术演进方向。',
  categories = '["云原生","容器化","微服务","Kubernetes"]'::jsonb,
  "targetAudience" = '技术架构师、基础设施负责人',
  "roiAnalysis" = '{"estimatedCost":"500-800万（含平台建设和人员培训）","expectedBenefit":"资源利用率提升40%，运维效率提升60%，年节省IT成本约300万","roiEstimate":"18个月回收投资","implementationPeriod":"12-18个月","recommendedVendors":["阿里云ACK","华为云CCE","红帽OpenShift"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2500,
  status = 'success',
  "relevanceScore" = 0.92
WHERE id = '753c2017-2a6d-45a4-adb9-44ece766d40a';

UPDATE analyzed_contents SET
  "aiSummary" = 'AI大模型在金融风控领域展现出巨大潜力，通过RAG和微调技术可显著提升风控模型效果。建议关注金融垂直模型的发展，同时注意模型可解释性和数据隐私保护。',
  categories = '["AI大模型","金融风控","深度学习","NLP"]'::jsonb,
  "targetAudience" = '风控技术负责人、AI团队负责人',
  "roiAnalysis" = '{"estimatedCost":"300-500万（含模型训练和算力投入）","expectedBenefit":"欺诈损失降低50%，审批效率提升200%，年减少风险损失约2000万","roiEstimate":"6个月回收投资","implementationPeriod":"6-12个月","recommendedVendors":["阿里通义千问","百度文心一言","智谱ChatGLM"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2300,
  status = 'success',
  "relevanceScore" = 0.88
WHERE id = 'f8e9494f-a53a-47da-95e0-4b8d76591978';

UPDATE analyzed_contents SET
  "aiSummary" = '分布式数据库是银行去IOE战略的关键技术，OceanBase和TiDB在金融场景中已有成熟案例。城商行应根据自身业务规模和技术能力选择合适的产品和迁移策略。',
  categories = '["分布式数据库","国产化替代","数据架构"]'::jsonb,
  "targetAudience" = '数据库管理员、技术架构师',
  "roiAnalysis" = '{"estimatedCost":"200-400万（含软件授权和迁移改造）","expectedBenefit":"数据库许可费降低70%，性能提升30%，年节省运维成本约150万","roiEstimate":"24个月回收投资","implementationPeriod":"12-18个月","recommendedVendors":["OceanBase","TiDB","华为GaussDB"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2100,
  status = 'success',
  "relevanceScore" = 0.85
WHERE id = '23be312f-3c9e-4974-a646-d6dc2791ea23';

UPDATE analyzed_contents SET
  "aiSummary" = 'DevOps成熟度直接影响银行的交付效率和系统稳定性。金融机构应建立适合自身的DevOps成熟度评估体系，分阶段推进自动化流水线、测试左移和持续交付能力建设。',
  categories = '["DevOps","CI/CD","自动化测试","敏捷开发"]'::jsonb,
  "targetAudience" = '研发效能负责人、项目管理者',
  "roiAnalysis" = '{"estimatedCost":"100-200万（含工具链和培训）","expectedBenefit":"发布周期缩短80%，变更失败率降低60%，年节省人力成本约200万","roiEstimate":"12个月回收投资","implementationPeriod":"6-12个月","recommendedVendors":["GitLab","Jenkins","阿里云效"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2200,
  status = 'success',
  "relevanceScore" = 0.90
WHERE id = '254637ea-2db8-48b5-a559-8b663a79c789';

UPDATE analyzed_contents SET
  "aiSummary" = '零信任安全架构是应对新型网络威胁的有效方案，银行应从身份认证、网络微隔离、持续验证三个维度推进零信任建设，同时确保与等保2.0等合规框架对齐。',
  categories = '["零信任","网络安全","身份认证","安全架构"]'::jsonb,
  "targetAudience" = '信息安全负责人、网络架构师',
  "roiAnalysis" = '{"estimatedCost":"300-600万（含安全产品和改造）","expectedBenefit":"安全事件减少80%，合规审计通过率提升至100%，避免潜在罚款损失","roiEstimate":"12个月回收投资","implementationPeriod":"12-24个月","recommendedVendors":["奇安信","深信服","Zscaler"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2400,
  status = 'success',
  "relevanceScore" = 0.93
WHERE id = '4fcba4ba-8627-4aa1-9db6-6a1a8daac4fb';

UPDATE analyzed_contents SET
  "aiSummary" = '低代码平台可显著提升银行应用交付效率，适合快速构建中后台管理系统和流程类应用。但需注意供应商锁定风险和复杂业务场景的局限性，建议采用混合开发模式。',
  categories = '["低代码","快速开发","数字化转型"]'::jsonb,
  "targetAudience" = '业务技术负责人、应用开发经理',
  "roiAnalysis" = '{"estimatedCost":"150-300万（含平台授权和定制开发）","expectedBenefit":"开发效率提升5倍，交付周期缩短70%，年节省外包成本约400万","roiEstimate":"8个月回收投资","implementationPeriod":"3-6个月","recommendedVendors":["OutSystems","Mendix","用友YonBuilder"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2000,
  status = 'success',
  "relevanceScore" = 0.82
WHERE id = '467c1025-fbb8-4568-938b-4fa9735985e5';

UPDATE analyzed_contents SET
  "aiSummary" = 'API网关是开放银行架构的核心基础设施，需要在安全性、性能和可管理性之间取得平衡。建议选择支持国密算法和金融行业标准的API网关产品，同步建设API治理体系。',
  categories = '["API网关","开放银行","微服务","安全"]'::jsonb,
  "targetAudience" = '架构师、API平台负责人',
  "roiAnalysis" = '{"estimatedCost":"200-400万（含网关平台和开发者门户）","expectedBenefit":"API复用率提升60%，第三方接入效率提升300%，开放银行收入增长","roiEstimate":"12个月回收投资","implementationPeriod":"6-12个月","recommendedVendors":["Kong","阿里云API网关","华为APIG"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2150,
  status = 'success',
  "relevanceScore" = 0.87
WHERE id = '78ee1fd3-d4ae-4bb8-a420-39b7416b3ca1';

-- ============================================================
-- 5. 更新行业雷达 analyzed_contents（6条）
-- ============================================================

UPDATE analyzed_contents SET
  "aiSummary" = '招商银行云原生转型是国内银行业最具代表性的实践，容器化率达85%，资源利用率提升40%。其"双轨并行"迁移策略和自研金融级K8s平台值得城商行借鉴。',
  categories = '["云原生","容器化","架构转型"]'::jsonb,
  "targetAudience" = '技术架构师、CTO',
  "practiceDescription" = '招商银行自2022年启动全栈云原生转型，通过自研"招银云舟"Kubernetes平台，完成核心交易、信贷、支付系统的容器化改造。采用Kubernetes 1.28 + Istio 1.19技术栈，200+人团队历时两年实施。',
  "estimatedCost" = '3000-5000万',
  "implementationPeriod" = '24个月',
  "technicalEffect" = '核心系统容器化率85%，资源利用率提升40%，发布效率提升300%，故障恢复时间从小时级缩短至分钟级',
  "peerName" = '招商银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2600,
  status = 'success',
  "relevanceScore" = 0.95
WHERE id = 'b0602841-0fc5-4c60-aeaf-b17b2f59f524';

UPDATE analyzed_contents SET
  "aiSummary" = '杭州银行成功完成核心系统从Oracle到OceanBase的迁移，是城商行去IOE的标杆案例。分阶段迁移策略和自研增量同步工具是项目成功的关键。',
  categories = '["分布式数据库","国产化替代","核心系统"]'::jsonb,
  "targetAudience" = '数据库管理员、技术架构师',
  "practiceDescription" = '杭州银行将核心账务系统从Oracle迁移至OceanBase，涉及2000+存储过程改造、500+接口适配。采用分阶段迁移策略：查询类→交易类→批量处理，自研增量同步工具确保迁移期间业务零中断。',
  "estimatedCost" = '800-1200万',
  "implementationPeriod" = '18个月',
  "technicalEffect" = '交易性能提升30%，存储成本降低50%，数据库许可费年节省约500万，系统可用性达99.99%',
  "peerName" = '杭州银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2400,
  status = 'success',
  "relevanceScore" = 0.91
WHERE id = '8a41460c-4885-4c33-a00f-e7b9c793d4b7';

UPDATE analyzed_contents SET
  "aiSummary" = '工商银行智能风控平台代表了国内银行AI风控的最高水平，日均处理10亿笔交易，欺诈识别准确率99.7%。其"端-边-云"三层架构和联邦学习应用值得关注。',
  categories = '["AI风控","深度学习","图计算"]'::jsonb,
  "targetAudience" = '风控技术负责人、AI团队负责人',
  "practiceDescription" = '工商银行构建"端-边-云"三层智能风控架构：端侧毫秒级实时决策，边缘层特征计算和模型推理，云端模型训练和策略管理。集成GNN关系图谱、Transformer时序异常检测、联邦学习跨机构风险共享等技术。',
  "estimatedCost" = '5000万以上',
  "implementationPeriod" = '36个月',
  "technicalEffect" = '日均处理交易监控超10亿笔，欺诈识别准确率99.7%，误报率降至0.1%以下，模型更新周期从月级缩短至周级',
  "peerName" = '工商银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2700,
  status = 'success',
  "relevanceScore" = 0.89
WHERE id = 'fc48e10b-cd04-430e-8933-f039a71ab981';

UPDATE analyzed_contents SET
  "aiSummary" = '平安银行自研低代码平台"星云"年交付应用超200个，开发人效提升5倍。其"业务人员可用、技术人员高效"的设计理念和AI辅助开发能力值得借鉴。',
  categories = '["低代码","敏捷开发","数字化转型"]'::jsonb,
  "targetAudience" = '业务技术负责人、应用开发经理',
  "practiceDescription" = '平安银行自研"星云"低代码平台，提供300+预置业务组件、50+页面模板，采用微前端+微服务架构。集成AI辅助开发能力，可根据需求描述自动生成页面原型和数据模型。覆盖零售、对公、运营等多个业务条线。',
  "estimatedCost" = '1500-2000万',
  "implementationPeriod" = '18个月',
  "technicalEffect" = '年交付应用超200个，开发周期从3个月缩短至2周，开发人效提升5倍，业务需求响应速度提升80%',
  "peerName" = '平安银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2300,
  status = 'success',
  "relevanceScore" = 0.86
WHERE id = '471d2d1d-53f5-4e0b-a389-496500651cbd';

UPDATE analyzed_contents SET
  "aiSummary" = '宁波银行全链路压测体系建设经验丰富，通过影子库、流量录制回放、混沌工程等技术实现了生产级压测能力。其分阶段建设路径适合中小银行参考。',
  categories = '["性能测试","混沌工程","系统稳定性"]'::jsonb,
  "targetAudience" = '测试负责人、运维架构师',
  "practiceDescription" = '宁波银行建立三阶段全链路压测体系：基础压测→生产环境压测→混沌工程。核心技术包括字节码增强流量染色、影子表数据隔离、Chaos Mesh故障注入。支持自动化场景编排、实时监控大屏、智能瓶颈分析。',
  "estimatedCost" = '500-800万',
  "implementationPeriod" = '12个月',
  "technicalEffect" = '成功保障双十一10倍峰值流量稳定运行，系统可用性达99.99%，故障发现时间缩短90%，每月执行全链路压测2次以上',
  "peerName" = '宁波银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2200,
  status = 'success',
  "relevanceScore" = 0.84
WHERE id = '788ee6bf-e194-4e79-9c5f-98dbd2d8a50d';

UPDATE analyzed_contents SET
  "aiSummary" = '南京银行数据中台建设采用"湖仓一体"架构，整合120+业务系统数据，日均处理50TB。其数据标准体系和跨部门协调经验对城商行数据治理具有重要参考价值。',
  categories = '["数据中台","数据治理","数据湖"]'::jsonb,
  "targetAudience" = '数据架构师、数据治理负责人',
  "practiceDescription" = '南京银行采用Apache Iceberg构建数据湖，Trino实现统一查询的"湖仓一体"架构。建立2000+数据标准、500+数据质量规则，提供SQL查询、API服务、数据订阅等多种消费方式。整合全行120+业务系统数据资产。',
  "estimatedCost" = '2000-3000万',
  "implementationPeriod" = '24个月',
  "technicalEffect" = '日均处理数据量超50TB，数据查询效率提升10倍，报表生成时间从天级缩短至小时级，支撑精准营销转化率提升35%',
  "peerName" = '南京银行',
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2500,
  status = 'success',
  "relevanceScore" = 0.88
WHERE id = '0c60b869-1c7d-4599-ad1b-f54d18cf7ca2';

-- ============================================================
-- 6. 更新合规雷达 analyzed_contents（3条）
-- ============================================================

UPDATE analyzed_contents SET
  "aiSummary" = '央行《金融数据安全分级指南》要求2025年底前完成全量数据分类分级，C4/C5级数据须国密加密。建议立即启动数据资产盘点和分级工作，优先处理客户敏感数据。',
  categories = '["数据安全","数据分级","合规管理"]'::jsonb,
  "targetAudience" = '数据安全负责人、合规部门',
  "complianceAnalysis" = '{"complianceRiskCategory":"数据安全管理","penaltyCase":"未按期完成分类分级的机构将面临监管处罚，参考某城商行680万罚款案例","policyRequirements":"2025年底前完成全量数据资产分类分级，C4/C5级数据采用国密算法加密，配备专职数据安全管理人员","remediationSuggestions":"1.启动数据资产盘点 2.建立分类分级标准 3.部署数据加密方案 4.培训数据安全人员","relatedWeaknessCategories":["数据加密","访问控制","数据治理"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2800,
  status = 'success',
  "relevanceScore" = 0.96
WHERE id = 'c0199936-6230-4100-b648-4f15a3a8fe53';

UPDATE analyzed_contents SET
  "aiSummary" = '某城商行因数据安全管理不到位被罚680万元，暴露了客户信息加密、权限管理、数据备份等多个薄弱环节。建议对照处罚事项开展自查，重点检查敏感数据加密和访问权限管理。',
  categories = '["数据安全","监管处罚","信息保护"]'::jsonb,
  "targetAudience" = '合规负责人、信息安全负责人',
  "complianceAnalysis" = '{"complianceRiskCategory":"数据安全违规","penaltyCase":"某城商行因客户信息泄露、数据备份不完整、未授权访问等被罚680万元，相关责任人被警告和罚款","policyRequirements":"客户敏感信息须加密存储，数据库访问权限须严格管控，数据备份RPO须满足监管要求，须建立数据安全事件应急响应机制","remediationSuggestions":"1.全面排查敏感数据加密情况 2.清理共享账号和越权访问 3.完善数据备份策略 4.建立应急响应机制 5.评估第三方数据共享安全","relatedWeaknessCategories":["数据加密","权限管理","备份恢复","应急响应"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2600,
  status = 'success',
  "relevanceScore" = 0.94
WHERE id = 'c3b12522-7768-4dff-9f97-8b43d86d88c8';

UPDATE analyzed_contents SET
  "aiSummary" = '网信办修订《个人信息出境安全评估办法》新增金融行业专章，处理100万人以上信息的金融机构须通过国家安全评估。建议梳理数据出境场景，建立数据出境台账，提前准备安全评估材料。',
  categories = '["数据出境","个人信息保护","跨境合规"]'::jsonb,
  "targetAudience" = '合规负责人、法务部门',
  "complianceAnalysis" = '{"complianceRiskCategory":"数据跨境传输","penaltyCase":"违规最高可处5000万元罚款","policyRequirements":"处理100万人以上个人信息的金融机构须通过国家安全评估，建立数据出境台账，评估数据接收方安全能力","remediationSuggestions":"1.梳理所有数据出境场景 2.建立数据出境台账 3.评估数据接收方安全能力 4.准备安全评估申报材料 5.在征求意见期内提交反馈","relatedWeaknessCategories":["数据出境","隐私保护","第三方管理"]}'::jsonb,
  "aiModel" = 'qwen-max',
  "tokensUsed" = 2500,
  status = 'success',
  "relevanceScore" = 0.91
WHERE id = '07a138d6-d199-47a8-8288-a2a997768bab';

COMMIT;

-- ============================================================
-- 7. 插入 Tags（独立事务）
-- ============================================================

BEGIN;

-- 先删除可能存在的同名标签（避免冲突）
DELETE FROM tags WHERE name IN (
  '云原生', 'Kubernetes', 'AI大模型', '分布式数据库', 'DevOps', '零信任', '低代码', 'API网关', '金融风控', '数据安全', '微服务', '国产化替代',
  '招商银行', '杭州银行', '工商银行', '平安银行', '宁波银行', '南京银行',
  '数据分级', '个人信息保护', '数据出境', '监管处罚'
);

-- 技术标签
INSERT INTO tags (id, name, "tagType", category, description, "usageCount", "isActive", "isVerified", "isOfficial", "createdAt", "updatedAt")
VALUES
  ('a0000001-0000-0000-0000-000000000001', '云原生', 'tech', 'cloud-native', '云原生技术栈，包括容器化、微服务、服务网格等', 5, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000002', 'Kubernetes', 'tech', 'cloud-native', '容器编排平台', 3, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000003', 'AI大模型', 'tech', 'ai', '大语言模型及AI应用', 4, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000004', '分布式数据库', 'tech', 'database', '分布式数据库技术', 3, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000005', 'DevOps', 'tech', 'devops', 'DevOps与CI/CD实践', 2, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000006', '零信任', 'tech', 'security', '零信任安全架构', 2, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000007', '低代码', 'tech', 'low-code', '低代码/无代码开发平台', 2, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000008', 'API网关', 'tech', 'api', 'API网关与开放银行', 2, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000009', '金融风控', 'tech', 'risk', '金融风险控制技术', 3, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000010', '数据安全', 'compliance', 'data-security', '数据安全与隐私保护', 4, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000011', '微服务', 'tech', 'cloud-native', '微服务架构', 2, true, true, true, NOW(), NOW()),
  ('a0000001-0000-0000-0000-000000000012', '国产化替代', 'tech', 'localization', '信创与国产化替代', 2, true, true, true, NOW(), NOW());

-- 同业标签
INSERT INTO tags (id, name, "tagType", category, description, metadata, "usageCount", "isActive", "isVerified", "isOfficial", "createdAt", "updatedAt")
VALUES
  ('b0000001-0000-0000-0000-000000000001', '招商银行', 'peer', 'national-bank', '招商银行技术实践', '{"institutionType":"national-bank","region":"深圳"}'::jsonb, 2, true, true, true, NOW(), NOW()),
  ('b0000001-0000-0000-0000-000000000002', '杭州银行', 'peer', 'city-bank', '杭州银行技术实践', '{"institutionType":"city-bank","region":"杭州"}'::jsonb, 1, true, true, true, NOW(), NOW()),
  ('b0000001-0000-0000-0000-000000000003', '工商银行', 'peer', 'national-bank', '工商银行技术实践', '{"institutionType":"national-bank","region":"北京"}'::jsonb, 1, true, true, true, NOW(), NOW()),
  ('b0000001-0000-0000-0000-000000000004', '平安银行', 'peer', 'national-bank', '平安银行技术实践', '{"institutionType":"national-bank","region":"深圳"}'::jsonb, 1, true, true, true, NOW(), NOW()),
  ('b0000001-0000-0000-0000-000000000005', '宁波银行', 'peer', 'city-bank', '宁波银行技术实践', '{"institutionType":"city-bank","region":"宁波"}'::jsonb, 1, true, true, true, NOW(), NOW()),
  ('b0000001-0000-0000-0000-000000000006', '南京银行', 'peer', 'city-bank', '南京银行技术实践', '{"institutionType":"city-bank","region":"南京"}'::jsonb, 1, true, true, true, NOW(), NOW());

-- 合规标签
INSERT INTO tags (id, name, "tagType", category, description, "usageCount", "isActive", "isVerified", "isOfficial", "createdAt", "updatedAt")
VALUES
  ('c0000001-0000-0000-0000-000000000001', '数据分级', 'compliance', 'data-governance', '数据分类分级管理', 2, true, true, true, NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000002', '个人信息保护', 'compliance', 'privacy', '个人信息保护与隐私合规', 2, true, true, true, NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000003', '数据出境', 'compliance', 'cross-border', '数据跨境传输合规', 1, true, true, true, NOW(), NOW()),
  ('c0000001-0000-0000-0000-000000000004', '监管处罚', 'compliance', 'penalty', '监管处罚案例', 1, true, true, true, NOW(), NOW());

COMMIT;

-- ============================================================
-- 8. 插入 content_tags 关联（独立事务）
-- ============================================================

BEGIN;

-- 先清理旧的 content_tags 关联
DELETE FROM content_tags;

-- 技术雷达 content_tags
INSERT INTO content_tags ("contentId", "tagId") VALUES
  ('753c2017-2a6d-45a4-adb9-44ece766d40a', 'a0000001-0000-0000-0000-000000000001'),
  ('753c2017-2a6d-45a4-adb9-44ece766d40a', 'a0000001-0000-0000-0000-000000000002'),
  ('753c2017-2a6d-45a4-adb9-44ece766d40a', 'a0000001-0000-0000-0000-000000000011'),
  ('f8e9494f-a53a-47da-95e0-4b8d76591978', 'a0000001-0000-0000-0000-000000000003'),
  ('f8e9494f-a53a-47da-95e0-4b8d76591978', 'a0000001-0000-0000-0000-000000000009'),
  ('23be312f-3c9e-4974-a646-d6dc2791ea23', 'a0000001-0000-0000-0000-000000000004'),
  ('23be312f-3c9e-4974-a646-d6dc2791ea23', 'a0000001-0000-0000-0000-000000000012'),
  ('254637ea-2db8-48b5-a559-8b663a79c789', 'a0000001-0000-0000-0000-000000000005'),
  ('4fcba4ba-8627-4aa1-9db6-6a1a8daac4fb', 'a0000001-0000-0000-0000-000000000006'),
  ('4fcba4ba-8627-4aa1-9db6-6a1a8daac4fb', 'a0000001-0000-0000-0000-000000000010'),
  ('467c1025-fbb8-4568-938b-4fa9735985e5', 'a0000001-0000-0000-0000-000000000007'),
  ('78ee1fd3-d4ae-4bb8-a420-39b7416b3ca1', 'a0000001-0000-0000-0000-000000000008');

-- 行业雷达 content_tags
INSERT INTO content_tags ("contentId", "tagId") VALUES
  ('b0602841-0fc5-4c60-aeaf-b17b2f59f524', 'b0000001-0000-0000-0000-000000000001'),
  ('b0602841-0fc5-4c60-aeaf-b17b2f59f524', 'a0000001-0000-0000-0000-000000000001'),
  ('8a41460c-4885-4c33-a00f-e7b9c793d4b7', 'b0000001-0000-0000-0000-000000000002'),
  ('8a41460c-4885-4c33-a00f-e7b9c793d4b7', 'a0000001-0000-0000-0000-000000000004'),
  ('fc48e10b-cd04-430e-8933-f039a71ab981', 'b0000001-0000-0000-0000-000000000003'),
  ('fc48e10b-cd04-430e-8933-f039a71ab981', 'a0000001-0000-0000-0000-000000000009'),
  ('471d2d1d-53f5-4e0b-a389-496500651cbd', 'b0000001-0000-0000-0000-000000000004'),
  ('471d2d1d-53f5-4e0b-a389-496500651cbd', 'a0000001-0000-0000-0000-000000000007'),
  ('788ee6bf-e194-4e79-9c5f-98dbd2d8a50d', 'b0000001-0000-0000-0000-000000000005'),
  ('0c60b869-1c7d-4599-ad1b-f54d18cf7ca2', 'b0000001-0000-0000-0000-000000000006');

-- 合规雷达 content_tags
INSERT INTO content_tags ("contentId", "tagId") VALUES
  ('c0199936-6230-4100-b648-4f15a3a8fe53', 'a0000001-0000-0000-0000-000000000010'),
  ('c0199936-6230-4100-b648-4f15a3a8fe53', 'c0000001-0000-0000-0000-000000000001'),
  ('c3b12522-7768-4dff-9f97-8b43d86d88c8', 'a0000001-0000-0000-0000-000000000010'),
  ('c3b12522-7768-4dff-9f97-8b43d86d88c8', 'c0000001-0000-0000-0000-000000000004'),
  ('07a138d6-d199-47a8-8288-a2a997768bab', 'c0000001-0000-0000-0000-000000000002'),
  ('07a138d6-d199-47a8-8288-a2a997768bab', 'c0000001-0000-0000-0000-000000000003');

COMMIT;

-- ============================================================
-- 9. 更新 radar_pushes 和插入 compliance_playbooks（独立事务）
-- ============================================================

BEGIN;

-- 更新行业雷达 peerName
UPDATE radar_pushes SET "peerName" = '招商银行', matched_peers = '["招商银行"]'::jsonb
WHERE "contentId" = 'b0602841-0fc5-4c60-aeaf-b17b2f59f524';

UPDATE radar_pushes SET "peerName" = '杭州银行', matched_peers = '["杭州银行"]'::jsonb
WHERE "contentId" = '8a41460c-4885-4c33-a00f-e7b9c793d4b7';

UPDATE radar_pushes SET "peerName" = '工商银行', matched_peers = '["工商银行"]'::jsonb
WHERE "contentId" = 'fc48e10b-cd04-430e-8933-f039a71ab981';

UPDATE radar_pushes SET "peerName" = '平安银行', matched_peers = '["平安银行"]'::jsonb
WHERE "contentId" = '471d2d1d-53f5-4e0b-a389-496500651cbd';

UPDATE radar_pushes SET "peerName" = '宁波银行', matched_peers = '["宁波银行"]'::jsonb
WHERE "contentId" = '788ee6bf-e194-4e79-9c5f-98dbd2d8a50d';

UPDATE radar_pushes SET "peerName" = '南京银行', matched_peers = '["南京银行"]'::jsonb
WHERE "contentId" = '0c60b869-1c7d-4599-ad1b-f54d18cf7ca2';

-- 合规雷达设置 playbookStatus
UPDATE radar_pushes SET "playbookStatus" = 'ready'
WHERE "radarType" = 'compliance';

-- 清理旧的 playbooks
DELETE FROM compliance_playbooks;

-- 为"金融数据安全分级指南"相关推送创建 playbook
INSERT INTO compliance_playbooks (id, "pushId", "checklistItems", solutions, "reportTemplate", "policyReference", "createdAt", "generatedAt", "organizationId", tenant_id)
SELECT
  gen_random_uuid(),
  rp.id,
  '[
    {"id":"cl-1-1","text":"完成全行数据资产盘点，建立数据资产目录","category":"数据盘点","checked":false,"order":1},
    {"id":"cl-1-2","text":"制定数据分类分级标准，明确C1-C5各级别定义","category":"标准制定","checked":false,"order":2},
    {"id":"cl-1-3","text":"对C4/C5级数据部署国密算法加密方案","category":"技术实施","checked":false,"order":3},
    {"id":"cl-1-4","text":"建立数据访问审批和多因素认证机制","category":"权限管理","checked":false,"order":4},
    {"id":"cl-1-5","text":"配备专职数据安全管理人员并完成培训","category":"组织保障","checked":false,"order":5},
    {"id":"cl-1-6","text":"建立数据安全风险评估定期执行机制","category":"风险评估","checked":false,"order":6}
  ]'::json,
  '[
    {"name":"数据资产盘点与分级平台建设","estimatedCost":800000,"expectedBenefit":3000000,"roiScore":8,"implementationTime":"3个月"},
    {"name":"国密加密改造（存储+传输）","estimatedCost":1500000,"expectedBenefit":5000000,"roiScore":7,"implementationTime":"6个月"},
    {"name":"数据访问控制与审计系统升级","estimatedCost":600000,"expectedBenefit":2000000,"roiScore":7,"implementationTime":"2个月"}
  ]'::json,
  E'# 数据安全分级合规整改报告\n\n## 一、整改背景\n根据央行《金融数据安全分级指南》（JR/T 0197-2025）要求，我行需在2025年底前完成全量数据资产的分类分级工作。\n\n## 二、整改措施\n1. 数据资产盘点：已完成___个系统的数据资产盘点\n2. 分级标准制定：已建立符合JR/T 0197-2025的五级分类标准\n3. 加密改造：C4/C5级数据已部署SM4加密方案\n4. 权限管理：已实施基于角色的访问控制和多因素认证\n\n## 三、整改进度\n- 数据盘点完成率：___%\n- 加密改造完成率：___%\n- 人员培训完成率：___%\n\n## 四、后续计划\n[待填写]',
  '["JR/T 0197-2025 金融数据安全分级指南","《个人信息保护法》","《数据安全法》","等保2.0三级要求"]'::json,
  NOW(),
  NOW(),
  rp."organizationId",
  rp.tenant_id
FROM radar_pushes rp
WHERE rp."contentId" = 'c0199936-6230-4100-b648-4f15a3a8fe53';

-- 为"数据安全处罚案例"相关推送创建 playbook
INSERT INTO compliance_playbooks (id, "pushId", "checklistItems", solutions, "reportTemplate", "policyReference", "createdAt", "generatedAt", "organizationId", tenant_id)
SELECT
  gen_random_uuid(),
  rp.id,
  '[
    {"id":"cl-2-1","text":"排查客户敏感信息加密存储情况","category":"数据加密","checked":false,"order":1},
    {"id":"cl-2-2","text":"清理数据库共享账号，实施最小权限原则","category":"权限管理","checked":false,"order":2},
    {"id":"cl-2-3","text":"检查数据备份策略，确保RPO满足监管要求","category":"备份恢复","checked":false,"order":3},
    {"id":"cl-2-4","text":"建立数据安全事件应急响应预案","category":"应急响应","checked":false,"order":4},
    {"id":"cl-2-5","text":"评估第三方数据共享的安全合规性","category":"第三方管理","checked":false,"order":5},
    {"id":"cl-2-6","text":"开展全员数据安全意识培训","category":"安全培训","checked":false,"order":6}
  ]'::json,
  '[
    {"name":"敏感数据加密存储改造","estimatedCost":500000,"expectedBenefit":6800000,"roiScore":9,"implementationTime":"2个月"},
    {"name":"数据库权限治理与审计","estimatedCost":300000,"expectedBenefit":2000000,"roiScore":8,"implementationTime":"1个月"},
    {"name":"数据备份与灾备体系升级","estimatedCost":1000000,"expectedBenefit":5000000,"roiScore":7,"implementationTime":"3个月"},
    {"name":"应急响应体系建设","estimatedCost":200000,"expectedBenefit":3000000,"roiScore":9,"implementationTime":"1个月"}
  ]'::json,
  E'# 数据安全管理整改报告\n\n## 一、整改背景\n参照银保监会对某城商行数据安全违规处罚案例（罚款680万元），我行主动开展数据安全自查整改。\n\n## 二、自查发现\n1. 敏感数据加密：发现___处未加密存储的敏感数据\n2. 权限管理：发现___个共享账号需要清理\n3. 数据备份：当前RPO为___，需优化至___\n4. 应急响应：___（现状描述）\n\n## 三、整改措施\n[详细整改方案]\n\n## 四、整改时间表\n- 第1个月：完成敏感数据加密和权限清理\n- 第2个月：完成备份策略优化\n- 第3个月：完成应急响应体系建设\n\n## 五、责任人\n[待指定]',
  '["《银行业金融机构数据治理指引》","《个人信息保护法》","《网络安全法》","银保监会处罚通报"]'::json,
  NOW(),
  NOW(),
  rp."organizationId",
  rp.tenant_id
FROM radar_pushes rp
WHERE rp."contentId" = 'c3b12522-7768-4dff-9f97-8b43d86d88c8';

-- 为"个人信息出境"相关推送创建 playbook
INSERT INTO compliance_playbooks (id, "pushId", "checklistItems", solutions, "reportTemplate", "policyReference", "createdAt", "generatedAt", "organizationId", tenant_id)
SELECT
  gen_random_uuid(),
  rp.id,
  '[
    {"id":"cl-3-1","text":"梳理所有涉及数据出境的业务场景","category":"场景梳理","checked":false,"order":1},
    {"id":"cl-3-2","text":"建立数据出境台账，记录数据类型、规模、目的地","category":"台账管理","checked":false,"order":2},
    {"id":"cl-3-3","text":"评估数据接收方的安全保护能力","category":"第三方评估","checked":false,"order":3},
    {"id":"cl-3-4","text":"准备数据出境安全评估申报材料","category":"合规申报","checked":false,"order":4},
    {"id":"cl-3-5","text":"制定数据出境应急预案","category":"应急预案","checked":false,"order":5}
  ]'::json,
  '[
    {"name":"数据出境场景梳理与台账建设","estimatedCost":200000,"expectedBenefit":5000000,"roiScore":9,"implementationTime":"1个月"},
    {"name":"数据出境安全评估体系建设","estimatedCost":500000,"expectedBenefit":10000000,"roiScore":8,"implementationTime":"3个月"},
    {"name":"数据接收方安全能力评估","estimatedCost":300000,"expectedBenefit":3000000,"roiScore":7,"implementationTime":"2个月"}
  ]'::json,
  E'# 个人信息出境合规评估报告\n\n## 一、评估背景\n根据网信办《个人信息出境安全评估办法》修订版要求，处理100万人以上个人信息的金融机构须通过国家安全评估。\n\n## 二、数据出境现状\n1. 涉及数据出境的业务场景：___个\n2. 出境数据涉及人数：___万人\n3. 数据接收方：___（国家/地区）\n4. 数据类型：___\n\n## 三、风险评估\n1. 数据安全风险：___\n2. 个人权益影响：___\n3. 法律合规风险：___\n\n## 四、整改建议\n[待填写]\n\n## 五、申报计划\n- 征求意见反馈截止：2025年3月31日\n- 预计正式实施：2025年6月1日',
  '["《个人信息出境安全评估办法》（修订版）","《个人信息保护法》","《数据安全法》","《网络安全法》"]'::json,
  NOW(),
  NOW(),
  rp."organizationId",
  rp.tenant_id
FROM radar_pushes rp
WHERE rp."contentId" = '07a138d6-d199-47a8-8288-a2a997768bab';

COMMIT;
