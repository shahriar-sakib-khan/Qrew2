# Workflow Visual Builder Architecture

This module powers the frontend visual builder for project workflows, allowing admins to dynamically build and configure custom project stages, branching logic, and required fields.

## Graph Rendering (`workflow-graph.tsx`)
- **Coordinate System**: The canvas is an infinite grid mapped to data via `gridColumn` and `gridRow`. 
  - `y0` handles the row offset since rows can be negative or positive.
  - Nodes are explicitly placed at `(col, row)` ensuring a stable, persistent layout without the unpredictable jumping of auto-layout algorithms (like Dagre or layout engines).
- **Drag & Drop**: Nodes are completely draggable. 
  - If dropped onto an occupied cell, an atomic swap is sent to the backend.
  - Connections (edges) are pure SVG `path` elements drawn via bezier curves.
- **Visual Cues**: 
  - **Start Nodes**: Distinct indigo theme with a flag.
  - **System/Completed**: Distinct violet theme with a shield.
  - **Dynamic Terminal Nodes**: Computed on-the-fly (`!s.isInitial && transitions.length === 0`). These render as green checkmarks (or red crosses if the name implies failure/rejection like "cancel" or "reject"). Terminal nodes do not have the "+" branch button.

## Node Management (`workflow-node-modal.tsx`)
- Configures the node's name, color, and outgoing transitions.
- **Field Mappings**: Defines which global custom fields are required to enter this stage, or merely visible.
- **Insert Between**: When a user clicks the "+" on an edge, the modal is configured to insert a new node. It sends `insertBump: true` to the backend to safely shift all downstream nodes rightwards to prevent overlaps.

## View Logic (`workflow-builder.tsx`)
- Acts as the main orchestrator, fetching data via `useQuery` from `/api/workspaces/projects/statuses`.
- Dispatches mutations for node creation, edge deletion, coordinate updates, and swaps.
