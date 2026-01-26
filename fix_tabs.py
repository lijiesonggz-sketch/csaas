import re

# Read the file
with open('frontend/app/projects/[projectId]/standard-interpretation/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Tabs section and extract TabPane contents
in_tabs = False
tabs_content = {}
current_key = None
current_content = []
brace_count = 0

for i, line in enumerate(lines):
    if '<Tabs activeKey={activeTab} onChange={setActiveTab}>' in line:
        in_tabs = True
        continue
    if in_tabs and '</Tabs>' in line:
        in_tabs = False
        break
    if in_tabs and '<TabPane' in line:
        # Extract key
        key_match = re.search(r'key="([^"]+)"', line)
        if key_match:
            current_key = key_match.group(1)
            current_content = []
            brace_count = 0
    elif current_key:
        current_content.append(line)
        # Count braces to find end of TabPane
        brace_count += line.count('{') - line.count('}')
        if '</TabPane>' in line and brace_count <= 0:
            tabs_content[current_key] = ''.join(current_content).replace('</TabPane>', '')
            current_key = None
            current_content = []

print("Found tabs:", list(tabs_content.keys()))
for key, content in tabs_content.items():
    print(f"\n=== {key} ===")
    print(content[:200])
