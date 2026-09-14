import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps a same-origin path with its query", () => {
    expect(safeRedirectPath("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "invite/abc", ""])(
    "rejects %s",
    (value) => {
      expect(safeRedirectPath(value)).toBeNull();
    },
  );

  it("rejects non-strings", () => {
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(["/a"])).toBeNull();
  });
});
