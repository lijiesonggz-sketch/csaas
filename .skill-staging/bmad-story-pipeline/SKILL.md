---
name: bmad-story-pipeline
description: Deliver one story end-to-end in the current repository workspace using a configurable BMAD pipeline. Use when the user wants sequential story delivery without git worktree isolation and the current branch is already dedicated to that story.
---

# BMAD Story Pipeline

Complete story `{ARGUMENT}` using a configurable workflow in the current repository workspace.

Use this variant only when worktree isolation is not required. If the user wants branch isolation, merge gates, or a repo-local scratch workspace, prefer `bmad-story-pipeline-worktree`.

## Resolve Status File

Resolve the sprint status file in this order and use the first existing path:

1. `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. `_bmad-output/sprint-artifacts/sprint-status.yaml`
3. `docs/sprint/sprint-status.yaml`

If the file contains `story_location`, use it as the base folder for story documents. Otherwise use the directory that contains the resolved status file.

## Preflight

Before running the pipeline:

1. Confirm the current directory is inside a git repository.
2. Record the current branch name and `git status --porcelain` output.
3. Confirm the current workspace is already dedicated to the target story or to an enclosing Epic branch that is intentionally carrying completed story changes.
4. If there are unrelated edits in the current workspace, stop and ask the user to isolate them first. Prior committed or in-scope Epic changes are acceptable.
5. If the user needs isolation or a safe merge gate, stop and use `bmad-story-pipeline-worktree` instead.

This skill does not create a worktree and does not merge branches for the user. It assumes the current workspace is the intended place to develop the story.

## Determine Story Number

If `{ARGUMENT}` is empty:

1. Read `development_status` from the resolved sprint status file.
2. Ignore keys that start with `epic-`.
3. Ignore terminal statuses: `done`, `optional`, and `deprecated`.
4. Prefer the first story from the first non-empty bucket in this order:
   - `in-progress`, `review`, `dev-completed`, `test-automated`, `story-created`, `story-validated`, `ready-for-dev`
   - `backlog`, `todo`
   - any other non-terminal status
5. Within the chosen bucket, select the smallest story id.
6. Support ids such as `1-1`, `6-1A`, and `6-1B`.

If no eligible story exists, stop and ask the user for an explicit story id.

## Execution Strategy

1. Read `references/workflow-steps.md`.
2. Execute each configured step sequentially in the current workspace.
3. Treat each configured step as a skill invocation, not as a shell slash command.
4. Run in the current agent by default. Use subagents only when the user explicitly asked for delegation or the platform requires that execution model.
5. After each step, summarize completion status, key outputs, and blockers.
6. If any step fails, stop immediately and do not continue.

## Workflow Execution

For each step defined in `references/workflow-steps.md`:

1. Replace `{STORY_ID}` with the actual story id.
2. Invoke the named skill directly with the story id as input.
3. Wait for the step to complete.
4. Output progress as `[X/N] Step Name - Status`.
5. If the step reports blocking issues, stop and report them.

## Progress Display

After each successful step, report concise progress:

```text
[2/5] Generate Acceptance Tests - complete
Result: created failing acceptance coverage for story 1-1
```

## Error Handling

If any step fails:

1. Stop executing subsequent steps.
2. Preserve the current workspace exactly as-is.
3. Report:
   - the failing step name
   - the relevant skill name
   - the blocking error or unresolved findings
   - the next manual action needed
4. Do not mark the story as done.

Suggested recovery actions should reference the canonical skill name from `references/workflow-steps.md`, not a legacy slash command.

## Post-Pipeline: Update Status

After all configured steps complete successfully and blocking findings are resolved:

1. Update the resolved sprint status file.
2. Find the exact story key that begins with `{STORY_ID}-`.
3. Set its status to `done`.
4. If the corresponding story document exists at `{story_location}/{story-key}.md`:
   - change the top `Status:` line to `done`
   - mark remaining task boxes from `- [ ]` to `- [x]` only when the work is actually complete
5. Do not change unrelated stories or retrospective entries.

## Final Output

When the pipeline succeeds, report:

- story id
- final status
- steps completed
- major artifacts or code outputs
- any residual follow-up items that are explicitly non-blocking

## Configuration

To customize the pipeline workflow, edit:
`references/workflow-steps.md`

Supported changes:

- add or remove steps
- modify invoked skills
- reorder steps
- change step descriptions

