import { describe, expect, it } from "vitest";
import {
  ProjectForbiddenError,
  ProjectLockedError,
  ProjectNotFoundError,
  DataUrlRejectedError,
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
    const error = new ProjectLockedError("u2", new Date());
    expect(toErrorResponse(error).status).toBe(409);
  });

  it("maps a rejected data url to 400", () => {
    expect(toErrorResponse(new DataUrlRejectedError("panels.0.imageUrl")).status).toBe(
      400,
    );
  });

  it("maps anything else to 500", () => {
    expect(toErrorResponse(new Error("boom")).status).toBe(500);
  });
});
