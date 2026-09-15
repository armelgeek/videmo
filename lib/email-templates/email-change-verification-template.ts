import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';
import type { EmailChangeVerificationData } from './types';

export const getEmailChangeVerificationTemplate = (data: EmailChangeVerificationData): string => {
  const { recipientName, verificationUrl, newEmail, expiryHours } = data;
  const companyName = appConfig.name;

  const content = `
    <h2>Verify Your New Email Address</h2>
    <p>Hello ${recipientName || 'there'},</p>
    <p>
      You requested to change your email address on ${companyName} to
      <strong>${newEmail}</strong>.
    </p>

    <p>Click the button below to confirm this change. The link expires in ${expiryHours || 24} hours:</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" class="button">Verify Email →</a>
    </div>

    <p style="font-size: 14px; color: #666666;">
      If the button doesn't work, copy and paste this link:
    </p>

    <div style="word-break: break-all; padding: 12px 16px; background-color: #F5F5F5; border: 1px solid #CCCCCC; border-radius: 4px; font-size: 13px; color: #000000;">
      ${verificationUrl}
    </div>

    <div class="info-box">
      <strong>Didn't request this?</strong> If you didn't ask to change your email, you can ignore this message. Your current email will stay the same.
    </div>
  `;

  return getBaseEmailTemplate(content);
};
