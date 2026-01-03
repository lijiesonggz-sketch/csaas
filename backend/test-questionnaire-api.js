// 测试问卷任务 API
const http = require('http');

const taskId = '23c656e2-6a67-4133-b453-069c61d2110e';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/ai-tasks/${taskId}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '65fefcd7-3b4b-49d7-a56f-8db474314c62',
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📡 API 响应状态:', res.statusCode);
    console.log('\n📦 API 返回数据:\n');

    try {
      const parsed = JSON.parse(data);

      if (parsed.success && parsed.data) {
        const task = parsed.data;
        console.log('✅ API 返回成功');
        console.log(`任务ID: ${task.id}`);
        console.log(`类型: ${task.type}`);
        console.log(`状态: ${task.status}`);
        console.log(`有 result: ${!!task.result}`);

        if (task.result) {
          console.log(`\nresult keys:`, Object.keys(task.result));

          if (task.result.content) {
            console.log(`\n✅ 有 content`);
            console.log(`content 类型:`, typeof task.result.content);

            try {
              const content = typeof task.result.content === 'string'
                ? JSON.parse(task.result.content)
                : task.result.content;

              console.log(`\n解析后 keys:`, Object.keys(content));

              if (content.questionnaire) {
                console.log(`\n🎯 问卷题目数量: ${content.questionnaire.length}`);

                // 统计聚类
                const clusters = {};
                content.questionnaire.forEach(q => {
                  if (!clusters[q.cluster_name]) {
                    clusters[q.cluster_name] = 0;
                  }
                  clusters[q.cluster_name]++;
                });

                console.log(`\n📊 聚类数量: ${Object.keys(clusters).length}`);
              }
            } catch (e) {
              console.log(`\n❌ 解析 content 失败:`, e.message);
            }
          }
        }
      } else {
        console.log('❌ API 返回格式异常');
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log('❌ JSON 解析失败');
      console.log('原始数据前500字符:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 请求失败:', e.message);
});

req.end();
