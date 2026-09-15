import { appConfig } from '@/lib/config';
import { getBaseEmailTemplate } from './base-template';
import type { MonthlyDigestEmailData } from '@/types/email';

export const getMonthlyDigestTemplate = (data: MonthlyDigestEmailData): string => {
  const { recipientName, monthLabel, projectsCreated, creditsUsed, unsubscribeUrl } = data;

  const content = `
    <h2>Your ${monthLabel} summary</h2>
    <p>Hi ${recipientName || 'there'}, here is what you did last month.</p>

    <div class="info-box">
      <div class="info-row"><span class="info-label">Projects created</span><span class="info-value">${projectsCreated}</span></div>
      <div class="info-row"><span class="info-label">Credits used</span><span class="info-value">${creditsUsed}</span></div>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${appConfig.url}/workspace" class="button">Open your projects →</a>
    </div>
  `;

  return getBaseEmailTemplate(content, { unsubscribeUrl });
};
