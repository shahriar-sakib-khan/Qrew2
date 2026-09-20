/**
 * Global test setup for API unit tests.
 * Runs before each test file via vitest setupFiles.
 */

// Suppress console.error noise from expected error paths
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
