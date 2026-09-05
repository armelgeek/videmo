import { describe, expect, it } from "vitest";
import { auth } from "./auth";

describe("configuration du plugin organization", () => {
  const plugin = auth.options.plugins?.find((p) => p.id === "organization");

  it("est branche", () => {
    expect(plugin).toBeDefined();
  });

  it("pointe sur la table OrganizationMember, qui n'est pas renommee", () => {
    const schema = (plugin as { options?: { schema?: Record<string, { modelName?: string }> } })
      .options?.schema;
    expect(schema?.member?.modelName).toBe("organizationMember");
    expect(schema?.invitation?.modelName).toBe("organizationInvitation");
  });

  it("lit joinedAt la ou le plugin attend createdAt", () => {
    const schema = (plugin as {
      options?: { schema?: { member?: { fields?: Record<string, string> } } };
    }).options?.schema;
    expect(schema?.member?.fields?.createdAt).toBe("joinedAt");
  });

  it("conserve le champ description propre a ce projet", () => {
    const schema = (plugin as {
      options?: { schema?: { organization?: { additionalFields?: Record<string, unknown> } } };
    }).options?.schema;
    expect(schema?.organization?.additionalFields).toHaveProperty("description");
  });
});
