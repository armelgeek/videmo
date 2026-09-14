"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
}

interface PermissionsMatrixProps {
  permissions: Permission[];
  selectedPermissionIds: string[];
  onPermissionToggle: (permissionId: string) => void;
  onSelectAll?: (resource: string) => void;
  disabled?: boolean;
}

export function PermissionsMatrix({
  permissions,
  selectedPermissionIds,
  onPermissionToggle,
  onSelectAll,
  disabled = false,
}: PermissionsMatrixProps) {
  // Group permissions by resource
  const resources = Array.from(new Set(permissions.map((p) => p.resource))).sort();

  // Get all unique actions across all permissions
  const actions = Array.from(new Set(permissions.map((p) => p.action))).sort();

  // Create a map for quick lookup
  const permissionMap = new Map<string, Permission>();
  permissions.forEach((p) => {
    permissionMap.set(`${p.resource}:${p.action}`, p);
  });

  const getPermissionForCell = (resource: string, action: string) => {
    return permissionMap.get(`${resource}:${action}`);
  };

  const isResourceComplete = (resource: string) => {
    const resourcePermissions = permissions.filter((p) => p.resource === resource);
    return resourcePermissions.every((p) => selectedPermissionIds.includes(p.id));
  };

  const toggleResource = (resource: string) => {
    const resourcePermissions = permissions.filter((p) => p.resource === resource);
    const allSelected = resourcePermissions.every((p) => selectedPermissionIds.includes(p.id));

    if (allSelected) {
      // Deselect all
      resourcePermissions.forEach((p) => {
        if (selectedPermissionIds.includes(p.id)) {
          onPermissionToggle(p.id);
        }
      });
    } else {
      // Select all
      resourcePermissions.forEach((p) => {
        if (!selectedPermissionIds.includes(p.id)) {
          onPermissionToggle(p.id);
        }
      });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Resource</th>
            {actions.map((action) => (
              <th key={action} className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                <span className="capitalize">{action}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource, resourceIndex) => (
            <tr
              key={resource}
              className={`border-b ${resourceIndex % 2 === 0 ? "bg-muted/30" : ""}`}
            >
              <td className="px-4 py-4 text-sm font-medium text-foreground">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isResourceComplete(resource)}
                    onCheckedChange={() => toggleResource(resource)}
                    disabled={disabled}
                    aria-label={`Select all ${resource} permissions`}
                  />
                  <span className="capitalize">{resource}</span>
                </div>
              </td>
              {actions.map((action) => {
                const permission = getPermissionForCell(resource, action);
                if (!permission) {
                  return (
                    <td key={`${resource}:${action}`} className="px-4 py-4 text-center">
                      <div className="h-6 w-6 mx-auto" />
                    </td>
                  );
                }
                return (
                  <td
                    key={permission.id}
                    className="px-4 py-4 text-center"
                    title={permission.description || permission.name}
                  >
                    <Checkbox
                      id={permission.id}
                      checked={selectedPermissionIds.includes(permission.id)}
                      onCheckedChange={() => onPermissionToggle(permission.id)}
                      disabled={disabled}
                      aria-label={`${permission.name}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
