# Project Statuses & Workflows Architecture

This module powers the dynamic workflow system, where projects transition through a directed acyclic graph (DAG) of custom stages.

## Data Model
- `project_statuses`: Represents a single stage/node in the workflow.
  - `isInitial`: The starting point of all projects. Always present, cannot be deleted.
  - `isSystem`: System-managed nodes (e.g., Completed). Cannot be deleted.
  - `gridColumn`, `gridRow`: Absolute layout coordinates for the frontend visual builder.
- `project_status_transitions`: Represents directed edges (connections) between two statuses.
  - Controls which stages are reachable from a given stage.
- `project_status_fields`: Maps custom fields to specific statuses with visibility and requirement constraints (`isRequiredToEnter`, `isVisibleInStage`).

## Core Mechanics
1. **Dynamic Terminal Nodes**: A node is considered a terminal (dead-end) node if it has exactly **0 outgoing transitions**. Terminal nodes are visually distinct in the UI (e.g., green checkmark or red cross for negative states).
2. **System Edges**: The edge connecting the `Initial` (Created) state directly to the `Completed` state is a permanent, non-deletable system edge to ensure a project can always be safely completed.
3. **Layout Engine**: Nodes are explicitly positioned using `gridColumn` and `gridRow`. 
   - Dragging a node to an empty cell updates its coordinates atomically via `PATCH /:id`.
   - Dragging a node over an occupied cell triggers an atomic swap `POST /:id/swap`.
   - Inserting a node between two existing connected nodes triggers an `insertBump`, which pushes downstream nodes +1 column to the right to make room.

## Security & Constraints
- Only users with `workflow:manage` permissions can mutate the status graph.
- The `PUT /:id/transitions` endpoint enforces strict validation: no self-loops, and targets must exist in the same organization.
