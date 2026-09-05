import { describe, expect, it } from "vitest";
import { type ProjectAction, canAct } from "./access";

const ACTIONS: ProjectAction[] = ["create", "read", "update", "delete"];

describe("canAct", () => {
  it("lets an owner do everything", () => {
    for (const action of ACTIONS) expect(canAct("owner", action)).toBe(true);
  });

  it("lets an admin do everything", () => {
    for (const action of ACTIONS) expect(canAct("admin", action)).toBe(true);
  });

  it("lets a member create, read and update", () => {
    expect(canAct("member", "create")).toBe(true);
    expect(canAct("member", "read")).toBe(true);
    expect(canAct("member", "update")).toBe(true);
  });

  it("refuses deletion to a member", () => {
    expect(canAct("member", "delete")).toBe(false);
  });

  it("refuses everything to an unknown role", () => {
    for (const action of ACTIONS) expect(canAct("guest", action)).toBe(false);
  });
});
