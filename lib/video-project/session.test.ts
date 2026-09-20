import { describe, expect, it } from "vitest";
import {
  ProjectForbiddenError,
  ProjectLockedError,
  ProjectNotFoundError,
  EphemeralUrlRejectedError,
} from "./errors";
import { ProjectUnauthorizedError, toErrorResponse } from "./session";

describe("toErrorResponse", () => {
  it("maps a missing session to 401", () => {
    expect(toErrorResponse(new ProjectUnauthorizedError()).status).toBe(401);
  });

  it("maps a missing project to 404", () => {
    expect(toErrorResponse(new ProjectNotFoundError()).status).toBe(404);
  });

  it("maps a role refusal to 403", () => {
    expect(toErrorResponse(new ProjectForbiddenError()).status).toBe(403);
  });

  it("maps a lock held by another to 409", () => {
    const error = new ProjectLockedError("u2", "Ada", new Date());
    expect(toErrorResponse(error).status).toBe(409);
  });

  it("names who holds the lock, falling back to the id", async () => {
    // The call sites used to pass the expiry where the name goes, so the
    // member locked out was told a date was editing their project.
    const named = await toErrorResponse(
      new ProjectLockedError("u2", "Ada", null),
    ).json();
    expect(named.lockedBy).toBe("Ada");

    const anonymous = await toErrorResponse(
      new ProjectLockedError("u2", null, null),
    ).json();
    expect(anonymous.lockedBy).toBe("u2");
  });

  it("maps a rejected data: or blob: url to 400", () => {
    expect(toErrorResponse(new EphemeralUrlRejectedError("panels.0.imageUrl")).status).toBe(
      400,
    );
  });

  it("maps anything else to 500", () => {
    expect(toErrorResponse(new Error("boom")).status).toBe(500);
  });
});
