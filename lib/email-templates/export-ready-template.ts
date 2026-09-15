import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getExportReadyTemplate = (data: {
  userName: string;
  videoTitle: string;
  format: string;
  downloadUrl: string;
  expiresIn: string;
}): string => {
  const content = `
    <h2>Your video export is ready!</h2>
    <p>Hi ${data.userName},</p>
    <p>Your export of <strong>"${data.videoTitle}"</strong> in ${data.format} format is ready to download.</p>
    
    <div class="info-box">
      <strong>Format:</strong> ${data.format}<br>
      <strong>Download link expires in:</strong> ${data.expiresIn}
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.downloadUrl}" class="button">Download Video →</a>
    </div>

    <p style="font-size: 14px; color: #666666;">
      <strong>Tip:</strong> Download your video now. The link expires in ${data.expiresIn}.
    </p>

    <div class="info-box" style="background-color: #FFFACD;">
      <strong>Share on Social Media:</strong> Use our <a href="${appConfig.url}/share" style="color: #000000; text-decoration: underline;">share tool</a> to post directly to Instagram, TikTok, YouTube, and more!
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
