import { getBaseEmailTemplate } from './base-template';
import type { OTPEmailData } from './types';

export const getOTPEmailTemplate = (data: OTPEmailData): string => {
  const { recipientName, otp, expiryMinutes = 10 } = data;

  const content = `
    <h2>Your verification code</h2>
    <p>Hello ${recipientName ? recipientName : 'there'},</p>
    <p>Use this code to verify your account. It expires in ${expiryMinutes} minutes.</p>

    <div class="otp-code">${otp}</div>

    <p style="text-align: center; font-size: 14px; color: #666666;">
      Don't share this code with anyone.
    </p>

    <div class="info-box">
      <strong>Didn't request this?</strong> Ignore this email, or contact support if you're worried about your account.
    </div>
  `;

  return getBaseEmailTemplate(content);
};
