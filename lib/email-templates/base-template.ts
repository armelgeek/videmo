import { appConfig } from '@/lib/config';

export const getBaseEmailTemplate = (
  content: string,
  options: { unsubscribeUrl?: string } = {},
): string => {
  const companyName = appConfig.name;
  const appDescription = appConfig.description;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${companyName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Gochi+Hand&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background-color: #F8F8F8;
          background-image:
            linear-gradient(0deg, transparent 24%, rgba(217, 217, 217, 0.2) 25%, rgba(217, 217, 217, 0.2) 26%, transparent 27%, transparent 74%, rgba(217, 217, 217, 0.2) 75%, rgba(217, 217, 217, 0.2) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(217, 217, 217, 0.2) 25%, rgba(217, 217, 217, 0.2) 26%, transparent 27%, transparent 74%, rgba(217, 217, 217, 0.2) 75%, rgba(217, 217, 217, 0.2) 76%, transparent 77%, transparent);
          background-size: 60px 60px;
        }
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #FFFFFF;
          border: 2px solid #000000;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 8px 8px 0 rgba(0,0,0,0.2);
          position: relative;
        }
        .email-header {
          background-color: #000000;
          padding: 32px 20px;
          text-align: center;
          color: #FFFFFF;
          position: relative;
          transform: rotate(-0.5deg);
        }
        .email-header h1 {
          margin: 0;
          font-family: 'Gochi Hand', cursive;
          font-size: 32px;
          font-weight: 400;
          letter-spacing: 1px;
        }
        .email-body {
          padding: 36px 30px;
          color: #000000;
          line-height: 1.7;
        }
        .email-body h2 {
          font-family: 'Gochi Hand', cursive;
          font-size: 24px;
          margin: 0 0 16px 0;
          color: #000000;
        }
        .email-body p {
          margin: 0 0 16px 0;
          font-size: 15px;
        }
        .email-footer {
          background-color: #EFEFEF;
          padding: 20px 30px;
          text-align: center;
          color: #666666;
          font-size: 13px;
          border-top: 2px dashed #000000;
        }
        .email-footer p {
          margin: 6px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: #FFFF33;
          color: #000000;
          text-decoration: none;
          border: 2px solid #000000;
          border-radius: 6px;
          font-family: 'Gochi Hand', cursive;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          cursor: pointer;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.2);
          transition: all 0.15s ease;
        }
        .button:hover {
          box-shadow: 6px 6px 0 rgba(0,0,0,0.2);
          transform: translate(-1px, -1px);
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #000000;
          text-align: center;
          padding: 24px;
          background-color: #FFFF33;
          border: 2px solid #000000;
          border-radius: 6px;
          margin: 24px 0;
          font-family: monospace;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.1);
        }
        .info-box {
          background-color: #FFFACD;
          border: 2px solid #000000;
          border-radius: 6px;
          padding: 16px 20px;
          margin: 20px 0;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.1);
        }
        .info-box strong {
          color: #000000;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed #000000;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #000000;
        }
        .info-value {
          color: #000000;
          font-weight: 500;
        }
        .social-links {
          margin: 16px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 8px;
          color: #000000;
          text-decoration: underline;
          text-decoration-color: #FFFF33;
          text-decoration-thickness: 2px;
          font-weight: 600;
        }
        .tape {
          position: absolute;
          width: 60px;
          height: 30px;
          background-color: #FFFF33;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          opacity: 0.7;
        }
        .tape-1 {
          top: -8px;
          left: 20px;
          transform: rotate(-15deg);
        }
        .tape-2 {
          top: -8px;
          right: 20px;
          transform: rotate(15deg);
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="tape tape-1"></div>
        <div class="tape tape-2"></div>
        <div class="email-header">
          <h1>${companyName}</h1>
        </div>
        <div class="email-body">
          ${content}
        </div>
        <div class="email-footer">
          <p><strong>${companyName}</strong></p>
          <p>${appDescription}</p>
          <div class="social-links">
            <a href="${appConfig.url}">Website</a> •
            <a href="mailto:${process.env.SMTP_FROM_EMAIL || 'support@example.com'}">Support</a>
          </div>
          <p style="font-size: 11px; color: #999999; margin-top: 12px;">
            Automated email • Do not reply to this message
          </p>
          ${options.unsubscribeUrl ? `<p style="font-size: 11px; margin-top: 6px;"><a href="${options.unsubscribeUrl}" style="color: #666666;">Unsubscribe from tips and summaries</a></p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};
