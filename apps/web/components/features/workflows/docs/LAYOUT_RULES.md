# Workflow Graph — Layout & Interaction Rules

This document is the canonical source of truth for how the workflow graph
positions nodes, routes edges, and enforces interaction constraints.
Do NOT modify the layout algorithm without re-reading this file first.

---

## Grid Model

The canvas is a logical grid:
- **Columns (X / Layer)** — horizontal depth from the root. Column 0 = the
  starting node. Each additional hop to the right is +1 column.
- **Rows (Y / Track)** — integer vertical slots. Track 0 is the "spine"
  (the main horizontal chain). Negative tracks are above; positive below.

Node pixel positions:
```
cx = PAD + NODE_R + layer * (NODE_D + LAYER_GAP)
cy = (track - minTrack) * STEP + verticalOffset + NODE_R
```

---

## Column (Layer) Assignment — Longest-Path Rule

**Rule: a node's column = the LONGEST path distance from any root to that node,
counting only forward (non-back) edges.**

Why longest-path and NOT shortest-path?
- Shortest-path BFS: adding a shortcut edge A→C pulls C to an earlier column.
- Longest-path: C's column = max(all parents)+1. A shortcut from an earlier
  node can never decrease C's column. **Node columns are therefore stable when
  connections are added or removed between existing nodes.**

Algorithm (two-pass):
1. Tentative shortest-path BFS to classify "forward" vs "back" edges.
   - forward edge:  tentLayer[to] > tentLayer[from]
   - back edge:     tentLayer[to] <= tentLayer[from]  (cycle edge)
2. Kahn's topological sort on forward-only DAG.
3. Longest-path: layer[nxt] = max(layer[nxt], layer[cur]+1) as we traverse.

---

## Row (Track) Assignment — Bounding-Box Algorithm

**Rule: a node's row = determined at creation time by the subtree bounding-box
algorithm. Adding/removing connections NEVER changes row assignments.**

Children of a node WANT offsets: 0, +1, −1, +2, −2, +3, −3, …
(child 0 = same row as parent; subsequent children alternate below/above.)

Two-pass layout:
- **Pass 1 (bottom-up)**: Every node computes its subtree [min, max] track
  footprint recursively.  Leaf = [0, 0].
- **Pass 2 (top-down)**: Starting from Track 0 for the root, assign each
  child its track by nudging it just enough so its footprint does not
  overlap siblings already placed.

Sentinel initialization (critical):
  maxPositive = parentTrack − 1   // "nothing placed yet"
  minNegative = parentTrack + 1   // "nothing placed yet"
This ensures child 0 at desired offset 0 stays on the parent's track
instead of being pushed off by 1.

---

## Position Stability Rules

| Event | Column changes? | Row changes? |
|-------|----------------|-------------|
| Add new node (branch / insert-between) | YES — new node gets its column from parent+1 | YES — bounding-box recalculated |
| Delete a node | Adjacent nodes splice: parents re-wire to grandchildren | YES — bounding-box recalculated |
| Add a connection (edge) | **NO** | **NO** |
| Delete a connection (edge) | **NO** | **NO** |

---

## Edge/Arrow Routing — 3 Cases

| Case | Condition | Routing |
|------|-----------|---------|
| Forward | source.layer < target.layer | Straight diagonal line (or S-curve bezier) from right-edge to left-edge |
| Backward / cycle | source.layer >= target.layer | Arc on the LEFT side of the canvas; each back-edge uses a separate rail |
| Same-column | source.layer === target.layer, different row | U-bend on the RIGHT side of the column; stacked rails |

---

## Connection Constraints (Hard Rules)

| Rule | Enforcement |
|------|-------------|
| Nothing connects **TO** the initial (Created) node | Blocked in UI + backend |
| Nothing connects **FROM** the terminal (Completed) node | Blocked in UI + backend |
| No direct self-loop (A → A) | Blocked in UI + backend; also guarded during node deletion |
| Cycles (A → B → C → A) ARE allowed | Only direct A→A is banned |

---

## Child Ordering for New Branches

When a node N spawns children, they are ordered by `createdAt` (oldest first).
The oldest child occupies offset 0 (same track as parent); subsequent children
alternate: +1 below, −1 above, +2 below, −2 above, etc.

---

## Insert-Between Splice (edge split)

Clicking "+" on edge A→C:
1. Create node B with transition B→C.
2. Patch A: remove transition to C, add transition to B.
Result: A→B→C. The old A→C edge is surgically replaced.

## Delete-Node Splice (edge merge)

Deleting node B when A→B→C, A→B→D exist:
1. Server finds all parents of B (inbound edges).
2. Server finds all children of B (outbound edges: C, D).
3. For each parent: remove edge to B, add edges to all of B's children.
4. DELETE B (CASCADE removes B's own transitions).
Result: A→C, A→D. Self-loop guard: if a parent is also a child, that edge is dropped.
