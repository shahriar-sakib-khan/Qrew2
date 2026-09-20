import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createUISlice, type UISlice } from "./slices/ui-slice";
import { createWorkspaceSlice, type WorkspaceSlice } from "./slices/workspace-slice";

// Combine all slice interfaces into a single AppState type
export type AppState = UISlice & WorkspaceSlice;

// Create the global store with DevTools middleware enabled
export const useAppStore = create<AppState>()(
  devtools(
    (...a) => ({
      ...createUISlice(...a),
      ...createWorkspaceSlice(...a),
    }),
    {
      name: "Qrew-App-Store",
      // Only enable devtools in development to prevent memory overhead in production
      enabled: process.env.NODE_ENV === "development"
    }
  )
);
