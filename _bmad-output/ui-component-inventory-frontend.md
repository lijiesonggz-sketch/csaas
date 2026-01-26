# UI Component Inventory - Frontend

## Overview
This document catalogs all UI components in the Csaas frontend application.

**Framework:** Next.js 14.2 (App Router)
**UI Libraries:** Ant Design 5.29.3 + Material-UI 7.3.6
**Styling:** Tailwind CSS 3.4.0 + Emotion 11.14.0

---

## Page Components (App Router)

### Authentication Pages
- `app/(auth)/login/page.tsx` - User login page
- `app/(auth)/register/page.tsx` - User registration page

### Dashboard & Home
- `app/page.tsx` - Landing/home page
- `app/dashboard/page.tsx` - Main dashboard

### Projects
- `app/projects/page.tsx` - Project list view
- `app/projects/[projectId]/page.tsx` - Project detail/overview
- `app/projects/[projectId]/layout.tsx` - Project-level layout wrapper

### Project Workflows
- `app/projects/[projectId]/upload/page.tsx` - Document upload
- `app/projects/[projectId]/summary/page.tsx` - Summary generation
- `app/projects/[projectId]/clustering/page.tsx` - Clustering analysis
- `app/projects/[projectId]/matrix/page.tsx` - Maturity matrix
- `app/projects/[projectId]/questionnaire/page.tsx` - Questionnaire generation
- `app/projects/[projectId]/gap-analysis/page.tsx` - Gap analysis
- `app/projects/[projectId]/action-plan/page.tsx` - Action plan
- `app/projects/[projectId]/standard-interpretation/page.tsx` - Standard interpretation
- `app/projects/[projectId]/quick-gap-analysis/page.tsx` - Quick gap analysis

### Legacy AI Generation Pages (Standalone)
- `app/ai-generation/summary/page.tsx` - Summary generation (legacy)
- `app/ai-generation/clustering/page.tsx` - Clustering (legacy)
- `app/ai-generation/matrix/page.tsx` - Matrix (legacy)
- `app/ai-generation/questionnaire/page.tsx` - Questionnaire (legacy)
- `app/ai-generation/action-plan/page.tsx` - Action plan (legacy)

### Survey Pages
- `app/survey/fill/page.tsx` - Survey response form
- `app/survey/analysis/page.tsx` - Survey analysis results

---

## Feature Components

### Layout Components (`components/layout/`)
- **Header.tsx** - Top navigation bar with user menu
- **Sidebar.tsx** - Side navigation menu
- **MainLayout.tsx** - Main application layout wrapper

### Project Components (`components/projects/`)
- **ProjectList.tsx** - Grid/list view of projects
- **ProjectCard.tsx** - Individual project card display
- **CreateProjectDialog.tsx** - Modal for creating new projects
- **StepsTabNavigator.tsx** - Tab navigation for project workflow steps
- **TaskStatusIndicator.tsx** - Visual indicator for task status
- **RerunTaskDialog.tsx** - Dialog for rerunning failed tasks
- **RollbackButton.tsx** - Button to rollback task to previous version

### AI Generation Result Displays (`components/features/`)

#### Simple Displays (Compact Views)
- **SimpleSummaryDisplay.tsx** - Compact summary view
- **SimpleClusteringDisplay.tsx** - Compact clustering view
- **SimpleMatrixDisplay.tsx** - Compact matrix view
- **SimpleQuestionnaireDisplay.tsx** - Compact questionnaire view
- **SimpleActionPlanDisplay.tsx** - Compact action plan view

#### Full Result Displays
- **SummaryResultDisplay.tsx** - Full summary with export options
- **ClusteringResultDisplay.tsx** - Full clustering with visualization
- **MatrixResultDisplay.tsx** - Full maturity matrix with heatmap
- **QuestionnaireResultDisplay.tsx** - Full questionnaire with export
- **ActionPlanResultDisplay.tsx** - Full action plan with measures
- **BinaryGapAnalysisResultDisplay.tsx** - Binary gap analysis results

### Utility Components (`components/features/`)
- **DocumentUploader.tsx** - File upload component with PDF parsing
- **TaskProgressBar.tsx** - Real-time task progress indicator
- **QuestionnaireProgressDisplay.tsx** - Questionnaire generation progress
- **MissingClausesHandler.tsx** - Handle missing standard clauses

### Performance Optimized (`components/performance-optimized/`)
- **KeyRequirementsList.tsx** - Optimized list for key requirements

---

## Component Categories

### 1. Layout & Navigation (3 components)
Provide application structure and navigation.

**Components:**
- Header
- Sidebar
- MainLayout

**Key Features:**
- Responsive design
- User authentication state
- Navigation menu

---

### 2. Project Management (7 components)
Handle project CRUD and workflow navigation.

**Components:**
- ProjectList
- ProjectCard
- CreateProjectDialog
- StepsTabNavigator
- TaskStatusIndicator
- RerunTaskDialog
- RollbackButton

**Key Features:**
- Project creation and listing
- Workflow step navigation
- Task status tracking
- Error recovery (rerun/rollback)

---

### 3. AI Result Displays (11 components)
Display AI generation results with export capabilities.

**Simple Displays (5):**
- SimpleSummaryDisplay
- SimpleClusteringDisplay
- SimpleMatrixDisplay
- SimpleQuestionnaireDisplay
- SimpleActionPlanDisplay

