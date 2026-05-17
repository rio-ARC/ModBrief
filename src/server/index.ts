/**
 * ContextLens — Hono Server Entry Point
 *
 * Endpoints:
 *   POST /internal/menu/view-context      ← menu item trigger
 *   POST /internal/form/context-submit    ← not used (no-op, menu uses form responses)
 *   POST /internal/form/mod-note-submit   ← mod note form submission
 *   POST /internal/form/remove-content-submit ← remove form
 *   POST /internal/form/ban-user-submit   ← ban form
 *   GET  /api/context/:username           ← WebView data fetch
 *   POST /api/actions/add-note            ← WebView action
 *   POST /api/actions/remove-content      ← WebView action
 *   POST /api/actions/ban-user            ← WebView action
 */

import { createServer } from '@devvit/server';
import { getServerPort } from '@devvit/shared-types/server/get-server-port.js';
import { Hono } from 'hono';
import { reddit, context } from '@devvit/web/server';
import { aggregateContext } from './contextAggregator.js';
import { getCached, setCached, isOnboarded, markOnboarded } from './kvCache.js';
import { scoreSignals } from './signalScorer.js';
import { generateNarrative } from './narrativeEngine.js';
import type {
  ContextResponse,
  AddModNoteRequest,
  RemoveContentRequest,
  BanUserRequest,
  ApiResponse,
  UiResponse,
  MenuItemRequest,
} from '../shared/types.js';

const app = new Hono();

// ---------------------------------------------------------------------------
// Helper: resolve author from a post or comment ID
// ---------------------------------------------------------------------------

