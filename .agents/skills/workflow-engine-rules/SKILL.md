---
name: workflow-engine-rules
description: Architectural guidelines for modifying the XYFlow (React Flow) visual workflow builder and graph execution engine.
---

# Workflow Engine & Graph Builder Rules

The application utilizes \`@xyflow/react\` (React Flow) for its visual workflow builder. Any modifications to the graph UI or backend execution must follow these rules to maintain state consistency and avoid breaking the drag-and-drop mechanics.

## 1. XYFlow State Management
- **Controlled State:** The graph state (Nodes and Edges) MUST be managed as controlled components using XYFlow's \`useNodesState\` and \`useEdgesState\` hooks (or standard Zustand equivalents). 
- **Immutability:** Never mutate node coordinates or properties directly via the DOM or standard React state mutations. Always use the \`setNodes\` and \`setEdges\` functions provided by XYFlow.

## 2. Database Serialization
- When saving the graph to the database, the node and edge arrays must be serialized directly to a \`JSONB\` column. 
- When loading from the database, the JSON payload must perfectly match the expected \`@xyflow/react\` \`Node[]\` and \`Edge[]\` types. Ensure defensive mapping if the schema versions change.

## 3. Custom Nodes
- Do not overload the standard XYFlow nodes with complex interactive logic.
- Complex interactive elements (e.g., forms inside nodes, status badges) MUST be implemented using Custom Node Types (\`nodeTypes\` prop in the \`<ReactFlow />\` component).
- Input/Output handles (\`<Handle />\`) inside custom nodes must have explicitly mapped IDs to ensure edge connections route properly.
