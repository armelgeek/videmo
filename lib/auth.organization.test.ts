import { describe, expect, it } from "vitest";
import { auth } from "./auth";

describe("organization plugin configuration", () => {
  const plugin = auth.options.plugins?.find((p) => p.id === "organization");

  it("is wired in", () => {
    expect(plugin).toBeDefined();
  });

  it("points at the OrganizationMember table, which is not renamed", () => {
    const schema = (plugin as { options?: { schema?: Record<string, { modelName?: string }> } })
      .options?.schema;
    expect(schema?.member?.modelName).toBe("organizationMember");
    expect(schema?.invitation?.modelName).toBe("organizationInvitation");
  });

  it("reads joinedAt where the plugin expects createdAt", () => {
    const schema = (plugin as {
      options?: { schema?: { member?: { fields?: Record<string, string> } } };
    }).options?.schema;
    expect(schema?.member?.fields?.createdAt).toBe("joinedAt");
  });

  it("keeps the description field specific to this project", () => {
    const schema = (plugin as {
      options?: { schema?: { organization?: { additionalFields?: Record<string, unknown> } } };
    }).options?.schema;
    expect(schema?.organization?.additionalFields).toHaveProperty("description");
  });
});
