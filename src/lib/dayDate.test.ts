import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dayLabel, isValidDay, isValidMonth, monthCells, monthLabel, shiftMonth, todayDay, weekEnding } from "@/lib/dayDate";

test("validates days and months", () => {
  assert.ok(isValidDay("2026-11-05"));
  assert.ok(!isValidDay("2026-13-01"));
  assert.ok(!isValidDay("2026-02-30"));
  assert.ok(!isValidDay("2026-11-5"));
  assert.ok(isValidMonth("2026-11"));
  assert.ok(!isValidMonth("2026-13"));
});

test("adds days across month and year boundaries in UTC", () => {
  assert.equal(addDays("2026-11-05", 1), "2026-11-06");
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(todayDay(new Date("2026-11-05T23:30:00Z")), "2026-11-05");
});

test("week window ends on the given day", () => {
  assert.deepEqual(weekEnding("2026-11-05"), { from: "2026-10-30", to: "2026-11-05" });
});

test("month grid is 42 cells starting on a Sunday and marks the month", () => {
  const cells = monthCells("2026-11");
  assert.equal(cells.length, 42);
  assert.equal(cells[0].weekday, 0);
  assert.ok(cells.some((c) => c.day === "2026-11-01" && c.inMonth));
  assert.ok(cells.some((c) => !c.inMonth));
  assert.equal(shiftMonth("2026-11", 2), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("labels are fixed-format", () => {
  assert.equal(monthLabel("2026-11"), "November 2026");
  assert.equal(dayLabel("2026-11-05"), "Thursday, 5 November 2026");
});
