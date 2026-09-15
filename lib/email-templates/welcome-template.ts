import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';
import type { WelcomeEmailData } from './types';

export const getWelcomeEmailTemplate = (data: WelcomeEmailData): string => {
  const { userName } = data;
  const companyName = appConfig.name;
  const appUrl = appConfig.url;

  const content = `
    <h2>Welcome to ${companyName}!</h2>
    <p>Hi ${userName}, we're excited to have you on board! Your email has been verified and your account is ready to use.</p>

    <div class="info-box">
      <strong>Your Account is Ready</strong><br>
      <p style="margin: 8px 0 0 0; font-size: 14px;">Start exploring everything ${companyName} has to offer.</p>
    </div>

    <h3 style="color: #000000; margin-top: 24px;">What's Next?</h3>
    <ul style="line-height: 2; color: #000000;">
      <li><strong><a href="${appUrl}/profile" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">Complete your profile</a></strong> — Add your details and preferences</li>
      <li><strong><a href="${appUrl}/dashboard" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">View your dashboard</a></strong> — See everything at a glance</li>
    </ul>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${appUrl}/dashboard" class="button">Go to Dashboard →</a>
    </div>

    <h3 style="color: #000000;">Questions?</h3>
    <p>
      Visit our <a href="${appUrl}/contact" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">contact page</a> or email us at
      <a href="mailto:${appConfig.supportEmail}" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">${appConfig.supportEmail}</a>.
    </p>
  `;

  return getBaseEmailTemplate(content);
};
