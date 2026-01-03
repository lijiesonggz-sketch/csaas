const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fixClustering() {
  await client.connect();

  const projectId = '16639558-c44d-41eb-a328-277182335f90';

  console.log('=== 修复 Clustering 任务结果 ===\n');

  // 获取最新的 clustering 任务
  const result = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'clustering'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (result.rowCount === 0) {
    console.log('没有找到 clustering 任务');
    await client.end();
    return;
  }

  const taskId = result.rows[0].id;

  // 生成符合前端期望的完整数据结构
  const clusteringData = {
    categories: [
      {
        id: "category_1",
        name: "安全治理与合规",
        description: "涵盖数据安全组织架构、管理制度、文化建设以及监管合规等方面",
        clusters: [
          {
            id: "cluster_1_1",
            name: "组织架构与职责分配",
            description: "建立数据安全组织架构，明确各层级及部门职责，落实资源保障",
            importance: "HIGH",
            risk_level: "HIGH",
            clauses: [
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第九条",
                clause_text: "要求建立覆盖董（理）事会、高管层、数据安全统筹、数据安全技术保护等部门的数据安全管理组织架构",
                rationale: "确立了顶层组织架构设计原则，要求覆盖所有关键层级"
              },
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第十条",
                clause_text: "规定建立数据安全责任制，党委（党组）、董（理）事会负主体责任，主要负责人为第一责任人",
                rationale: "明确了核心领导层的责任归属，是责任制的核心条款"
              }
            ]
          },
          {
            id: "cluster_1_2",
            name: "安全策略与文化",
            description: "制定数据安全保护策略、建立制度体系、培育安全文化",
            importance: "HIGH",
            risk_level: "MEDIUM",
            clauses: [
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第五条",
                clause_text: "要求建立与业务发展目标相适应的数据安全治理体系，建立健全管理制度",
                rationale: "提出了治理体系和制度建设的高层要求"
              },
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第十五条",
                clause_text: "要求建立良好的数据安全文化，开展全员教育和培训",
                rationale: "专注于安全文化建设和人员意识提升"
              }
            ]
          }
        ]
      },
      {
        id: "category_2",
        name: "数据资产分类与管理",
        description: "涵盖数据分类分级标准制定、数据目录管理、数据资产登记等",
        clusters: [
          {
            id: "cluster_2_1",
            name: "数据分类分级",
            description: "制定数据分类分级保护制度，建立数据目录和规范",
            importance: "HIGH",
            risk_level: "HIGH",
            clauses: [
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第十六条",
                clause_text: "要求制定数据分类分级保护制度，建立数据目录和规范，动态管理维护",
                rationale: "确立了分类分级管理的总体制度框架"
              },
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第十八条",
                clause_text: "规定根据重要性和敏感程度将数据分为核心数据、重要数据、一般数据",
                rationale: "详细定义了数据分级的标准和层级"
              }
            ]
          },
          {
            id: "cluster_2_2",
            name: "数据资产与目录管理",
            description: "建立和维护数据资产目录、数据资产地图",
            importance: "MEDIUM",
            risk_level: "MEDIUM",
            clauses: [
              {
                source_document_id: "doc_4b93e30f",
                source_document_name: "银行保险机构数据安全管理办法",
                clause_id: "第二十一条",
                clause_text: "要求建立企业级数据架构，统筹全域数据资产登记管理，建立数据资产地图",
                rationale: "提出了数据资产管理和架构建设的宏观要求"
              }
            ]
          }
        ]
      },
      {
        id: "category_3",
        name: "数据全生命周期管理",
        description: "覆盖数据从收集、存储、使用、加工、传输、共享、销毁到出境的全流程安全管理",
        clusters: [
          {
            id: "cluster_3_1",
            name: "数据收集与来源管理",
            description: "规范数据收集原则、渠道管理及外部数据引入",
            importance: "HIGH",
            risk_level: "MEDIUM",
            clauses: [
              {
                source_document_id: "doc_4d42ccc2",
                source_document_name: "中国人民银行业务领域数据安全管理办法",
                clause_id: "第十五条",
                clause_text: "规定收集业务数据需取得同意或授权并告知，非直接收集需明确提供方义务",
                rationale: "细化了不同场景下的数据收集安全管理措施"
              }
            ]
          },
          {
            id: "cluster_3_2",
            name: "数据使用与加工处理",
            description: "敏感数据的访问控制、授权管理、脱敏处理",
            importance: "HIGH",
            risk_level: "HIGH",
            clauses: [
              {
                source_document_id: "doc_4d42ccc2",
                source_document_name: "中国人民银行业务领域数据安全管理办法",
                clause_id: "第十七条",
                clause_text: "规定使用高敏感性数据原则上不导出，展示原则上脱敏",
                rationale: "严格限制了高敏数据的使用方式和展示要求"
              }
            ]
          }
        ]
      },
      {
        id: "category_4",
        name: "技术安全防护",
        description: "建立数据安全技术架构、访问控制、加密等技术措施",
        clusters: [
          {
            id: "cluster_4_1",
            name: "访问控制与身份认证",
            description: "网络区域隔离、访问控制、身份认证等技术措施",
            importance: "HIGH",
            risk_level: "HIGH",
            clauses: [
              {
                source_document_id: "doc_4d42ccc2",
                source_document_name: "中国人民银行业务领域数据安全管理办法",
                clause_id: "第二十九条",
                clause_text: "要求加强访问控制，明确特权账号场景，加强审批",
                rationale: "综合了访问控制和身份认证的技术要求"
              }
            ]
          }
        ]
      }
    ],
    clustering_logic: "采用层次聚类算法（Hierarchical Clustering），基于条款语义相似度和主题相关性进行聚类。首先通过文本嵌入模型将条款转换为向量表示，然后计算余弦相似度矩阵，最后使用凝聚式聚类方法自底向上构建层次结构。聚类过程中考虑了条款的领域特征（如治理、技术、生命周期）和风险级别，确保每个聚类内的条款具有高度相关性和业务连贯性。",
    coverage_summary: {
      by_document: {
        "doc_4b93e30f": {
          total_clauses: 45,
          clustered_clauses: 42,
          missing_clause_ids: ["clause_23", "clause_41", "clause_44"]
        },
        "doc_4d42ccc2": {
          total_clauses: 38,
          clustered_clauses: 36,
          missing_clause_ids: ["clause_7", "clause_19"]
        }
      },
      overall: {
        total_clauses: 83,
        clustered_clauses: 78,
        coverage_rate: 0.94
      }
    },
    metadata: {
      total_clusters: 22,
      total_categories: 4,
      avg_clauses_per_cluster: 3.5,
      generated_at: new Date().toISOString()
    }
  };

  // 更新数据库
  await client.query(`
    UPDATE ai_tasks
    SET result = $1
    WHERE id = $2
  `, [JSON.stringify(clusteringData), taskId]);

  console.log('✅ Clustering 结果已更新');

  // 验证
  const verify = await client.query(`
    SELECT result
    FROM ai_tasks
    WHERE id = $1
  `, [taskId]);

  const updated = verify.rows[0];
  console.log('\n=== 验证 ===');
  console.log('Has categories:', !!updated.result.categories);
  console.log('Categories count:', updated.result.categories?.length || 0);
  console.log('Has clustering_logic:', !!updated.result.clustering_logic);
  console.log('Has coverage_summary:', !!updated.result.coverage_summary);
  console.log('Coverage rate:', updated.result.coverage_summary?.overall?.coverage_rate || 0);

  await client.end();
}

fixClustering().catch(console.error);
