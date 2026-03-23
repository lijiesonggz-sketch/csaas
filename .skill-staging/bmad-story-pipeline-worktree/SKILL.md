---
name: bmad-story-pipeline-worktree
description: Deliver one story end-to-end in an isolated repo-local git worktree using a configurable BMAD pipeline. Use when the user wants safe story development with explicit preflight checks, merge gates, and resumable manual recovery.
---

# BMAD Story Pipeline (Worktree Edition)

Complete story `{ARGUMENT}` using a configurable workflow in an isolated git worktree. Keep the temporary worktree inside the repository at `.worktrees/story-{STORY_ID}` so the workflow remains compatible with sandboxed Codex environments.

## Resolve Status File

Resolve the sprint status file in this order and use the first existing path:

1. `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. `_bmad-output/sprint-artifacts/sprint-status.yaml`
3. `docs/sprint/sprint-status.yaml`

If the file contains `story_location`, use it as the base folder for story documents. Otherwise use the directory that contains the resolved status file.

## Preflight

Before creating a worktree:

1. Confirm the current directory is the primary repo worktree, not an existing linked worktree.
2. Confirm `git worktree` is available.
3. Confirm `git status --porcelain` in the primary repo is empty.
4. Record:
   - `ORIGINAL_REPO_PATH`
   - `CURRENT_BRANCH`
   - `FEATURE_BRANCH = feature/story-{STORY_ID}`
   - `WORKTREE_ROOT = {ORIGINAL_REPO_PATH}/.worktrees`
   - `WORKTREE_PATH = {WORKTREE_ROOT}/story-{STORY_ID}`
5. If the primary repo is dirty, stop and ask the user to commit, stash, or shelve changes first.
6. If the team workflow requires PR-only merges, stop after Phase 2 and preserve the worktree instead of merging automatically.

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

## Phase 1: Create Repo-Local Worktree

1. Create `.worktrees` under the repo root if it does not already exist.
2. If `WORKTREE_PATH` already exists:
   - verify that it targets `FEATURE_BRANCH`
   - reuse it if consistent
   - otherwise stop and ask for manual cleanup
3. If `FEATURE_BRANCH` already exists but no worktree is attached, attach it:
   `git worktree add "{WORKTREE_PATH}" feature/story-{STORY_ID}`
4. Otherwise create both branch and worktree from the current branch:
   `git worktree add -b feature/story-{STORY_ID} "{WORKTREE_PATH}" {CURRENT_BRANCH}`
5. Verify the result with `git worktree list`.

## Phase 2: Run Configurable Pipeline

Switch to `WORKTREE_PATH`, read `references/workflow-steps.md`, and execute each step sequentially.

Interpret the workflow file as skill invocations, not shell slash commands. In Codex:

- invoke the named skill directly
- pass `{STORY_ID}` as the argument
- run the steps in the current agent unless the user explicitly asked for delegation
- summarize outputs and blockers after each step

If any step fails, stop immediately and preserve the worktree.

## Phase 3: Merge or Preserve

Merge automatically only if all of the following are true:

1. All configured steps completed successfully.
2. No unresolved blocking review or test findings remain.
3. Required tests for the story passed.
4. `git status --porcelain` in `ORIGINAL_REPO_PATH` is still empty.
5. Direct merge into `CURRENT_BRANCH` is allowed by the local workflow.

If every condition passes:

1. In `WORKTREE_PATH`, commit all changes:
   `git add .`
   `git commit -m "feat: complete story {STORY_ID}"`
2. In `ORIGINAL_REPO_PATH`, merge the feature branch:
   `git merge feature/story-{STORY_ID} --no-edit`
3. Remove the worktree:
   `git worktree remove "{WORKTREE_PATH}"`
4. Delete the feature branch if no longer needed:
   `git branch -d feature/story-{STORY_ID}`
5. Verify cleanup with `git worktree list`.

If any condition fails, do not merge. Preserve the worktree and report the exact unmet condition.

## Phase 4: Update Status to Done

After a successful merge:

1. Update the resolved sprint status file.
2. Find the exact story key that begins with `{STORY_ID}-`.
3. Set its status to `done`.
4. If the corresponding story document exists at `{story_location}/{story-key}.md`:
   - change the top `Status:` line to `done`
   - mark remaining task boxes from `- [ ]` to `- [x]` only when the work is actually complete
5. Do not change unrelated stories or retrospective entries.

## Failure Handling

If any phase fails:

1. Stop executing subsequent phases.
2. Preserve the worktree and feature branch.
3. Report the current phase, unmet conditions, and recovery commands.

Recovery commands:

```bash
# List worktrees
git worktree list

# Continue in the story worktree
cd {WORKTREE_PATH}

# Commit after manual completion
git add .
git commit -m "fix: manual completion for story {STORY_ID}"

# Merge back from the primary repo
cd {ORIGINAL_REPO_PATH}
git merge feature/story-{STORY_ID}

# Cleanup after merge
git worktree remove "{WORKTREE_PATH}"
git branch -d feature/story-{STORY_ID}
```

## Configuration

To customize the pipeline workflow, edit:
`references/workflow-steps.md`
