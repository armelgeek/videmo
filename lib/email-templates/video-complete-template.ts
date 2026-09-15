import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getVideoCompleteTemplate = (data: {
  userName: string;
  videoTitle: string;
  videoUrl: string;
  duration: string;
}): string => {
  const content = `
    <h2>Your video is ready!</h2>
    <p>Hi ${data.userName},</p>
    <p>Your video <strong>"${data.videoTitle}"</strong> has been processed and is ready to view.</p>
    
    <div class="info-box">
      <strong>Processing Time:</strong> ${data.duration}<br>
      <p style="margin: 8px 0 0 0; font-size: 14px;">Your video is now available in your project dashboard.</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.videoUrl}" class="button">View Your Video →</a>
    </div>

    <p style="font-size: 14px; color: #666666;">
      Download, share, or make edits anytime from your dashboard.
    </p>

    <div class="info-box" style="background-color: #FFFACD;">
      <strong>Next Steps:</strong> Check out our tutorials to learn advanced editing tricks!
      <br><a href="${appConfig.url}/tutorials" style="color: #000000; text-decoration: underline; text-decoration-color: #FFFF33;">View Tutorials →</a>
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
