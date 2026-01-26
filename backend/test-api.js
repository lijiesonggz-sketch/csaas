// 测试后端API是否工作
const testAPI = async () => {
  try {
    const response = await fetch('http://localhost:3000/ai-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-project',
        type: 'standard_interpretation',
        input: {
          standardDocument: {
            id: 'test-doc',
            name: 'Test Standard',
            content: 'Test content here...',
          },
          interpretationMode: 'basic',
        },
      }),
    })

    console.log('Response status:', response.status)
    const result = await response.json()
    console.log('Response data:', result)
  } catch (err) {
    console.error('Error:', err.message)
  }
}

testAPI()
