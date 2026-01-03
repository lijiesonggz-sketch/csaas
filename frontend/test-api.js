async function testGetResult() {
  const API_BASE_URL = 'http://localhost:3000'
  const taskId = 'ef378fa9-3ac9-463d-84a0-c33d48f39255'

  try {
    const response = await fetch(`${API_BASE_URL}/ai-generation/result/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (!response.ok) {
      const error = await response.json()
      console.error('Error response:', error)
      return
    }

    const result = await response.json()
    console.log('Success:', result.success)
    console.log('Has data:', !!result.data)
    console.log('Data keys:', Object.keys(result.data || {}))
    console.log('Has selectedResult:', !!result.data?.selectedResult)
    console.log('SelectedResult type:', typeof result.data?.selectedResult)
    console.log('Has categories:', !!result.data?.selectedResult?.categories)
    console.log('Categories count:', result.data?.selectedResult?.categories?.length || 0)

  } catch (error) {
    console.error('Fetch error:', error.message)
  }
}

testGetResult()
