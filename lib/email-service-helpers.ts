import { getVideoCompleteTemplate, getGetStartedTemplate, getTutorialSequenceTemplate, getExportReadyTemplate, getMonthlyDigestTemplate } from './email-templates'
import { emailService } from './email-service'
import { appConfig } from './config'

export async function sendVideoCompleteEmail(userName: string, videoTitle: string, videoId: string) {
  try {
    const html = getVideoCompleteTemplate({
      userName,
      videoTitle,
      videoUrl: `${appConfig.url}/videos/${videoId}`,
      duration: '2-5 minutes'
    })
    
    // Get user email from DB (implement based on your user lookup)
    await emailService.send({
      type: 'video_complete',
      recipients: ['user@example.com'], // Replace with actual user email
      subject: `✨ Your video "${videoTitle}" is ready!`,
      data: { html }
    })
  } catch (error) {
    console.error('Failed to send video complete email:', error)
  }
}

export async function sendGetStartedEmailSequence(userEmail: string, userName: string) {
  try {
    // Email 1: Welcome + Get Started
    const html = getGetStartedTemplate({ userName })
    
    await emailService.send({
      type: 'onboarding_get_started',
      recipients: [userEmail],
      subject: `Welcome ${userName}! Let's create your first video`,
      data: { html }
    })
  } catch (error) {
    console.error('Failed to send get started email:', error)
  }
}

export async function sendTutorialEmail(
  userEmail: string,
  userName: string,
  tutorialNumber: number,
  tutorialTitle: string,
  totalTutorials: number
) {
  try {
    const tutorials = [
      { title: 'Basics', desc: 'Learn the fundamentals in 10 minutes', url: '/tutorials/1' },
      { title: 'Templates', desc: 'Explore 50+ professional templates', url: '/tutorials/2' },
      { title: 'Exports', desc: 'Download and share your videos', url: '/tutorials/3' },
      { title: 'Effects', desc: 'Add stunning visual effects', url: '/tutorials/4' },
      { title: 'Collaboration', desc: 'Work with your team in real-time', url: '/tutorials/5' }
    ]
    
    const tutorial = tutorials[tutorialNumber - 1]
    const nextTutorial = tutorials[tutorialNumber] ? tutorials[tutorialNumber].title : undefined
    
    const html = getTutorialSequenceTemplate({
      userName,
      tutorialNumber,
      tutorialTitle: tutorial.title,
      tutorialDescription: tutorial.desc,
      tutorialUrl: `${appConfig.url}${tutorial.url}`,
      nextTutorialTitle: nextTutorial,
      totalTutorials
    })
    
    await emailService.send({
      type: 'tutorial_sequence',
      recipients: [userEmail],
      subject: `Tutorial ${tutorialNumber}: ${tutorial.title}`,
      data: { html }
    })
  } catch (error) {
    console.error('Failed to send tutorial email:', error)
  }
}

export async function sendExportReadyEmail(userEmail: string, userName: string, videoTitle: string, downloadUrl: string) {
  try {
    const html = getExportReadyTemplate({
      userName,
      videoTitle,
      format: 'MP4 (1080p)',
      downloadUrl,
      expiresIn: '7 days'
    })
    
    await emailService.send({
      type: 'export_ready',
      recipients: [userEmail],
      subject: `Download your video: ${videoTitle}`,
      data: { html }
    })
  } catch (error) {
    console.error('Failed to send export ready email:', error)
  }
}

export async function sendMonthlyDigestEmail(
  userEmail: string,
  userName: string,
  stats: { videoCount: number; totalViews: number; topVideoTitle: string; topVideoViews: number }
) {
  try {
    const html = getMonthlyDigestTemplate({
      userName,
      videoCount: stats.videoCount,
      totalViewsCount: stats.totalViews,
      topVideoTitle: stats.topVideoTitle,
      topVideoViews: stats.topVideoViews
    })
    
    const month = new Date().toLocaleDateString('en-US', { month: 'long' })
    
    await emailService.send({
      type: 'monthly_digest',
      recipients: [userEmail],
      subject: `Your ${month} ${appConfig.name} summary`,
      data: { html }
    })
  } catch (error) {
    console.error('Failed to send monthly digest email:', error)
  }
}