**Full Displays (6):**
- SummaryResultDisplay
- ClusteringResultDisplay
- MatrixResultDisplay
- QuestionnaireResultDisplay
- ActionPlanResultDisplay
- BinaryGapAnalysisResultDisplay

**Key Features:**
- Export to Excel/Word
- Data visualization (charts, heatmaps)
- Collapsible sections
- Print-friendly layouts

---

### 4. Input & Upload (2 components)
Handle user input and file uploads.

**Components:**
- DocumentUploader
- MissingClausesHandler

**Key Features:**
- PDF parsing
- Drag-and-drop upload
- File validation
- Progress tracking

---

### 5. Progress & Status (3 components)
Real-time task progress and status indicators.

**Components:**
- TaskProgressBar
- QuestionnaireProgressDisplay
- TaskStatusIndicator

**Key Features:**
- WebSocket real-time updates
- Progress percentage
- Status badges
- Error states

---

## UI Library Usage

### Ant Design Components Used
- **Layout:** Layout, Header, Sider, Content
- **Navigation:** Menu, Tabs, Steps, Breadcrumb
- **Data Display:** Table, Card, Descriptions, Tag, Badge, Collapse
- **Forms:** Form, Input, Select, Upload, Button
- **Feedback:** Modal, Message, Notification, Progress, Spin
- **Data Entry:** DatePicker, Switch, Radio, Checkbox

### Material-UI Components Used
- **Layout:** Box, Container, Grid
- **Inputs:** TextField, Button
- **Feedback:** CircularProgress, LinearProgress
- **Data Display:** Typography, Chip
- **Icons:** @mui/icons-material (various icons)

### Custom Styling
- **Tailwind CSS:** Utility-first styling for layout and spacing
- **Emotion:** CSS-in-JS for dynamic styles
- **CSS Modules:** Component-scoped styles (minimal usage)

---

## State Management

### Zustand Stores
Located in `lib/stores/` (inferred from package.json)

**Expected Stores:**
- Project store
- Task store
- User/auth store

### React Hooks
Custom hooks in `lib/hooks/`:
- `useTaskProgress.ts` - WebSocket task progress tracking
- `useAITaskCache.ts` - AI task result caching

---

## Data Fetching

### API Client
- Base URL: `http://localhost:3000/api`
- Fetch-based API calls
- Error handling with toast notifications

### Real-time Updates
- **Socket.io Client** - WebSocket connection for task progress
- **Events:** `task-progress`, `task-error`, `task-completed`

---

## Export Functionality

### Document Generation
- **Excel Export:** Using `xlsx` library
- **Word Export:** Using `docx` library
- **PDF Viewing:** Using `pdfjs-dist` library

### Export Features
- Maturity matrix → Excel
- Questionnaire → Word/Excel
- Action plan → Word/Excel
- Standard interpretation → Word/Excel

---

## Routing Structure

```
/                           # Landing page
/dashboard                  # Dashboard
/projects                   # Project list
/projects/[id]              # Project detail
  ├── /upload               # Document upload
  ├── /summary              # Summary generation
  ├── /clustering           # Clustering analysis
  ├── /matrix               # Maturity matrix
  ├── /questionnaire        # Questionnaire
  ├── /gap-analysis         # Gap analysis
  ├── /action-plan          # Action plan
  ├── /standard-interpretation  # Standard interpretation
  └── /quick-gap-analysis   # Quick gap analysis
/survey/fill                # Survey form
/survey/analysis            # Survey results
/(auth)/login               # Login
/(auth)/register            # Register
```

---

## Performance Optimizations

### Implemented
- **Code Splitting:** Next.js automatic code splitting
- **Image Optimization:** Next.js Image component
- **Lazy Loading:** Dynamic imports for heavy components
- **Memoization:** React.memo for expensive renders

### Performance-Optimized Components
- `KeyRequirementsList.tsx` - Virtualized list for large datasets

### Recommended Improvements
1. Implement virtual scrolling for large tables
2. Add skeleton loaders for better perceived performance
3. Optimize bundle size (dual UI libraries increase bundle)
4. Implement service worker for offline support

---

## Accessibility

### Current State
- Semantic HTML structure
- Ant Design built-in accessibility
- Material-UI ARIA attributes

### Improvements Needed
- Add ARIA labels to custom components
- Keyboard navigation testing
- Screen reader testing
- Color contrast validation

---

## Testing

### Test Files Found
- `components/features/__tests__/QuestionnaireProgressDisplay.test.tsx`

### Testing Stack (from package.json)
- Jest (inferred from backend, likely shared)
- React Testing Library (recommended for Next.js)

### Coverage Gaps
- Most components lack unit tests
- No E2E tests found
- No visual regression tests

---

## Component Design Patterns

### 1. Container/Presentational Pattern
Pages act as containers, components as presentational.

### 2. Compound Components
StepsTabNavigator uses compound component pattern.

### 3. Render Props
TaskProgressBar likely uses render props for flexibility.

### 4. Custom Hooks
useTaskProgress encapsulates WebSocket logic.

---

## Future Enhancements

1. **Component Library Consolidation**
   - Choose either Ant Design OR Material-UI
   - Reduces bundle size and maintains consistency

2. **Design System**
   - Create unified design tokens
   - Standardize spacing, colors, typography

3. **Storybook Integration**
   - Component documentation
   - Visual testing
   - Design review

4. **Accessibility Audit**
   - WCAG 2.1 AA compliance
   - Keyboard navigation
   - Screen reader support

5. **Performance Monitoring**
   - Add Web Vitals tracking
   - Bundle size monitoring
   - Render performance profiling
