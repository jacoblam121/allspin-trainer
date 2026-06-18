import { describe, it, expect } from "vitest";
import {
  BOARD_WIDTH,
  FIELD_HEIGHT,
  VISIBLE_HEIGHT,
  VISIBLE_SPAWN_ROWS,
} from "./constants.ts";

describe("engine constants", () => {
  it("uses a standard 10-wide field", () => {
    expect(BOARD_WIDTH).toBe(10);
  });

  it("has a 10x40 internal field with 20 visible rows plus 3 spawn rows", () => {
    expect(VISIBLE_HEIGHT).toBe(20);
    expect(VISIBLE_SPAWN_ROWS).toBe(3);
    expect(FIELD_HEIGHT).toBe(40);
  });
});
