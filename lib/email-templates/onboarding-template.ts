import { appConfig } from '@/lib/config';
import { getBaseEmailTemplate } from './base-template';
import type { OnboardingEmailData } from '@/types/email';

const STEPS = {
  1: {
    title: 'Start your first project',
    body: [
      'A project begins with a name and a format: landscape for YouTube and slides, portrait for Reels, Shorts and TikTok, or square for feed posts.',
      'Once it is created, you write the script.',
    ],
    cta: 'Create a project',
    path: '/new-project',
  },
  2: {
    title: 'From script to storyboard',
    body: [
      'Validate your script first, then the storyboard: each panel becomes a scene of the whiteboard animation.',
      'You can come back to a project anytime from your workspace.',
    ],
    cta: 'Open your projects',
    path: '/workspace',
  },
  3: {
    title: 'Animate and export',
    body: [
      'Review the animation on the timeline, then export the video. Exports use credits, which you can check or top up on the billing page.',
      "When a server render finishes, we email you the download link. It stays available for 24 hours.",
    ],
    cta: 'Open your projects',
    path: '/workspace',
  },
} as const;

export const getOnboardingTemplate = (data: OnboardingEmailData): string => {
  const step = STEPS[data.step];
  const content = `
    <h2>${step.title}</h2>
    <p>Hi ${data.recipientName || 'there'},</p>
    ${step.body.map((p) => `<p>${p}</p>`).join('')}
    <div style="text-align: center; margin: 32px 0;">
      <a href="${appConfig.url}${step.path}" class="button">${step.cta} →</a>
    </div>
  `;
  return getBaseEmailTemplate(content, { unsubscribeUrl: data.unsubscribeUrl });
};

export const onboardingSubject = (step: OnboardingEmailData['step']): string => STEPS[step].title;
