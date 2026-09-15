import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getTutorialSequenceTemplate = (data: {
  userName: string;
  tutorialNumber: number;
  tutorialTitle: string;
  tutorialDescription: string;
  tutorialUrl: string;
  nextTutorialTitle?: string;
  totalTutorials: number;
}): string => {
  const progress = Math.round((data.tutorialNumber / data.totalTutorials) * 100);
  
  const content = `
    <h2>Tutorial ${data.tutorialNumber} of ${data.totalTutorials}: ${data.tutorialTitle}</h2>
    <p>Hi ${data.userName},</p>
    <p>${data.tutorialDescription}</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.tutorialUrl}" class="button">Start Tutorial →</a>
    </div>

    <div class="info-box">
      <strong>Your Progress:</strong><br>
      <div style="background-color: #EFEFEF; border-radius: 4px; height: 8px; margin: 8px 0; overflow: hidden;">
        <div style="background-color: #FFFF33; height: 100%; width: ${progress}%;"></div>
      </div>
      <p style="margin: 8px 0 0 0; font-size: 13px;">${progress}% complete</p>
    </div>

    ${data.nextTutorialTitle ? `
    <p style="font-size: 14px; color: #666666;">
      <strong>Next:</strong> Tutorial ${data.tutorialNumber + 1} — ${data.nextTutorialTitle}<br>
      <em>(You'll get this in your inbox tomorrow)</em>
    </p>
    ` : `
    <div class="info-box" style="background-color: #FFFACD;">
      <strong>🎉 You've completed the series!</strong> You're now a ${appConfig.name} pro. 
      <a href="${appConfig.url}/templates" style="color: #000000; text-decoration: underline;">Start creating masterpieces</a>!
    </div>
    `}

    <h3 style="color: #000000; margin-top: 24px;">Quick Recap</h3>
    <ul style="line-height: 2; color: #000000; font-size: 14px;">
      <li>💡 Tip: Save your projects regularly</li>
      <li>📱 You can edit on desktop or mobile</li>
      <li>🚀 All templates are fully customizable</li>
    </ul>

    <p style="margin-top: 24px; font-size: 13px; color: #666666; text-align: center;">
      Having trouble? <a href="mailto:${appConfig.supportEmail}" style="color: #000000; text-decoration: underline;">Contact support</a> • 
      <a href="${appConfig.url}/tutorials" style="color: #000000; text-decoration: underline;">View all tutorials</a>
    </p>
  `;
  
  return getBaseEmailTemplate(content);
};
