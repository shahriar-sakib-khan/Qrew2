---
name: semantic-theming
description: Guidelines for Layer 1 Tailwind gating, semantic CSS variables, and Dark Mode compatibility.
---

# Semantic Theming & Tailwind Rules

Our UI uses Tailwind v4 \`@theme inline\` with CSS variables to ensure perfect Dark Mode support and strict brand consistency.

## 1. Layer 1 Theme Restrictions
- We have completely wiped out the default primitive color palette in Tailwind v4 by using \`--color-*: initial;\` inside \`apps/web/app/globals.css\`.
- **What this means:** You CANNOT use default colors like \`bg-emerald-500\`, \`text-zinc-400\`, \`text-red-500\`, etc. They will not compile or render.

## 2. Mandatory Semantic Tokens
All colors must use semantic tokens mapped to our CSS variables.
- **Brand/Primary Actions:** Use \`primary\` (e.g., \`text-primary\`, \`bg-primary\`, \`border-primary\`).
- **Destructive/Errors:** Use \`destructive\`.
- **Backgrounds:** Use \`background\` (app root), \`card\` (elevated panels), \`popover\` (dropdowns), \`muted\` (subtle structural fills).
- **Text:** Use \`foreground\` (main text) or \`muted-foreground\` (secondary text).
- **Borders/Inputs:** Use \`border\`, \`input\`, and \`ring\`.

## 3. Dark Mode Fallbacks
Do NOT use \`dark:\` prefix modifiers to swap primitive colors (e.g., \`bg-white dark:bg-black\`). 
Instead, use a single semantic token (e.g., \`bg-background\`), as the CSS variables automatically handle the color inversion at the \`:root\` and \`.dark\` block levels in \`globals.css\`.
