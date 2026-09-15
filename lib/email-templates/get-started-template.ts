import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getGetStartedTemplate = (data: {
  userName: string;
}): string => {
  const content = `
    <h2>Welcome to ${appConfig.name}!</h2>
    <p>Hi ${data.userName},</p>
    <p>Your account is all set. Let's get you creating amazing videos in minutes.</p>
    
    <div class="info-box">
      <strong>Here's your 3-step quick start:</strong>
    </div>

    <ol style="line-height: 2; color: #000000;">
      <li><strong><a href="${appConfig.url}/templates" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">Choose a template</a></strong> — Pick from 50+ professional designs</li>
      <li><strong>Customize your video</strong> — Add your content, music, and branding</li>
      <li><strong>Export & share</strong> — Download or post directly to social media</li>
    </ol>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${appConfig.url}/dashboard" class="button">Start Creating →</a>
    </div>

    <h3 style="color: #000000; margin-top: 24px;">Popular Templates</h3>
    <ul style="line-height: 2; color: #000000;">
      <li><a href="${appConfig.url}/templates/promo" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">Product Promo</a> — Perfect for marketing</li>
      <li><a href="${appConfig.url}/templates/tutorial" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">Tutorial</a> — Great for how-tos</li>
      <li><a href="${appConfig.url}/templates/announcement" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">Announcement</a> — Share big news</li>
    </ul>

    <div class="info-box" style="background-color: #FFFACD;">
      <strong>Pro Tip:</strong> Check out our <a href="${appConfig.url}/tutorials" style="color: #000000; text-decoration: underline;">tutorial series</a> to unlock all features. Takes just 10 minutes!
    </div>

    <p style="margin-top: 24px; font-size: 14px; color: #666666;">
      Questions? Hit reply or visit our <a href="${appConfig.url}/help" style="color: #000000; text-decoration: underline;">help center</a>.
    </p>
  `;
  
  return getBaseEmailTemplate(content);
};
