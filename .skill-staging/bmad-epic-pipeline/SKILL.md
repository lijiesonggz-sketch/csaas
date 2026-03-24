---
name: bmad-epic-pipeline
description: Deliver an Epic by running bmad-story-pipeline sequentially for each incomplete story in the current repository workspace. Use when the user wants end-to-end epic delivery on the current branch without git worktree isolation.
---

# BMAD Epic Pipeline

Deliver every incomplete story in Epic `{ARGUMENT}` by invoking `bmad-story-pipeline` sequentially in the current repository workspace.

Use this variant only when the current branch and workspace are already dedicated to the Epic. If the user needs git worktree isolation, merge gates, or PR-only protection, prefer `bmad-epic-pipeline-worktree`.

## Resolve Status File

Resolve the sprint status file in this order and use the first existing path:

1. `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. `_bmad-output/sprint-artifacts/sprint-status.yaml`
3. `docs/sprint/sprint-status.yaml`

If none exists, stop and tell the user the project is missing sprint status tracking.

## Preflight

Before running the Epic pipeline:

1. Confirm the current directory is inside a git repository.
2. Record the current branch name and `git status --porcelain` output.
3. Confirm the current branch and workspace are intended for this Epic.
4. If there are unrelated uncommitted edits, stop and ask the user to isolate them first.
5. Confirm checkpoint commits on the current branch are acceptable after each completed story.
6. If isolation, merge gates, or PR-only behavior is required, stop and use `bmad-epic-pipeline-worktree` instead.

This skill does not create worktrees and does not merge branches. It advances the Epic on the current branch by completing one story at a time and creating local checkpoint commits between stories.

## Determine Epic Number

If `{ARGUMENT}` is empty:

1. Read the resolved sprint status file.
2. Inspect `development_status`.
3. Find entries whose keys look like story ids for an Epic, including forms such as `6-1`, `6-1A`, and `6-1B`.
4. Ignore non-story keys such as `epic-1` and `epic-1-retrospective`.
5. Ignore terminal statuses: `done`, `optional`, and `deprecated`.
6. Extract the Epic number from each remaining story key.
7. Select the smallest Epic number and report it before continuing.

If no incomplete stories exist, stop and report that there is no eligible Epic to run.

## Collect Story List

Read the resolved sprint status file and collect all incomplete stories for Epic `{ARGUMENT}`:

1. Match keys that start with `{ARGUMENT}-`.
2. Ignore non-story keys such as `epic-{ARGUMENT}` and `epic-{ARGUMENT}-retrospective`.
3. Keep only statuses not in `done`, `optional`, or `deprecated`.
4. Sort by story number as an integer, then by optional alphabetical suffix.
5. Return each story as story id, story name, and current status.

If no incomplete stories remain for the Epic, stop and report that the Epic is already complete.

## Execute Stories Sequentially

For each story in order:

1. Invoke `bmad-story-pipeline` with that story id.
2. Wait for completion before starting the next story.
3. If the story pipeline reports failure, stop the Epic run immediately.
4. After a successful story pipeline, inspect `git status --porcelain`.
5. If changes are present, create a checkpoint commit on the current branch:
   - `git add .`
   - `git commit -m "feat: complete story {STORY_ID}"`
6. If checkpoint commit is not allowed or fails, stop and preserve the current workspace for manual handling.
7. Keep a running summary of completed stories and the first failing story, if any.

Do not run story deliveries in parallel. Each story can update shared sprint artifacts and the next story should begin only after the previous one has produced a clean checkpoint.

## Finalize Epic Status

After all story runs succeed:

1. Re-read the resolved sprint status file.
2. Confirm every story under Epic `{ARGUMENT}` is now `done` or `deprecated`.
3. If true, update `epic-{ARGUMENT}: done`.
4. Leave `epic-{ARGUMENT}-retrospective` unchanged.
5. If the status-file update changes the working tree, create a final checkpoint commit:
   `git add . && git commit -m "chore: mark epic {ARGUMENT} done"`
6. Report final completion counts and resulting commits.

If any story remains incomplete, leave the Epic status as-is and report the remaining blockers.

## Failure Handling

If any story fails:

1. Stop immediately.
2. Preserve the current workspace and current branch state.
3. Report the story id, failing phase, and unresolved blockers.
4. Do not touch later stories.

If the failure happens after one or more successful story checkpoint commits, keep those commits. Re-running the skill should skip stories already marked `done` and continue from the next incomplete story.

## Configuration

This skill inherits per-story execution rules from `bmad-story-pipeline`.

To customize the per-story pipeline, edit:
`bmad-story-pipeline/references/workflow-steps.md`
