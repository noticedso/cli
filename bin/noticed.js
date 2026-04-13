#!/usr/bin/env node

// Thin wrapper that loads the compiled CLI entry point.
// This file is referenced from package.json "bin" field.

import("../dist/cli.js").catch((err) => {
  console.error("Failed to start noticed CLI:", err.message);
  process.exit(1);
});
