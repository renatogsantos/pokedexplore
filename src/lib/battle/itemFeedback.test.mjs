import test from "node:test";
import assert from "node:assert/strict";
import { createItemFeedbackScheduler, getItemActivationEvents, DISPLAY_DURATION } from "./itemFeedback.js";

import { getItemDefinition } from "../items/catalog.js";

function harness() {
  let now = 0, id = 0, feedback = null;
  const timers = new Map(), callbacks = [];
  const scheduler = createItemFeedbackScheduler(value => { feedback = value; }, {
    setTimer(fn, delay) { callbacks.push(fn); timers.set(++id, { fn, at: now + delay }); return id; },
    clearTimer(key) { timers.delete(key); },
  });
  return { scheduler, callbacks, timers, get feedback() { return feedback; }, advance(ms) {
    const end = now + ms;
    while (true) {
      const entry = [...timers.entries()].sort((a,b) => a[1].at-b[1].at)[0];
      if (!entry || entry[1].at > end) break;
      now = entry[1].at; timers.delete(entry[0]); entry[1].fn();
    }
    now = end;
  }};
}
const event = (eventId, itemId = "perola-abissal") => ({ eventId, itemId, pokemonId: 8, effect: { type: "damage_multiplier", multiplier: 1.2 } });

test("relic feedback expires without another action and never mutates gameplay", () => {
  const h = harness();
  const state = { effect: { itemEvents: [event("A")] }, pokemon: { id: 8, elementalRelic: "perola-abissal", temporaryEffects: { barrier: true } } };
  const before = structuredClone(state);
  h.scheduler.enqueue(getItemActivationEvents(state.effect, state.pokemon), 1);
  assert.equal(h.feedback.phase, "visible");
  h.advance(1279); assert.equal(h.feedback.phase, "visible");
  h.advance(1); assert.equal(h.feedback.phase, "exiting");
  h.advance(219); assert.ok(h.feedback);
  h.advance(1); assert.equal(h.feedback, null);
  assert.equal(DISPLAY_DURATION, 1500);
  assert.deepEqual(state, before);
  h.scheduler.enqueue(getItemActivationEvents(state.effect, state.pokemon), 1);
  assert.equal(h.feedback, null);
});
test("queue serializes new feedback and stale callbacks cannot remove the next card", () => {
  const h = harness(); h.scheduler.enqueue([event("A")], 1);
  h.advance(1000); h.scheduler.enqueue([event("B")], 2);
  h.advance(500); assert.equal(h.feedback.event.eventId, "B");
  h.callbacks[0](); assert.equal(h.feedback.event.eventId, "B");
  h.advance(1499); assert.ok(h.feedback); h.advance(1); assert.equal(h.feedback, null);
});
for (const reason of ["switch", "faint", "battle end", "unmount", "route navigation", "rematch"]) {
  test(`${reason} cancels active and queued timers`, () => {
    const h = harness(); h.scheduler.enqueue([event("A"), event("B")], 1);
    if (["unmount", "route navigation", "rematch"].includes(reason)) h.scheduler.dispose();
    else { h.scheduler.clear(); assert.equal(h.feedback, null); }
    assert.equal(h.timers.size, 0);
    const before = h.feedback; h.callbacks[0](); h.advance(3000); assert.equal(h.feedback, before);
  });
}
test("bag, strategic, relic, delayed and survival events use the same CPU/PvP lifecycle", () => {
  for (const itemId of ["vital-potion", "fruit-vital", "perola-abissal", "bomba-temporal", "phoenix-heart", "instant-barrier"]) {
    assert.ok(getItemDefinition(itemId));
    const h = harness();
    const effect = { kind: "item", itemId, eventId: "bag", targetPokemonId: 8, healing: 148 };
    const events = getItemActivationEvents(effect, { id: 8 });
    h.scheduler.enqueue(events, 1); assert.ok(h.feedback);
    h.scheduler.enqueue(structuredClone(events), 1);
    h.advance(1500); assert.equal(h.feedback, null); assert.equal(h.timers.size, 0);
    assert.deepEqual(getItemActivationEvents(effect, { id: 9 }), []);
    h.scheduler.enqueue([event("held", itemId)], 2); assert.ok(h.feedback);
    h.advance(1500); assert.equal(h.feedback, null);
  }
});
