const http = require('http');

const taskId = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/ai-tasks/${taskId}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '65fefcd7-3b4b-49d7-a56f-8db474314c62'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📡 API Response Status:', res.statusCode);
      console.log('📦 Response Keys:', Object.keys(response));
      console.log('📋 Data Keys:', Object.keys(response.data || {}));

      if (response.data) {
        const task = response.data;
        console.log('\n✅ Task Info:');
        console.log('  ID:', task.id);
        console.log('  Status:', task.status);
        console.log('  Type:', task.type);
        console.log('  Has result:', !!task.result);

        if (task.result) {
          console.log('\n📊 Result Structure:');
          console.log('  Keys:', Object.keys(task.result));

          if (task.result.content) {
            console.log('\n✅ Has content field');
            console.log('  Type:', typeof task.result.content);
            console.log('  Is string:', typeof task.result.content === 'string');
            console.log('  Length:', task.result.content.length);

            if (typeof task.result.content === 'string') {
              try {
                const parsed = JSON.parse(task.result.content);
                console.log('\n✅ Content is valid JSON');
                console.log('  Parsed keys:', Object.keys(parsed));
                console.log('  Has document_comparison:', !!parsed.document_comparison);
              } catch (e) {
                console.log('\n❌ Content is NOT valid JSON');
                console.log('  Error:', e.message);
              }
            }
          } else if (task.result.gpt4) {
            console.log('\n✅ Has gpt4 field (new format)');
          } else {
            console.log('\n⚠️ Unknown result format');
          }
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.end();
