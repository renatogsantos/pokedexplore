import assert from "node:assert/strict";
import test from "node:test";
import { completeSelection, createSelectionTiming, getSelectionTimerState } from "./selectionTimer.js";

test("selection timing uses one shared pair of deadlines", () => {
  const timing = createSelectionTiming(1_000, { selectionSeconds: 60, urgencySeconds: 15 });
  assert.deepEqual(getSelectionTimerState(timing, 12_000), { phase: "selection", remainingSeconds: 49 });
  assert.deepEqual(getSelectionTimerState(timing, 61_000), { phase: "urgency", remainingSeconds: 15 });
  assert.deepEqual(getSelectionTimerState(timing, 76_000), { phase: "expired", remainingSeconds: 0 });
});

test("automatic selection preserves valid choices and fills deterministically", () => {
  const collection = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(completeSelection(collection, [{ id: "c" }, { id: "a" }]).map((item) => item.id), ["c", "a", "b"]);
  assert.deepEqual(completeSelection(collection, []).map((item) => item.id), ["a", "b", "c"]);
});
