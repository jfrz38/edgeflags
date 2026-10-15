import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizePlan } from "../summarize-plan.mjs";

test("summarizes actions without exposing resource values", () => {
  const summary = summarizePlan({
    resource_changes: [
      { change: { actions: ["create"], after: { secret: "do-not-print" } } },
      { change: { actions: ["update"] } },
      { change: { actions: ["delete", "create"] } },
      { change: { actions: ["delete"] } },
      { change: { actions: ["no-op"] } },
    ],
  });

  assert.match(summary, /Create: 1/);
  assert.match(summary, /Update: 1/);
  assert.match(summary, /Replace: 1/);
  assert.match(summary, /Delete: 1/);
  assert.doesNotMatch(summary, /do-not-print/);
});
