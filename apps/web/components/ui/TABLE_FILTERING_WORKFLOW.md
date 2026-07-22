# Table Cell Filtering, Resizing & File Manager Navigation Workflow

This document specifies the standard workflow for cell-click filtering, resizable columns, and directory view modes across all tables and file dashboards.

---

## 1. Files Dashboard View Modes

1. **List Mode (`List`)**:
   - Flat data table listing all files with multi-column filtering and dynamic column resizing.

2. **Tree Mode (`Tree`)**:
   - Collapsible accordion tree view grouping files by Year -> Month with expandable nested rows.

3. **Folder Mode (`Folder` - Windows File Manager Navigation)**:
   - Interactive directory navigation matching native Windows File Explorer:
     - **Path Bar / Address Bar**: Displays path breadcrumbs (`📁 Files / 2026 / July`) with an "Up level" navigation button.
     - **Level 0 (Root)**: Displays folder icons for each **Year** (`📁 2026`).
     - **Level 1 (Year)**: Displays folder icons for each **Month** (`📁 July`).
     - **Level 2 (Month)**: Displays data table containing all files inside that selected month.
     - **Interaction**: Double-clicking folder cards on desktop (or single-clicking on mobile) opens the directory. Single-clicking selects the folder.

---

## 2. Dynamic Column Resizing & Layout Rules

1. **Fixed Layout & Zero Width Shifts**:
   - Column widths and cell layouts remain 100% fixed during hover and filter toggles.
   - Resizer handle is rendered as a clean vertical line (`w-1.5 cursor-col-resize`) on the right boundary of headers.
   - **Double-Click Reset**: Double-clicking the resizer line resets column width back to auto layout.
   - **Desktop/Mobile Responsiveness**: Drag resizing is enabled on desktop (`md:block`) and disabled on mobile (<768px).
   - **Database Persistence**: Column width adjustments are saved per user and per workspace in the backend database with optimistic `localStorage` fallback.

2. **Cell Hover & Click Behavior**:
   - Hovering over a cell applies a subtle background tint (`hover:bg-accent/30`).
   - **Clicking Cell Padding / Cell Background**: Toggles column filtering by that value.
   - **Clicking Interactive Text**: Opens the item's details modal.

3. **Theme Highlighting for Filtered Cell Values**:
   - Filtered cell values match the **theme color** (`text-primary font-medium`) with constant font metrics.
