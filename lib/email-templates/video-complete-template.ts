import { getBaseEmailTemplate } from './base-template';
import type { VideoReadyEmailData } from '@/types/email';

export const getVideoReadyTemplate = (data: VideoReadyEmailData): string => {
  const { recipientName, videoTitle, downloadUrl, expiryHours } = data;

  const content = `
    <h2>Your video is ready</h2>
    <p>Hi ${recipientName || 'there'},</p>
    <p>The export of <strong>${videoTitle}</strong> has finished rendering.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${downloadUrl}" class="button">Download video →</a>
    </div>

    <div class="info-box">
      <strong>Available for ${expiryHours} hours.</strong> After that the file is removed and you can export the project again.
    </div>
  `;

  return getBaseEmailTemplate(content);
};
