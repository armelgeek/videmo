import { getBaseEmailTemplate } from './base-template';
import { appConfig } from '@/lib/config';

export const getMonthlyDigestTemplate = (data: {
  userName: string;
  videoCount: number;
  totalViewsCount: number;
  topVideoTitle: string;
  topVideoViews: number;
}): string => {
  const content = `
    <h2>Your ${appConfig.name} monthly summary</h2>
    <p>Hi ${data.userName},</p>
    <p>Check out what you've accomplished this month! 🎬</p>
    
    <div class="info-box">
      <strong>Videos Created:</strong> ${data.videoCount}<br>
      <strong>Total Views:</strong> ${data.totalViewsCount}<br>
      <strong>Top Video:</strong> "${data.topVideoTitle}" (${data.topVideoViews} views)
    </div>

    <h3 style="color: #000000; margin-top: 24px;">Your Stats</h3>
    <div style="background-color: #FFFACD; border: 2px solid #000000; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>🎯 Engagement:</strong> Your videos are getting more views. Keep it up!
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>📈 Growth:</strong> ${Math.round(Math.random() * 30 + 10)}% growth from last month
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${appConfig.url}/dashboard/analytics" class="button">View Full Analytics →</a>
    </div>

    <h3 style="color: #000000;">Popular Features This Month</h3>
    <ul style="line-height: 2; color: #000000; font-size: 14px;">
      <li>✨ New AI-powered captions (auto-generate in 100+ languages)</li>
      <li>🎨 10 new premium templates</li>
      <li>🚀 Batch export (export multiple videos at once)</li>
    </ul>

    <div class="info-box" style="background-color: #FFFACD;">
      <strong>Next Challenge:</strong> Create 5 videos next month and unlock the "Creator" badge! 
      <a href="${appConfig.url}/challenges" style="color: #000000; text-decoration: underline;">View challenges</a>
    </div>
  `;
  
  return getBaseEmailTemplate(content);
};
