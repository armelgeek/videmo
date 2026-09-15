import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';
import type { ResetPasswordEmailData } from './types';

export const getResetPasswordTemplate = (data: ResetPasswordEmailData): string => {
  const { recipientName, resetUrl, expiryHours = 1 } = data;
  const companyName = appConfig.name;

  const content = `
    <h2>Reset Your Password</h2>
    <p>Hello ${recipientName ? recipientName : 'there'},</p>
    <p>We received a request to reset your password for your ${companyName} account.</p>

    <p>Click the button below to create a new password. This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}:</p>

    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password →</a>
    </div>

    <p style="font-size: 14px; color: #666666;">
      If the button doesn't work, copy and paste this link in your browser:
    </p>

    <div style="word-break: break-all; padding: 12px 16px; background-color: #F5F5F5; border: 1px solid #CCCCCC; border-radius: 4px; font-size: 13px; color: #000000;">
      ${resetUrl}
    </div>

    <div class="info-box">
      <strong>Didn't request this?</strong> If you didn't ask for a password reset, ignore this email or contact support if you think your account is at risk.
    </div>
  `;

  return getBaseEmailTemplate(content);
};
