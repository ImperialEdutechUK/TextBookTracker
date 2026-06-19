// Fires a Microsoft Teams notification when a new printed-materials request is
// created. The message is posted as an Adaptive Card to a Teams "Workflows"
// (Power Automate) incoming webhook, which only accepts adaptive/message cards.
//
// Configure via environment variables (see .env.example):
//   TEAMS_WEBHOOK_URL      - the Workflows webhook URL (required to enable)
//   TEAMS_MENTION_USER_ID  - Sadeev's Azure AD object id or UPN/email. When set,
//                            the greeting tags him as a real @mention. Without
//                            it Teams cannot resolve a name to a person, so we
//                            fall back to the plain text "Hi Sadeev".
//   TEAMS_MENTION_NAME     - display name for the greeting/mention (default "Sadeev").

type RequestForNotify = {
  fullName: string;
  email: string;
  course: string;
  address: string;
  createdAt: Date;
};

// UK-friendly, human readable timestamp with the zone abbreviation so the
// reader knows which country's time it is, e.g. "19 June 2026 at 14:32 BST".
// The request is always recorded in UK time (Europe/London) regardless of where
// the person who entered it is located. The abbreviation shows as GMT in winter
// and BST during British Summer Time.
function formatCreatedAt(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'Europe/London',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function buildCard(request: RequestForNotify) {
  const mentionId = process.env.TEAMS_MENTION_USER_ID?.trim();
  const mentionName = process.env.TEAMS_MENTION_NAME?.trim() || 'Sadeev';

  // When we have an AAD id we can render a real @mention; the body text uses an
  // <at> tag that is matched to the entity below. Otherwise greet by name only.
  const greeting = mentionId ? `Hi <at>${mentionName}</at>,` : 'Hi Sadeev,';

  const card: Record<string, unknown> = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: greeting, wrap: true },
      {
        type: 'TextBlock',
        text: 'This learner has requested printed course materials.',
        wrap: true,
        spacing: 'None',
      },
      {
        type: 'FactSet',
        spacing: 'Medium',
        facts: [
          { title: 'Name', value: request.fullName },
          { title: 'Email', value: request.email },
          { title: 'Course', value: request.course },
          { title: 'Address', value: request.address },
          { title: 'Request created at', value: formatCreatedAt(request.createdAt) },
        ],
      },
    ],
  };

  if (mentionId) {
    card.msteams = {
      entities: [
        {
          type: 'mention',
          text: `<at>${mentionName}</at>`,
          mentioned: { id: mentionId, name: mentionName },
        },
      ],
    };
  }

  // Workflows incoming webhooks expect a chat message that carries the adaptive
  // card as an attachment.
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  };
}

// Fire-and-forget: a notification failure must never break request creation, so
// this swallows all errors (after logging) and never throws.
export async function notifyNewRequest(request: RequestForNotify): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    // Feature disabled until a webhook is configured. Log it so a missing/unloaded
    // env var is obvious instead of silently doing nothing.
    console.warn('[teamsNotify] Skipped: TEAMS_WEBHOOK_URL is not set (restart the server after editing .env).');
    return;
  }

  try {
    console.log('[teamsNotify] Posting new-request notification to Teams...');
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCard(request)),
    });
    if (res.ok) {
      console.log(`[teamsNotify] Teams notification sent (${res.status}).`);
    } else {
      const detail = await res.text().catch(() => '');
      console.error(`[teamsNotify] Webhook responded ${res.status} ${res.statusText}. ${detail}`);
    }
  } catch (err) {
    console.error('[teamsNotify] Failed to post to Teams webhook:', err);
  }
}
