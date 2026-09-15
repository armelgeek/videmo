/**
 * Integration points for email triggers
 * Add these to your existing event handlers
 */

import { sendVideoCompleteEmail, sendExportReadyEmail } from './email-service-helpers'

/**
 * TRIGGER 1: When video processing completes
 * Add to your video processing callback/webhook
 */
export async function handleVideoComplete(videoId: string, videoTitle: string, userId: string) {
  try {
    // Get user details
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { email: true, name: true }
    })
    
    if (user) {
      await sendVideoCompleteEmail(user.name, videoTitle, videoId)
    }
  } catch (error) {
    console.error('Video complete handler failed:', error)
  }
}

/**
 * TRIGGER 2: When user exports video
 * Add to your export/download endpoint
 */
export async function handleExportReady(downloadUrl: string, videoTitle: string, userEmail: string, userName: string) {
  try {
    await sendExportReadyEmail(userEmail, userName, videoTitle, downloadUrl)
  } catch (error) {
    console.error('Export ready handler failed:', error)
  }
}

/**
 * USAGE EXAMPLES:
 * 
 * In your video processing route/action:
 * ---------
 * app/api/videos/process/route.ts:
 * 
 * export async function POST(request: NextRequest) {
 *   try {
 *     // Process video...
 *     const video = await renderVideo(videoId)
 *     
 *     // Trigger email
 *     await handleVideoComplete(videoId, video.title, video.userId)
 *     
 *     return NextResponse.json({ success: true })
 *   } catch (error) {
 *     // ...
 *   }
 * }
 * 
 * In your export action:
 * ---------
 * actions/videos/export-video.ts:
 * 
 * export async function exportVideo(videoId: string) {
 *   const session = await auth.getSession()
 *   const video = await prisma.videoProject.findUnique({...})
 *   const downloadUrl = await generateDownloadLink(videoId)
 *   
 *   // Send email
 *   await handleExportReady(downloadUrl, video.title, session.user.email, session.user.name)
 *   
 *   return { downloadUrl }
 * }
 */
