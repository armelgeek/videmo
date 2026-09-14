export const ORGANIZATION_CHANGED_EVENT = "organization-changed";

export function notifyOrganizationChanged() {
  window.dispatchEvent(new Event(ORGANIZATION_CHANGED_EVENT));
}
