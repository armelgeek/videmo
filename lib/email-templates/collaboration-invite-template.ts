import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getCollaborationInviteTemplate = (data: {
  invitedEmail: string;
  inviterName: string;
  projectTitle: string;
  projectUrl: string;
  role: string;
}): string => {
  const content = `
    <h2>You're invited to collaborate!</h2>
    <p>Hi there,</p>
    <p><strong>${data.inviterName}</strong> invited you to collaborate on <strong>"${data.projectTitle}"</strong> as a <strong>${data.role}</strong>.</p>
    
    <div class="info-box">
      <strong>Project:</strong> ${data.projectTitle}<br>
      <strong>Role:</strong> ${data.role}<br>
      <strong>Invited by:</strong> ${data.inviterName}
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.projectUrl}" class="button">Join Project →</a>
    </div>

    <p style="font-size: 14px; color: #666666;">
      You'll need a ${appConfig.name} account to collaborate. 
      <a href="${appConfig.url}/signup" style="color: #000000; text-decoration: underline;">Sign up free</a> if you don't have one yet.
    </p>

    <div class="info-box" style="background-color: #FFFACD;">
      <strong>What you can do:</strong><br>
      Edit videos • Add comments • Manage assets • ${data.role === 'Editor' ? 'Export videos' : 'View-only'}
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
