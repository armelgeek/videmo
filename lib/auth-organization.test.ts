import { describe, expect, it } from "vitest";
import {
  chooseActiveOrganization,
  resolveActiveOrganization,
  type OrganizationMembership,
  type OrganizationRepository,
} from "./auth-organization";

const on = (day: number): Date => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00Z`);

describe("chooseActiveOrganization", () => {
  it("returns null when the user belongs to no organization", () => {
    expect(chooseActiveOrganization([])).toBeNull();
  });

  it("returns the only organization when there is just one", () => {
    const one: OrganizationMembership[] = [{ organizationId: "org-1", joinedAt: on(3) }];
    expect(chooseActiveOrganization(one)).toBe("org-1");
  });

  it("returns the most recently joined one when there are several", () => {
    const several: OrganizationMembership[] = [
      { organizationId: "org-oldest", joinedAt: on(1) },
      { organizationId: "org-newest", joinedAt: on(9) },
      { organizationId: "org-middle", joinedAt: on(5) },
    ];
    expect(chooseActiveOrganization(several)).toBe("org-newest");
  });

  it("does not modify the array it receives", () => {
    // The caller is a session hook: mutating its input would give a decision
    // function a side effect.
    const source: OrganizationMembership[] = [
      { organizationId: "org-a", joinedAt: on(1) },
      { organizationId: "org-b", joinedAt: on(2) },
    ];
    const copy = [...source];
    chooseActiveOrganization(source);
    expect(source).toEqual(copy);
  });

  it("breaks a tie between two memberships of the same date without throwing", () => {
    const tied: OrganizationMembership[] = [
      { organizationId: "org-a", joinedAt: on(4) },
      { organizationId: "org-b", joinedAt: on(4) },
    ];
    expect(["org-a", "org-b"]).toContain(chooseActiveOrganization(tied));
  });
});

describe("resolveActiveOrganization", () => {
  const fakeRepository = (memberships: OrganizationMembership[]) => {
    const writes: Array<[string, string]> = [];
    const created: string[] = [];
    const repository: OrganizationRepository = {
      listMemberships: async () => memberships,
      writeActiveOrganization: async (sessionId, organizationId) => {
        writes.push([sessionId, organizationId]);
      },
      ensurePersonalOrganization: async (userId) => {
        created.push(userId);
        return `personal-${userId}`;
      },
    };
    return { repository, writes, created };
  };

  it("returns the already active organization without reading or writing", async () => {
    let read = false;
    const repository: OrganizationRepository = {
      listMemberships: async () => {
        read = true;
        return [];
      },
      writeActiveOrganization: async () => {},
      ensurePersonalOrganization: async () => "unused",
    };

    const active = await resolveActiveOrganization(
      { id: "s1", userId: "u1", activeOrganizationId: "org-1" },
      repository,
    );

    expect(active).toBe("org-1");
    expect(read).toBe(false);
  });

  it("chooses and writes the organization when the session has none", async () => {
    const { repository, writes } = fakeRepository([
      { organizationId: "org-1", joinedAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    const active = await resolveActiveOrganization(
      { id: "s1", userId: "u1", activeOrganizationId: null },
      repository,
    );

    expect(active).toBe("org-1");
    expect(writes).toEqual([["s1", "org-1"]]);
  });

  it("creates a personal organization and activates it when the user has none", async () => {
    const { repository, writes, created } = fakeRepository([]);

    const active = await resolveActiveOrganization(
      { id: "s1", userId: "u1", activeOrganizationId: null },
      repository,
    );

    expect(active).toBe("personal-u1");
    expect(created).toEqual(["u1"]);
    expect(writes).toEqual([["s1", "personal-u1"]]);
  });

  it("does not create a personal organization when the user already has one", async () => {
    const { repository, created } = fakeRepository([{ organizationId: "org-1", joinedAt: on(1) }]);

    await resolveActiveOrganization({ id: "s1", userId: "u1", activeOrganizationId: null }, repository);

    expect(created).toEqual([]);
  });
});
