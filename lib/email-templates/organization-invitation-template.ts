import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';
import type { OrganizationInvitationEmailData } from './types';

// Organization and inviter names are user input rendered into HTML.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const getOrganizationInvitationTemplate = (data: OrganizationInvitationEmailData): string => {
  const organizationName = escapeHtml(data.organizationName);
  const inviterName = escapeHtml(data.inviterName);
  const role = escapeHtml(data.role);
  const acceptUrl = encodeURI(data.acceptUrl);

  const content = `
    <h2>Join ${organizationName} on ${appConfig.name}</h2>
    <p><strong>${inviterName}</strong> invited you to work on video projects in <strong>${organizationName}</strong> as <strong>${role}</strong>.</p>

    <a href="${acceptUrl}" class="button">Review invitation</a>

    <p style="font-size: 14px; color: #495057;">
      The link expires in ${data.expiryHours} hours. Sign in or create an account with
      <strong>${escapeHtml(data.recipientEmail)}</strong> to accept it.
    </p>

    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;" />
    <p style="font-size: 12px; color: #868e96; text-align: center;">
      Not expecting this? You can ignore this email; nothing happens until you accept.
    </p>
  `;

  return getBaseEmailTemplate(content);
};
