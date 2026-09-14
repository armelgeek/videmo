# Permissions & RBAC

Platform-wide access control for the admin area. Organization roles (owner/admin/member on video projects) are separate: see `lib/video-project/access.ts`.

## Files

- `rbac.ts` — pure rules: permission catalog, `resolveAccess`, `checkRoleAssignment`, `checkRoleUpdate` (tested in `rbac.test.ts`)
- `permissions.ts` — loads a user's role from the database: `getAccess`, `hasPermission`, `canAccessUser`
- `auth-helpers.ts` / `auth-utils.ts` — `requirePermission(resource, action)` guards for server actions and pages

## Rules

- A role only applies while the user has **Admin Access** (`User.isAdmin`).
- Permissions are `resource:action`, actions being `create`, `read`, `update`, `delete`.
- The system **Super Admin** role has every permission implicitly, including resources added later. It can't be renamed, deleted, or have permissions removed.
- Nobody can change their own role or admin access.
- Assigning a role or admin access needs `role:update`. Granting or removing Super Admin needs a Super Admin.

## Resources

`user`, `role`, `permission`, `setting`, `blog`, `organization` — add new ones to `PERMISSION_RESOURCES` in `rbac.ts`, then run:

```bash
npm run setup:permissions   # idempotent: creates missing permissions, keeps Super Admin complete
```

## Usage

```typescript
import { requirePermission } from '@/lib/auth-helpers'

export async function deleteBlog(id: string) {
  await requirePermission('blog', 'delete')
  // ...
}
```
