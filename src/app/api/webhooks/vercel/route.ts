import { NextResponse } from 'next/server';

// Discord webhook URL from environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function POST(request: Request) {
  try {
    console.log('Webhook received');
    const payload = await request.json();
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Only process QA branch deployments
    if (payload.payload?.gitSource?.ref !== 'refs/heads/qa') {
      console.log('Ignoring non-QA deployment');
      return NextResponse.json({ message: 'Ignored non-QA deployment' });
    }

    const deployment = payload.payload;
    const deploymentUrl = deployment.url;
    console.log('Deployment URL:', deploymentUrl);

    // Create simple Discord message
    const message = {
      content: `🚀 New QA Deployment!\nPreview URL: ${deploymentUrl}`
    };

    // Send to Discord
    if (DISCORD_WEBHOOK_URL) {
      console.log('Sending to Discord...');
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      console.log('Discord response:', response.status);
    } else {
      console.log('No Discord webhook URL configured');
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 