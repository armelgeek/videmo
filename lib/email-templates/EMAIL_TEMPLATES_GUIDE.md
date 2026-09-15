# Email Templates Guide

All templates follow the sketch design system (black/yellow, handwritten fonts, offset shadows).

## Available Templates

### Authentication
- **OTP Template** (`getOtpTemplate`)
  - 6-digit verification codes
  - Used for email verification and 2FA
  
- **Magic Link Template** (`getMagicLinkTemplate`)
  - Passwordless login links
  - 15-minute expiry
  - Fallback copy/paste link

- **Reset Password Template** (`getResetPasswordTemplate`)
  - Password reset flow
  - Expiry info
  - Security warnings

- **Email Change Verification** (`getEmailChangeVerificationTemplate`)
  - Confirm new email address
  - 24-hour expiry
  - Protection against unauthorized changes

### Onboarding
- **Welcome Template** (`getWelcomeEmailTemplate`)
  - First email after signup
  - Quick start guide
  - Next steps

- **Get Started Template** (`getGetStartedTemplate`)
  - 3-step quick start
  - Popular templates showcase
  - Pro tips

- **Tutorial Sequence** (`getTutorialSequenceTemplate`)
  - Multi-email drip campaign
  - Progress tracking
  - Daily tutorials (one per email)
  - Example: 10-email series teaching platform features

### Product Updates
- **Video Complete Template** (`getVideoCompleteTemplate`)
  - Sent when video rendering finishes
  - View link + duration
  - Next steps

- **Export Ready Template** (`getExportReadyTemplate`)
  - Download link (expires in 7 days)
  - Format information
  - Social share prompts

- **Monthly Digest Template** (`getMonthlyDigestTemplate`)
  - Usage statistics
  - Top videos
  - Growth metrics
  - Feature highlights
  - Next month challenges

### Collaboration
- **Collaboration Invite** (`getCollaborationInviteTemplate`)
  - Invite others to projects
  - Role information
  - Quick join link

### Account
- **Payment Receipt** (`getPaymentReceiptTemplate`)
  - Invoice for purchases
  - Receipt details
  
- **Subscription Template** (`getSubscriptionEmailTemplate`)
  - Subscription confirmations
  - Plan details
  - Billing information

- **Organization Invitation** (`getOrganizationInvitationTemplate`)
  - Team invites
  - Org details

## Usage Examples

### Send Video Complete Email
```typescript
import { getVideoCompleteTemplate } from '@/lib/email-templates'

const html = getVideoCompleteTemplate({
  userName: 'Jane',
  videoTitle: 'Product Launch Video',
  videoUrl: 'https://app.example.com/videos/123',
  duration: '3 minutes 45 seconds'
})

await emailService.send({
  to: 'jane@example.com',
  subject: 'Your video is ready!',
  html
})
```

### Send Tutorial Sequence (Drip Campaign)
```typescript
import { getTutorialSequenceTemplate } from '@/lib/email-templates'

// Day 1: Basic editing
const email1 = getTutorialSequenceTemplate({
  userName: 'John',
  tutorialNumber: 1,
  tutorialTitle: 'Basic Video Editing',
  tutorialDescription: 'Learn the fundamentals of editing in 10 minutes.',
  tutorialUrl: 'https://app.example.com/tutorials/1',
  nextTutorialTitle: 'Working with Templates',
  totalTutorials: 10
})

// Schedule this and other emails with delay
// Day 2: Templates
// Day 3: Effects
// etc...
```

### Send Monthly Digest
```typescript
import { getMonthlyDigestTemplate } from '@/lib/email-templates'

const html = getMonthlyDigestTemplate({
  userName: 'Sarah',
  videoCount: 12,
  totalViewsCount: 4250,
  topVideoTitle: 'How to Cook Pasta',
  topVideoViews: 892
})

await emailService.send({
  to: 'sarah@example.com',
  subject: 'Your September Summary',
  html
})
```

## Design System

All templates use:
- **Colors**: Black (#000000), Yellow (#FFFF33), Light gray (#EFEFEF)
- **Typography**: Gochi Hand font for headings, system fonts for body
- **Borders**: 2px solid black with 2px dashed accents
- **Shadows**: 4-8px offset box shadows for depth
- **Elements**: Scotch tape effects (optional), grid backgrounds

## Recommended Drip Sequences

### New User Onboarding (5 emails, 1 per day)
1. Day 0: Welcome + Get Started
2. Day 1: Tutorial 1 (Basics)
3. Day 2: Tutorial 2 (Templates)
4. Day 3: Tutorial 3 (Exports)
5. Day 5: Inspiration + Gallery

### Video Creator Path (3 emails)
1. Video Complete → View + Share
2. Export Ready → Download
3. Next Day: Monthly stats if they export regularly

### Premium Upsell Sequence (4 emails)
1. Day 3: Feature highlight email
2. Day 7: Limit reached (soft upgrade suggestion)
3. Day 14: Success stories
4. Day 21: Limited-time offer (optional)

## Best Practices

1. **Timing**
   - Welcome: Immediately
   - Get Started: +2 hours
   - Tutorial Series: Daily at 9 AM
   - Digest: 1st of each month
   - Product notifications: Immediate

2. **Personalization**
   - Always use user's first name
   - Reference their specific videos/projects
   - Show relevant stats and achievements

3. **CTAs**
   - Every email should have 1-2 clear CTAs
   - Button text uses →arrow format
   - Keep links to dashboard/relevant pages

4. **Unsubscribe**
   - Include footer with unsubscribe option
   - Respect user preferences
   - Allow selective opt-out (e.g., digest only)

## Testing Checklist

Before deploying new template:
- [ ] All links work correctly
- [ ] Content fits on mobile (preview at 320px)
- [ ] Images load properly
- [ ] Spelling and grammar checked
- [ ] Personalization tokens work
- [ ] CTA buttons visible and clickable
- [ ] Email renders in Gmail, Outlook, Apple Mail
- [ ] Unsubscribe footer present

## Adding New Templates

Template signature:
```typescript
export const getMyTemplate = (data: {
  // required fields
  userName: string;
  // template-specific fields
  field1: string;
  field2: number;
}): string => {
  const content = `
    <h2>Template title</h2>
    <!-- HTML content -->
  `;
  
  return getBaseEmailTemplate(content);
};
```

Export in `index.ts` and you're ready to use!
