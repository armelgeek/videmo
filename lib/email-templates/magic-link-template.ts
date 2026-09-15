import { getBaseEmailTemplate } from './base-template';

export const getMagicLinkTemplate = (data: {
  recipientEmail: string;
  magicLink: string;
  expiryMinutes: number;
}): string => {
  const content = `
    <h2>Your sign-in link</h2>
    
    <p>Click the button below to sign in to your account. This link expires in ${data.expiryMinutes} minutes.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.magicLink}" class="button">Sign In →</a>
    </div>
    
    <p style="font-size: 14px; color: #666666;">
      Or copy and paste this link in your browser:
    </p>
    
    <div style="word-break: break-all; padding: 12px 16px; background-color: #F5F5F5; border: 1px solid #CCCCCC; border-radius: 4px; font-size: 13px; color: #000000;">
      ${data.magicLink}
    </div>
    
    <div class="info-box">
      <strong>Security tip:</strong> If you didn't request this link, you can safely ignore this email. The link will expire automatically.
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
