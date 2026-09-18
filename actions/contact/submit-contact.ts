'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';
import { getContactFormTemplate } from '@/lib/email-templates/contact-form-template';
import { appConfig } from '@/lib/config';
import { getOrgPlan } from '@/lib/billing/plan-gating';
import { requireSessionViewer } from '@/lib/video-project/session';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type ContactFormData = z.infer<typeof contactSchema>;

// Anonymous visitors and free plans get the normal queue; a failure here must not block the message.
async function priorityPlanName(): Promise<string | null> {
  try {
    const viewer = await requireSessionViewer();
    if (!viewer.organizationId) return null;
    const plan = await getOrgPlan(viewer.organizationId);
    return plan.features.priority_support === true ? plan.name : null;
  } catch {
    return null;
  }
}

export async function submitContact(
  formData: ContactFormData
): Promise<{ success: true } | { error: string }> {
  const parsed = contactSchema.safeParse(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' };
  }

  const { fullName, email, phoneNumber, message } = parsed.data;

  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null;

  const priorityPlan = await priorityPlanName();

  try {
    await prisma.contactSubmission.create({
      data: {
        fullName,
        email,
        phoneNumber: phoneNumber ?? null,
        message,
        ipAddress,
      },
    });

    try {
      const adminEmailSetting = await prisma.setting.findUnique({
        where: { key: 'email' },
      });
      const toEmail = adminEmailSetting?.value || process.env.SMTP_FROM_EMAIL;

      if (toEmail) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const htmlContent = getContactFormTemplate({
          fullName,
          email,
          phoneNumber,
          message,
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM_EMAIL,
          to: toEmail,
          replyTo: email,
          subject: `${priorityPlan ? `[PRIORITY · ${priorityPlan}] ` : ''}New Contact Form Inquiry from ${fullName} — ${appConfig.name}`,
          html: htmlContent,
        });
      }
    } catch (emailError) {
      console.error('Failed to send contact notification email:', emailError);
    }

    return { success: true };
  } catch (error) {
    console.error('Error submitting contact form:', error);
    return { error: 'Failed to send your message. Please try again later.' };
  }
}