async function resolveAuthor(
  postId?: string,
  commentId?: string
): Promise<{ username: string; contentId: string } | null> {
  if (commentId) {
    const comment = await reddit.getCommentById(commentId as `t1_${string}`);
    const username = comment.authorName;
    if (!username) return null;
    return { username, contentId: commentId };
  }
  if (postId) {
    const post = await reddit.getPostById(postId as `t3_${string}`);
    const username = post.authorName;
    if (!username) return null;
    return { username, contentId: postId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: build context response (cache-aware)
// ---------------------------------------------------------------------------

async function buildContextResponse(
  subredditName: string,
  username: string
): Promise<ContextResponse> {
  // 1. Check cache
  let payload = await getCached(subredditName, username);

  // 2. Fetch fresh if miss
  if (!payload) {
    payload = await aggregateContext(subredditName, username);
    // Only cache if we got meaningful data (don't cache empty/error states)
    if (!payload.dataPartial || payload.recentCommentCount > 0) {
      await setCached(subredditName, username, payload);
    }
  }

  // 3. Score + narrative
  const signals = scoreSignals(payload);
  const summary = generateNarrative(payload, signals);

  return { payload, signals, summary };
}

// ---------------------------------------------------------------------------
// POST /internal/menu/view-context
// Called when mod clicks "View user context" from menu
// ---------------------------------------------------------------------------

app.post('/internal/menu/view-context', async (c) => {
  const input = await c.req.json<MenuItemRequest>();

  const subredditName = context.subredditName ?? '';
  const postId   = input.postId ?? context.postId;
  const commentId = input.commentId ?? context.commentId;

  // Onboarding: first-run welcome message
  const onboarded = await isOnboarded();
  if (!onboarded) {
    await markOnboarded();
    return c.json<UiResponse>({
      showForm: {
        name: 'contextForm',
        form: {
          title: 'Welcome to ContextLens',
          acceptLabel: 'Got it',
          cancelLabel: 'Close',
          fields: [
            {
              name: 'info',
              type: 'string',
              label: 'ContextLens is now installed. Right-click any post or comment and select "View user context" to see a 30-second summary of any user.',
              defaultValue: '',
            },
          ],
        },
      },
    });
  }

  // Resolve the author username
  let author: { username: string; contentId: string } | null = null;
  try {
    author = await resolveAuthor(postId, commentId);
  } catch (err) {
    console.error('ContextLens: failed to resolve author', err);
  }

  if (!author) {
    return c.json<UiResponse>({
      showToast: 'Could not determine the author of this content.',
    });
  }

  const { username, contentId } = author;

  // Fetch context (may use cache)
  let response: ContextResponse;
  try {
    response = await buildContextResponse(subredditName, username);
  } catch (err) {
    console.error('ContextLens: failed to build context', err);
    return c.json<UiResponse>({
      showToast: 'Failed to load user context. Please try again.',
    });
  }

  const { payload, signals, summary } = response;

  // Build signal overview for the form
  const concernCount = signals.filter((s) => s.severity === 'concern').length;
  const watchCount   = signals.filter((s) => s.severity === 'watch').length;

  const signalLine =
    concernCount > 0
      ? `⚠ ${concernCount} concern${concernCount > 1 ? 's' : ''} · ${watchCount} watch`
      : watchCount > 0
      ? `• ${watchCount} watch signal${watchCount > 1 ? 's' : ''}`
      : '✓ No concerns';

  const accountLine = `Account: ${payload.accountAgeDays}d old · ${payload.totalKarma.toLocaleString()} karma · ${payload.recentCommentCount} comments / ${payload.recentPostCount} posts (30d)`;

  return c.json<UiResponse>({
    showForm: {
      name: 'contextForm',
      form: {
        title: `u/${username}`,
        acceptLabel: 'Add Mod Note',
        cancelLabel: 'Dismiss',
        fields: [
          {
            name: 'narrative',
            type: 'string',
            label: summary.text,
            defaultValue: '',
          },
          {
            name: 'signals',
            type: 'string',
            label: signalLine,
            defaultValue: '',
          },
          {
            name: 'account',
            type: 'string',
            label: accountLine,
            defaultValue: '',
          },
          {
            name: 'username',
            type: 'string',
            label: 'Username (do not edit)',
            defaultValue: username,
          },
          {
            name: 'contentId',
            type: 'string',
            label: 'Content ID (do not edit)',
            defaultValue: contentId,
          },
          {
            name: 'note',
            type: 'string',
            label: 'Mod note (optional — fill in to add note on submit)',
            defaultValue: '',
          },
        ],
      },
    },
  });
});

// ---------------------------------------------------------------------------
// POST /internal/form/context-submit
// Handles "Add Mod Note" or "Dismiss" from the context form
// ---------------------------------------------------------------------------

app.post('/internal/form/context-submit', async (c) => {
  const body = await c.req.json<{
    username?: string;
    note?: string;
    contentId?: string;
  }>();

  const { username, note } = body;
  const subredditName = context.subredditName ?? '';

  if (!username) {
    return c.json<UiResponse>({ showToast: 'Missing username.' });
  }

  if (note && note.trim()) {
    try {
      await reddit.addModNote({
        subreddit: subredditName,
        user: username,
        note: note.trim(),
      });
      return c.json<UiResponse>({ showToast: `Mod note added for u/${username}.` });
    } catch (err) {
      console.error('ContextLens: addModNote failed', err);
      return c.json<UiResponse>({ showToast: 'Failed to add mod note.' });
    }
  }

  return c.json<UiResponse>({ showToast: 'Dismissed.' });
});

// ---------------------------------------------------------------------------
// POST /internal/form/mod-note-submit
// Standalone mod note form
// ---------------------------------------------------------------------------

app.post('/internal/form/mod-note-submit', async (c) => {
  const body = await c.req.json<{ username?: string; note?: string; label?: string }>();
  const subredditName = context.subredditName ?? '';

  if (!body.username || !body.note) {
    return c.json<UiResponse>({ showToast: 'Missing required fields.' });
  }

  try {
    await reddit.addModNote({
      subreddit: subredditName,
      user: body.username,
      note: body.note,
    });
    return c.json<UiResponse>({ showToast: `Note added for u/${body.username}.` });
  } catch (err) {
    console.error('ContextLens: addModNote failed', err);
    return c.json<UiResponse>({ showToast: 'Failed to add mod note.' });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/form/remove-content-submit
// ---------------------------------------------------------------------------

app.post('/internal/form/remove-content-submit', async (c) => {
  const body = await c.req.json<{ contentId?: string; isSpam?: boolean }>();

  if (!body.contentId) {
    return c.json<UiResponse>({ showToast: 'Missing content ID.' });
  }

  try {
    const id = body.contentId as `t1_${string}` | `t3_${string}`;
    await reddit.remove(id, body.isSpam ?? false);
    return c.json<UiResponse>({ showToast: 'Content removed.' });
  } catch (err) {
    console.error('ContextLens: remove failed', err);
    return c.json<UiResponse>({ showToast: 'Failed to remove content.' });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/form/ban-user-submit
// ---------------------------------------------------------------------------

app.post('/internal/form/ban-user-submit', async (c) => {
  const body = await c.req.json<{ username?: string; reason?: string; duration?: number }>();
  const subredditName = context.subredditName ?? '';

  if (!body.username) {
    return c.json<UiResponse>({ showToast: 'Missing username.' });
  }

  try {
    await reddit.banUser({
      subredditName,
      username: body.username,
      reason: body.reason ?? 'Banned via ContextLens',
      duration: body.duration,
    });
    return c.json<UiResponse>({
      showToast: `u/${body.username} has been banned.`,
    });
  } catch (err) {
    console.error('ContextLens: banUser failed', err);
    return c.json<UiResponse>({ showToast: 'Failed to ban user.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/context/:username  — WebView data fetch
// ---------------------------------------------------------------------------

app.get('/api/context/:username', async (c) => {
  const username = c.req.param('username');
  const subredditName = c.req.query('subredditName') ?? context.subredditName ?? '';

  try {
    const response = await buildContextResponse(subredditName, username);
    return c.json(response);
  } catch (err) {
    console.error('ContextLens: /api/context error', err);
    return c.json({ error: 'Failed to load context' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/actions/add-note
// ---------------------------------------------------------------------------

app.post('/api/actions/add-note', async (c) => {
  const body = await c.req.json<AddModNoteRequest>();
  try {
    await reddit.addModNote({
      subreddit: body.subredditName,
      user: body.username,
      note: body.note,
    });
    return c.json<ApiResponse>({ success: true });
  } catch (err) {
    return c.json<ApiResponse>({ success: false, error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/actions/remove-content
// ---------------------------------------------------------------------------

app.post('/api/actions/remove-content', async (c) => {
  const body = await c.req.json<RemoveContentRequest>();
  try {
    const id = body.contentId as `t1_${string}` | `t3_${string}`;
    await reddit.remove(id, body.isSpam ?? false);
    return c.json<ApiResponse>({ success: true });
  } catch (err) {
    return c.json<ApiResponse>({ success: false, error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/actions/ban-user
// ---------------------------------------------------------------------------

app.post('/api/actions/ban-user', async (c) => {
  const body = await c.req.json<BanUserRequest>();
  try {
    await reddit.banUser({
      subredditName: body.subredditName,
      username: body.username,
      reason: body.reason,
      duration: body.duration,
      note: body.modNote,
    });
    return c.json<ApiResponse>({ success: true });
  } catch (err) {
    return c.json<ApiResponse>({ success: false, error: String(err) }, 500);
  }
});

export default app;

// ---------------------------------------------------------------------------
// Server bootstrap — bridges Node.js HTTP → Hono → Devvit runtime
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = `http://localhost${req.url ?? '/'}`;
  const method = req.method ?? 'GET';

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  let body: Buffer | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  const webReq = new Request(url, {
    method,
    headers,
    body: body ?? undefined,
  });

  const webRes = await app.fetch(webReq);

  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));

  const responseBody = await webRes.arrayBuffer();
  res.end(Buffer.from(responseBody));
});

server.listen(getServerPort(), () => {
  console.log(`ContextLens server listening on port ${getServerPort()}`);
});

