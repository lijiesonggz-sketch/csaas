---
name: bmad-epic-pipeline-worktree
description: Deliver an Epic by running bmad-story-pipeline-worktree sequentially for each incomplete story in isolated repo-local worktrees. Use when the user wants end-to-end story delivery for an Epic with safe merge gates and resumable progress.
---

# BMAD Epic Pipeline (Worktree Edition)

Deliver every incomplete story in Epic `{ARGUMENT}` by invoking `bmad-story-pipeline-worktree` sequentially. Keep each story isolated in its own repo-local worktree and stop immediately on the first failure.

## Resolve Status File

Resolve the sprint status file in this order and use the first existing path:

1. `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. `_bmad-output/sprint-artifacts/sprint-status.yaml`
3. `docs/sprint/sprint-status.yaml`

If none exists, stop and tell the user the project is missing sprint status tracking.

## Preflight

Before touching git:

1. Confirm the current directory is inside a git repository.
2. Confirm `git worktree` is available.
3. Confirm the primary repo worktree is clean with `git status --porcelain`.
4. If the repo is dirty, stop. Do not create worktrees or merge branches while the main worktree has unrelated changes.
5. Prefer an explicit Epic number. Auto-selection is only a fallback.

This skill is intentionally conservative. If the repo must remain dirty or merges must go through PRs only, do not auto-run this workflow.

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

1. Invoke the `bmad-story-pipeline-worktree` skill with that story id.
2. Wait for completion before starting the next story.
3. If the story skill reports failure or preserves a worktree for manual handling, stop the Epic run immediately.
4. Keep a running summary of completed stories and the first failing story, if any.

Do not run story deliveries in parallel. Each story can update shared sprint artifacts and merge into the same branch.

## Finalize Epic Status

After all story runs succeed:

1. Re-read the resolved sprint status file.
2. Confirm every story under Epic `{ARGUMENT}` is now `done` or `deprecated`.
3. If true, update `epic-{ARGUMENT}: done`.
4. Leave `epic-{ARGUMENT}-retrospective` unchanged.
5. Report final completion counts.

If any story remains incomplete, leave the Epic status as-is and report the remaining blockers.

## Failure Handling

If any story fails:

1. Stop immediately.
2. Preserve that story's worktree and feature branch.
3. Report the story id, failure phase, worktree path, and unmet merge conditions.
4. Do not touch later stories.

Re-running the skill should skip stories already marked `done` and continue from the next incomplete story.

## Configuration

This skill inherits execution and merge rules from `bmad-story-pipeline-worktree`.

To customize the per-story pipeline, edit:
`bmad-story-pipeline-worktree/references/workflow-steps.md`
