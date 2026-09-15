import { getBaseEmailTemplate } from './base-template';

export const getOtpTemplate = (data: {
  otp: string;
  expiryMinutes?: number;
}): string => {
  const content = `
    <h2>Your verification code</h2>
    
    <p>Use this code to verify your email address. It expires in ${data.expiryMinutes || 10} minutes.</p>
    
    <div class="otp-code">${data.otp}</div>
    
    <p style="text-align: center; font-size: 14px; color: #666666;">
      Don't share this code with anyone.
    </p>
    
    <div class="info-box">
      <strong>Tip:</strong> If you didn't request this code, someone might be trying to access your account. Contact support if this wasn't you.
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
