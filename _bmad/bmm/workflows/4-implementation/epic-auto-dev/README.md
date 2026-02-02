# Epic Auto-Dev Workflow

## Overview

The `epic-auto-dev` workflow automates the complete EPIC development lifecycle, eliminating the need for manual command execution at each step. This workflow processes all stories in an EPIC from creation through code review, ensuring consistent quality and reducing manual overhead.

## What It Does

The workflow automates the following 8-step process for each story in an EPIC:

1. **Create Story** - Generates story file from epic backlog
2. **Validate Story** - Uses Scrum Master to verify story quality
3. **Develop Story** - Implements all tasks/subtasks following TDD
4. **Expand Tests** - Generates additional test coverage
5. **Code Review** - Finds and auto-fixes issues
6. **Loop** - Repeats until all stories are done
7. **Complete EPIC** - Updates EPIC status and generates report
8. **Retrospective** - Optionally runs retrospective

## How to Use

### Option 1: Via BMad Master Menu

```bash
# Load BMad Master agent
*bmad-master

# Select from menu:
# 4. Automate EPIC Development (Full Cycle)
```

### Option 2: Direct Command

```bash
epic-auto-dev
```

### Option 3: Via Workflow Invocation

```bash
# From any workflow or agent
invoke-workflow: {project-root}/_bmad/bmm/workflows/4-implementation/epic-auto-dev/workflow.yaml
```

## Workflow Behavior

### EPIC Selection

- **Single in-progress EPIC**: Automatically selected
- **Multiple in-progress EPICs**: User prompted to choose
- **"all" option**: Processes all in-progress EPICs sequentially

### Story Processing Order

Stories are processed in the order they appear in `sprint-status.yaml`:

1. `backlog` stories (creates story file)
2. `ready-for-dev` stories (validates and develops)
3. `in-progress` stories (continues development)
4. `review` stories (runs tests and code review)

### Automation Level

**Fully Automated** - No user intervention required except:
- EPIC selection (if multiple EPICs)
- Error conditions requiring manual fix
- Retrospective decision at completion

### Error Handling

**Blocking Errors** (workflow stops):
- Story creation failure
- Story development failure
- Code review failure

**Non-Blocking Errors** (workflow continues):
- Test automation failure (logs warning)

## Output

### Progress Indicators

The workflow provides real-time progress updates:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Processing Story: 3-2-peer-case-matching-and-push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Status: ready-for-dev
EPIC: epic-3

📝 Step 2.1: Creating Story
✅ Story created successfully

🔍 Step 2.2: Validating Story Quality
✅ Story validation complete

💻 Step 2.3: Developing Story
✅ Story development complete

🧪 Step 2.4: Expanding Test Coverage
✅ Test coverage expansion complete

🔍 Step 2.5: Code Review and Auto-Fix
✅ Story Complete!
```

### Completion Report

Generated at: `{output_folder}/epic-auto-dev-report-{date}.md`

Report includes:
- EPIC identification
- Total stories processed
- Story-by-story summary (status, duration, results)
- Overall statistics
- Error details (if any)

## Integration with Existing Workflows

### Workflow Invocations

The workflow invokes these existing workflows:

1. **create-story** - `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
2. **dev-story** - `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
3. **code-review** - `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`
4. **testarch-automate** - `_bmad/bmm/workflows/testarch/automate/workflow.yaml`

### Scrum Master Integration

The workflow loads and executes the Scrum Master agent's `*validate-create-story` command for story quality validation.

## Configuration

### Variables (from workflow.yaml)

```yaml
variables:
  sprint_status: "{sprint_artifacts}/sprint-status.yaml"
  story_dir: "{sprint_artifacts}"
  max_retries: 3
  auto_fix_issues: true
```

### Customization

To modify workflow behavior, edit:
- `workflow.yaml` - Configuration and variables
- `instructions.xml` - Execution logic
- `checklist.md` - Validation criteria

## Requirements

### Prerequisites

- `sprint-status.yaml` must exist
- At least one EPIC in "in-progress" status
- All sub-workflows must be available
- Git repository (for code review)

### Dependencies

- BMAD Core Platform
- BMM Module
- All standard BMM workflows

## Best Practices

### When to Use

✅ **Use epic-auto-dev when:**
- You have a complete EPIC ready for implementation
- Stories are well-defined in the epic file
- You want consistent, automated quality checks
- You prefer hands-off development

❌ **Don't use epic-auto-dev when:**
- Stories need significant clarification
- You want to manually review each step
- EPIC requirements are still evolving
- You're experimenting with approaches

### Tips

1. **Ensure Story Quality**: Run `create-epics-and-stories` first to ensure high-quality story definitions
2. **Check Architecture**: Verify architecture document is complete before starting
3. **Monitor Progress**: Watch for error messages and address them promptly
4. **Review Reports**: Check the completion report for insights
5. **Run Retrospective**: Always run retrospective after EPIC completion

## Troubleshooting

### Workflow Stops Unexpectedly

**Check:**
1. Error message in output
2. Current story status in `sprint-status.yaml`
3. Story file for incomplete tasks
4. Test failures in console

**Resolution:**
- Fix the reported issue manually
- Re-run the workflow (it will resume from current state)

### Story Stuck in "in-progress"

**Cause:** Development or code review found issues

**Resolution:**
1. Check story file for review findings
2. Address issues manually
3. Re-run workflow to continue

### EPIC Not Completing

**Cause:** Some stories not reaching "done" status

**Resolution:**
1. Check `sprint-status.yaml` for story statuses
2. Identify stuck stories
3. Process stuck stories manually
4. Re-run workflow to complete EPIC

## Architecture

### Workflow Structure

```
epic-auto-dev/
├── workflow.yaml       # Configuration and metadata
├── instructions.xml    # Execution logic (3 main steps)
├── checklist.md       # Validation criteria
└── README.md          # This file
```

### Execution Flow

```
Step 1: Initialize and Select EPIC
  ├─ Load sprint-status.yaml
  ├─ Find in-progress EPICs
  └─ Select EPIC to process

Step 2: Story Loop (repeats for each story)
  ├─ 2.1: Create Story (if backlog)
  ├─ 2.2: Validate Story (if ready-for-dev)
  ├─ 2.3: Develop Story (if ready-for-dev or in-progress)
  ├─ 2.4: Expand Tests (if review)
  ├─ 2.5: Code Review (if review)
  └─ 2.6: Check Next Story

Step 3: EPIC Completion
  ├─ Update EPIC status to "done"
  ├─ Generate completion report
  └─ Prompt for retrospective
```

## Version History

- **v1.0.0** (2026-02-02): Initial implementation
  - Full EPIC automation
  - Story creation, validation, development, testing, code review
  - Multi-EPIC support
  - Comprehensive error handling
  - Integration with BMad Master menu

## Support

For issues or questions:
1. Check this README
2. Review the completion report
3. Check `sprint-status.yaml` for current state
4. Consult BMad documentation
5. Ask in BMad community channels
