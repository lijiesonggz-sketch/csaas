# Epic Auto-Dev Workflow Validation Checklist

## Pre-Execution Validation

- [ ] sprint-status.yaml file exists and is readable
- [ ] At least one EPIC is in "in-progress" status
- [ ] EPIC has at least one story that is NOT "done"
- [ ] All required workflow files exist:
  - [ ] create-story workflow
  - [ ] dev-story workflow
  - [ ] code-review workflow
  - [ ] testarch-automate workflow

## Story Processing Validation

For each story processed, verify:

- [ ] Story creation (if status was "backlog"):
  - [ ] Story file created in story_dir
  - [ ] Status updated to "ready-for-dev" in sprint-status.yaml
  - [ ] Story file contains all required sections

- [ ] Story validation (if status was "ready-for-dev"):
  - [ ] Scrum Master validation executed
  - [ ] Story quality improvements applied
  - [ ] No validation errors

- [ ] Story development (if status was "ready-for-dev" or "in-progress"):
  - [ ] All tasks/subtasks marked complete [x]
  - [ ] All tests pass (unit, integration, E2E if required)
  - [ ] Status updated to "review" in sprint-status.yaml
  - [ ] File List updated with all changed files

- [ ] Test automation (if status was "review"):
  - [ ] testarch-automate workflow executed
  - [ ] Additional tests generated (or gracefully skipped if failed)
  - [ ] All tests still pass

- [ ] Code review (if status was "review"):
  - [ ] code-review workflow executed
  - [ ] 3-10 issues identified
  - [ ] All HIGH and MEDIUM issues automatically fixed
  - [ ] Status updated to "done" (or "in-progress" if issues remain)

## EPIC Completion Validation

- [ ] All stories in EPIC have status "done"
- [ ] EPIC status updated to "done" in sprint-status.yaml
- [ ] sprint-status.yaml structure and comments preserved
- [ ] EPIC completion report generated
- [ ] Report saved to output folder

## Report Quality Validation

The generated report must include:

- [ ] EPIC identification (key, number, name)
- [ ] Total story count
- [ ] Story-by-story summary with:
  - [ ] Story key
  - [ ] Final status
  - [ ] Processing duration
  - [ ] Validation result
  - [ ] Development result
  - [ ] Test automation result
  - [ ] Code review result
- [ ] Overall statistics:
  - [ ] Total stories processed
  - [ ] Success count
  - [ ] Failure count (if any)
  - [ ] Total duration
- [ ] Error details (if any errors occurred)

## Error Handling Validation

- [ ] Workflow stops on critical errors (story creation, development, code review failures)
- [ ] Non-critical errors logged but don't stop workflow (test automation failures)
- [ ] Error messages are clear and actionable
- [ ] Current progress saved to sprint-status.yaml before halting

## Sprint Status Integrity Validation

- [ ] sprint-status.yaml file structure preserved
- [ ] All comments preserved (especially STATUS DEFINITIONS)
- [ ] Story status transitions follow valid flow:
  - [ ] backlog → ready-for-dev → in-progress → review → done
- [ ] EPIC status correctly reflects story completion
- [ ] No orphaned or corrupted entries

## Multi-EPIC Processing Validation (if applicable)

- [ ] User prompted to select EPIC when multiple in-progress EPICs exist
- [ ] "all" option processes EPICs sequentially
- [ ] Each EPIC processed completely before moving to next
- [ ] Report includes all processed EPICs

## User Experience Validation

- [ ] Clear progress indicators for each step
- [ ] Story-by-story status updates
- [ ] Meaningful error messages
- [ ] Retrospective prompt at completion
- [ ] Final summary with report location

## Integration Validation

- [ ] Workflow callable from BMad Master menu
- [ ] Workflow callable as standalone command
- [ ] All workflow invocations use correct paths
- [ ] Workflow respects communication_language setting
- [ ] Workflow respects user_skill_level setting
