# BMAD Story Pipeline Workflow Steps

Interpret this file as an ordered list of skill invocations for the current workspace.

## Execution Rules

- Replace `{STORY_ID}` before each step.
- Invoke the skill directly by name. Do not rely on literal slash commands, `Task(...)`, or a `yolo` flag.
- Run steps sequentially in the current repository workspace.
- Stop at the first failing step.
- Re-run the current step after fixes before moving to the next one.
- If the current workspace is not isolated enough for the story, switch to `bmad-story-pipeline-worktree` instead of continuing here.

## Steps

### Step 1: Create or Refresh Story Context
- Skill: `bmad-create-story`
- Input: `{STORY_ID}`
- Purpose: Create the story file if it is missing and refresh implementation context from planning artifacts.
- Return: Story title, created or updated files, readiness issues.

### Step 2: Generate Acceptance Tests
- Skill: `bmad-testarch-atdd`
- Input: `{STORY_ID}`
- Purpose: Produce failing acceptance tests or explicit acceptance coverage artifacts.
- Return: Test artifacts created, coverage intent, blockers.

### Step 3: Implement the Story
- Skill: `bmad-dev-story`
- Input: `{STORY_ID}`
- Purpose: Implement the story and make the required tests pass.
- Return: Modified files, tests run, unresolved risks.

### Step 4: Run Code Review
- Skill: `bmad-code-review`
- Input: `{STORY_ID}`
- Purpose: Perform adversarial review and enumerate blocking issues.
- Return: Pass or fail conclusion, issues by severity, required fixes.

### Step 5: Trace Requirements to Tests
- Skill: `bmad-testarch-trace`
- Input: `{STORY_ID}`
- Purpose: Produce a traceability matrix and gate decision after fixes land.
- Return: Coverage status, gate decision, remaining gaps.

## Post-Pipeline

After all steps succeed:

1. Update sprint status for the story to `done`.
2. Update the story document status and checklist if present.

## Compatibility Note

Legacy aliases such as `/bmad-bmm-create-story` or `/bmad-tea-testarch-atdd` may still work in some BMAD installs, but prefer the canonical skill names above.

## Customization

- Add or remove steps as needed.
- Keep steps in the order they should execute.
- Use canonical skill names rather than legacy aliases when editing this file.
