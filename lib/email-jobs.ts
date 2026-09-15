import { prisma } from './database'
import {
  sendGetStartedEmailSequence,
  sendTutorialEmail,
  sendMonthlyDigestEmail
} from './email-service-helpers'

/**
 * Send onboarding email sequence
 * Call this immediately after user signup
 */
export async function scheduleOnboardingSequence(userId: string, userEmail: string, userName: string) {
  try {
    // Email 1: Get Started (immediate)
    await sendGetStartedEmailSequence(userEmail, userName)
    
    // Schedule tutorial emails (daily, starting tomorrow)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    for (let i = 1; i <= 5; i++) {
      const emailDate = new Date(tomorrow.getTime() + (i - 1) * 24 * 60 * 60 * 1000)
      
      // Store in job queue (implement with your job system: Bull, Bullmq, etc.)
      // For now, just log what would be scheduled
      console.log(`[SCHEDULED] Tutorial ${i} email for ${emailDate.toISOString()}`)
      
      // TODO: When job queue is ready, uncomment:
      // await jobQueue.add('send-tutorial-email', {
      //   userEmail,
      //   userName,
      //   tutorialNumber: i,
      //   totalTutorials: 5
      // }, { delay: emailDate.getTime() - Date.now() })
    }
  } catch (error) {
    console.error('Failed to schedule onboarding sequence:', error)
  }
}

/**
 * Send monthly digest on the 1st of each month
 * Call this from a cron job (0 9 1 * * = 9 AM on 1st of month)
 */
export async function sendMonthlyDigests() {
  try {
    // Get all active users
    const users = await prisma.user.findMany({
      where: { emailVerified: true },
      select: { id: true, name: true, email: true }
    })

    for (const user of users) {
      // Get user stats (customize based on your schema)
      const stats = {
        videoCount: 12, // TODO: Count from VideoProject
        totalViews: 4250, // TODO: Sum from analytics
        topVideoTitle: 'Sample Video',
        topVideoViews: 892
      }
      
      await sendMonthlyDigestEmail(user.email, user.name, stats)
    }

    console.log(`[SENT] Monthly digests to ${users.length} users`)
  } catch (error) {
    console.error('Failed to send monthly digests:', error)
  }
}

/**
 * Example cron job setup (add to your scheduler)
 * 
 * Using node-cron:
 * import cron from 'node-cron'
 * 
 * // Send monthly digest on 1st at 9 AM
 * cron.schedule('0 9 1 * *', () => {
 *   sendMonthlyDigests()
 * })
 * 
 * Using Bull:
 * import Queue from 'bull'
 * const emailQueue = new Queue('emails')
 * 
 * emailQueue.process('monthly-digest', async () => {
 *   await sendMonthlyDigests()
 * })
 */
