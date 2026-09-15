import nodemailer from 'nodemailer';
import type { SendEmailRequest, OTPEmailData, ResetPasswordEmailData, PaymentReceiptEmailData, WelcomeEmailData, SubscriptionEmailData, EmailChangeVerificationData, EmailChangeNotificationData, OrganizationInvitationEmailData, MagicLinkEmailData, VideoReadyEmailData, OnboardingEmailData, MonthlyDigestEmailData } from '@/types/email';
import { getOnboardingTemplate, onboardingSubject } from './email-templates/onboarding-template';
import { getMonthlyDigestTemplate } from './email-templates/monthly-digest-template';
import { getMagicLinkTemplate } from './email-templates/magic-link-template';
import { getVideoReadyTemplate } from './email-templates/video-complete-template';
import { getOrganizationInvitationTemplate } from './email-templates/organization-invitation-template';
import { getOTPEmailTemplate } from './email-templates/otp-template';
import { getResetPasswordTemplate } from './email-templates/reset-password-template';
import { getPaymentReceiptTemplate } from './email-templates/payment-receipt-template';
import { getWelcomeEmailTemplate } from './email-templates/welcome-template';
import { getSubscriptionEmailTemplate } from './email-templates/subscription-template';
import { getEmailChangeVerificationTemplate } from './email-templates/email-change-verification-template';
import { getEmailChangeNotificationTemplate } from './email-templates/email-change-notification-template';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(request: SendEmailRequest): Promise<void> {
    const { type, data, recipients, subject } = request;
    
    let htmlContent: string;
    let emailSubject: string;

    switch (type) {
      case 'otp':
        htmlContent = getOTPEmailTemplate(data as OTPEmailData);
        emailSubject = subject || 'Your Verification Code';
        break;
      case 'reset_password':
        htmlContent = getResetPasswordTemplate(data as ResetPasswordEmailData);
        emailSubject = subject || 'Reset Your Password';
        break;
      case 'payment_receipt': {
        const receiptData = data as PaymentReceiptEmailData;
        const normalizedReceipt = {
          ...receiptData,
          transactionId: receiptData.transactionId || receiptData.invoiceId || '',
        };
        htmlContent = getPaymentReceiptTemplate(normalizedReceipt);
        emailSubject = subject || 'Payment Receipt';
        break;
      }
      case 'welcome':
        htmlContent = getWelcomeEmailTemplate(data as WelcomeEmailData);
        emailSubject = subject || 'Welcome!';
        break;
      case 'subscription_created':
        htmlContent = getSubscriptionEmailTemplate(data as SubscriptionEmailData, 'created');
        emailSubject = subject || 'Subscription Confirmed';
        break;
      case 'subscription_cancelled':
        htmlContent = getSubscriptionEmailTemplate(data as SubscriptionEmailData, 'cancelled');
        emailSubject = subject || 'Subscription Cancelled';
        break;
      case 'email_change_verification':
        htmlContent = getEmailChangeVerificationTemplate(data as EmailChangeVerificationData);
        emailSubject = subject || 'Verify Your New Email Address';
        break;
      case 'email_change_notification':
        htmlContent = getEmailChangeNotificationTemplate(data as EmailChangeNotificationData);
        emailSubject = subject || 'Email Change Requested';
        break;
      case 'organization_invitation':
        htmlContent = getOrganizationInvitationTemplate(data as OrganizationInvitationEmailData);
        emailSubject = subject || 'You have been invited to an organization';
        break;
      case 'magic_link':
        htmlContent = getMagicLinkTemplate(data as MagicLinkEmailData);
        emailSubject = subject || 'Your sign-in link';
        break;
      case 'video_ready':
        htmlContent = getVideoReadyTemplate(data as VideoReadyEmailData);
        emailSubject = subject || 'Your video is ready';
        break;
      case 'onboarding':
        htmlContent = getOnboardingTemplate(data as OnboardingEmailData);
        emailSubject = subject || onboardingSubject((data as OnboardingEmailData).step);
        break;
      case 'monthly_digest':
        htmlContent = getMonthlyDigestTemplate(data as MonthlyDigestEmailData);
        emailSubject = subject || `Your ${(data as MonthlyDigestEmailData).monthLabel} summary`;
        break;
      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL,
      to: recipients?.[0] || (data as any).recipientEmail,
      subject: emailSubject,
      html: htmlContent,
      ...('unsubscribeUrl' in data
        ? {
            list: { unsubscribe: data.unsubscribeUrl },
            headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          }
        : {}),
    };

    await this.transporter.sendMail(mailOptions);
  }
}
