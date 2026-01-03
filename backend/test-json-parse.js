const fs = require('fs');

const filePath = 'D:\\csaas\\backend\\debug-ai-responses\\1767383285519-error.json';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File size:', content.length, 'bytes');
  console.log('First 200 chars:', content.substring(0, 200));
  console.log('\nLast 200 chars:', content.substring(content.length - 200));

  // Try to parse
  try {
    const parsed = JSON.parse(content);
    console.log('\n✅ JSON parsed successfully');
    console.log('Measures count:', parsed.measures?.length);
  } catch (e) {
    console.log('\n❌ JSON parse error:', e.message);
    console.log('Error position info:', e);

    // Try to find the position of corrupted characters
    const corruptionIndex = content.indexOf('�');
    if (corruptionIndex > -1) {
      console.log('\nFirst corruption at position:', corruptionIndex);
      console.log('Context:', content.substring(Math.max(0, corruptionIndex - 50), corruptionIndex + 50));
    }
  }
} catch (e) {
  console.error('Error reading file:', e.message);
}
