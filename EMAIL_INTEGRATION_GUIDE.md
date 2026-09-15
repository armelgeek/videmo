# Email Integration Guide

Everything is ready to send emails automatically. Here's how to wire it up.

## Files Created

```
lib/email-service-helpers.ts   → Functions to send emails
lib/email-jobs.ts              → Scheduled jobs (cron)
lib/email-triggers.ts          → Event handlers
```

## 1. Onboarding Sequence (After Signup)

Currently triggered manually. Add to your signup action:

```typescript
// actions/auth/signup.ts
import { scheduleOnboardingSequence } from '@/lib/email-jobs'

export async function signUp(data: any) {
  // ... existing signup code ...
  
  const user = await db.user.create({
    data: { email, name, /* ... */ }
  })
  
  // Send welcome email + schedule tutorials
  await scheduleOnboardingSequence(user.id, user.email, user.name)
  
  return { success: true, user }
}
```

## 2. Video Complete Email (When Rendering Finishes)

Add to your video rendering webhook/callback:

```typescript
// app/api/webhooks/video-complete/route.ts
import { handleVideoComplete } from '@/lib/email-triggers'

export async function POST(request: NextRequest) {
  const { videoId, userId, title } = await request.json()
  
  // Mark video as complete in DB
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { status: 'completed' }
  })
  
  // Send completion email
  await handleVideoComplete(videoId, title, userId)
  
  return NextResponse.json({ success: true })
}
```

## 3. Export Ready Email (When User Downloads)

Add to your export endpoint:

```typescript
// app/api/videos/export/route.ts
import { handleExportReady } from '@/lib/email-triggers'

export async function POST(request: NextRequest) {
  const { videoId } = await request.json()
  const session = await auth.getSession()
  
  // Generate download URL
  const downloadUrl = await generateSignedUrl(videoId)
  
  // Get video details
  const video = await prisma.videoProject.findUnique({
    where: { id: videoId }
  })
  
  // Send export ready email
  await handleExportReady(
    downloadUrl,
    video.title,
    session.user.email,
    session.user.name
  )
  
  return NextResponse.json({ downloadUrl })
}
```

## 4. Monthly Digest (Cron Job)

### Option A: Using Node-Cron (Simpler)

```typescript
// lib/cron-jobs.ts
import cron from 'node-cron'
import { sendMonthlyDigests } from './email-jobs'

export function initializeCronJobs() {
  // Every month on the 1st at 9 AM
  cron.schedule('0 9 1 * *', async () => {
    console.log('[CRON] Running monthly digest...')
    await sendMonthlyDigests()
  })
  
  console.log('[CRON] Initialized')
}

// Then call in your app initialization
// pages/_app.tsx or app/layout.tsx
import { initializeCronJobs } from '@/lib/cron-jobs'

useEffect(() => {
  initializeCronJobs()
}, [])
```

Install: `npm install node-cron`

### Option B: Using Bull Queue (More Robust)

```typescript
// lib/bull-queue.ts
import Queue from 'bull'

const emailQueue = new Queue('emails', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
})

// Process monthly digest jobs
emailQueue.process('monthly-digest', async () => {
  await sendMonthlyDigests()
})

// Repeat job every month
emailQueue.add('monthly-digest', {}, {
  repeat: { cron: '0 9 1 * *' }
})

export default emailQueue
```

Install: `npm install bull redis`

### Option C: Using Vercel Cron (For Vercel Deployments)

```typescript
// api/cron/monthly-digest.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendMonthlyDigests } from '@/lib/email-jobs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Verify request is from Vercel
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendMonthlyDigests()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/monthly-digest",
    "schedule": "0 9 1 * *"
  }]
}
```

## 5. Tutorial Drip Sequence (Daily Emails)

The onboarding sequence schedules tutorials for 5 days. To make it work:

### Using Bull Queue (Recommended):

```typescript
// lib/email-jobs.ts - UPDATED
import Queue from 'bull'

const emailQueue = new Queue('emails', {
  redis: { host: process.env.REDIS_HOST || 'localhost' }
})

export async function scheduleOnboardingSequence(userId, userEmail, userName) {
  await sendGetStartedEmailSequence(userEmail, userName)
  
  // Schedule 5 daily tutorials
  for (let i = 1; i <= 5; i++) {
    const delayMs = i * 24 * 60 * 60 * 1000 // Day i
    
    await emailQueue.add('send-tutorial', {
      userEmail,
      userName,
      tutorialNumber: i,
      totalTutorials: 5
    }, { delay: delayMs })
  }
}

// Process tutorial emails
emailQueue.process('send-tutorial', async (job) => {
  const { userEmail, userName, tutorialNumber, totalTutorials } = job.data
  await sendTutorialEmail(userEmail, userName, tutorialNumber, totalTutorials)
})
```

## Integration Checklist

- [ ] Install email dependencies (if using Bull: `npm install bull redis`)
- [ ] Add `scheduleOnboardingSequence` to signup action
- [ ] Add `handleVideoComplete` to video processing webhook
- [ ] Add `handleExportReady` to export endpoint
- [ ] Setup monthly digest with cron (choose: node-cron, Bull, or Vercel)
- [ ] Setup tutorial drip with job queue
- [ ] Test emails in development
- [ ] Configure email provider (Resend, SendGrid, etc.)
- [ ] Update user email addresses in helpers (use real user lookups)

## Testing

### Test Video Complete Email
```typescript
import { handleVideoComplete } from '@/lib/email-triggers'

await handleVideoComplete('video-123', 'My Video', 'user-456')
```

### Test Monthly Digest
```typescript
import { sendMonthlyDigests } from '@/lib/email-jobs'

await sendMonthlyDigests()
```

### Test Onboarding
```typescript
import { scheduleOnboardingSequence } from '@/lib/email-jobs'

await scheduleOnboardingSequence('user-123', 'user@example.com', 'John')
```

## Environment Variables

```env
# Email Provider
RESEND_API_KEY=re_xxxxx
SMTP_FROM_EMAIL=noreply@example.com

# Job Queue (if using Bull)
REDIS_HOST=localhost
REDIS_PORT=6379

# Cron Security (if using Vercel)
CRON_SECRET=your-secret-key
```

## Email Service Provider Setup

You need to update `lib/email-service.ts` to use your actual email provider.

### Using Resend
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const emailService = {
  send: async (options: any) => {
    return resend.emails.send({
      from: process.env.SMTP_FROM_EMAIL,
      to: options.recipients,
      subject: options.subject,
      html: options.data.html
    })
  }
}
```

### Using SendGrid
```typescript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export const emailService = {
  send: async (options: any) => {
    return sgMail.send({
      to: options.recipients,
      from: process.env.SMTP_FROM_EMAIL,
      subject: options.subject,
      html: options.data.html
    })
  }
}
```

## Next Steps

1. Choose your job queue (Bull/Redis recommended for production)
2. Implement integration points above
3. Test each trigger
4. Deploy and monitor
5. Tweak templates based on metrics

Done! 🚀
