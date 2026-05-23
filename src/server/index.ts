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
import { reddit, context, redis } from '@devvit/web/server';
import { aggregateContext } from './contextAggregator.js';
import { getCached, setCached } from './kvCache.js';
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
  const subredditName = context.subredditName ?? '';
  const onboarded = await redis.get('contextlens:onboarded:' + subredditName);
  if (onboarded === null || onboarded === undefined) {
    await redis.set('contextlens:onboarded:' + subredditName, 'true');
    return c.json<any>({
      showForm: {
        name: 'contextForm',
        form: {
          title: 'Welcome to ContextLens',
          acceptLabel: 'Got it — show me the context',
          fields: [
            {
              name: 'info',
              type: 'paragraph',
              label: "ContextLens gives you instant moderation context for any user.\nHow to use:\n1. Right-click any post or comment → View user context\n2. Read the 2-sentence summary to understand the user's history\n3. Add a mod note or open the full dashboard if needed\nThat's it. This message won't appear again.",
              defaultValue: '',
            },
          ],
        },
      },
    });
  }

  const input = await c.req.json<MenuItemRequest>();
  const postId   = input.postId ?? context.postId;
  const commentId = input.commentId ?? context.commentId;

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

  const { username } = author;

  // Persist username for the async form submission handler (context is not available there)
  const userId = context.userId ?? 'unknown';
  await redis.set('contextlens:pending:' + userId, username, { expiration: new Date(Date.now() + 300_000) });

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

  return c.json<any>({
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
            name: 'note',
            type: 'string',
            label: 'Mod note (optional — fill in to add note on submit)',
            defaultValue: '',
          },
          {
            name: 'openDashboard',
            type: 'boolean',
            label: 'Open Full Dashboard on submit',
          },
        ],
      },
    },
  });
});

// Helper: build a full Reddit URL from a Post object
function postToUrl(post: { permalink: string; id: string }, subredditName: string): string {
  const rel = post.permalink || `/r/${subredditName}/comments/${String(post.id).replace('t3_', '')}/`;
  return `https://www.reddit.com${rel}`;
}

// Helper: get or create the shared dashboard custom post for this subreddit
async function getOrCreateDashboardPostUrl(subredditName: string): Promise<string> {
  const cacheKey = `contextlens:dashboard_post:${subredditName}`;
  const cachedId = await redis.get(cacheKey);

  // 1. Try cached post ID first
  if (cachedId) {
    try {
      const post = await reddit.getPostById(cachedId as `t3_${string}`);
      if (post && !post.removed) {
        return postToUrl(post, subredditName);
      }
    } catch (err) {
      console.warn('ContextLens: cached dashboard post unavailable, searching for existing...', err);
    }
  }

  // 2. Search for an existing ContextLens Dashboard post in the subreddit
  try {
    const listing = reddit.getNewPosts({ subredditName, limit: 25 });
    const posts = await listing.get(25);
    const existing = posts.find((p) => p.title === 'ContextLens Dashboard');
    if (existing) {
      await redis.set(cacheKey, existing.id);
      return postToUrl(existing, subredditName);
    }
  } catch (err) {
    console.warn('ContextLens: search for existing dashboard post failed, will create new', err);
  }

  // 3. Create a new custom post
  const post = await reddit.submitCustomPost({
    subredditName,
    title: 'ContextLens Dashboard',
    entry: 'default',
  });
  await redis.set(cacheKey, post.id);
  return postToUrl(post, subredditName);
}

// ---------------------------------------------------------------------------
// POST /internal/form/context-submit
// Handles "Add Mod Note" or "Dismiss" from the context form
// ---------------------------------------------------------------------------

app.post('/internal/form/context-submit', async (c) => {
  const body = await c.req.json<{
    note?: string;
    openDashboard?: boolean;
  }>();

  const { note, openDashboard } = body;
  const subredditName = context.subredditName ?? '';

  // Retrieve the target username stored by the menu handler
  const userId = context.userId ?? 'unknown';
  const username = await redis.get('contextlens:pending:' + userId);

  if (!username) {
    return c.json<UiResponse>({ showToast: 'Error: could not retrieve username. Please try again.' });
  }

  // Add mod note if provided (do this first, then handle dashboard navigation)
  let modNoteAdded = false;
  if (note && note.trim()) {
    try {
      await reddit.addModNote({
        subreddit: subredditName,
        user: username,
        note: note.trim(),
      });
      modNoteAdded = true;
    } catch (err) {
      console.error('ContextLens: addModNote failed', err);
    }
  }

  // openDashboard may arrive as boolean true or string 'true' depending on Devvit version
  const shouldOpenDashboard = openDashboard === true || (openDashboard as unknown) === 'true';

  if (shouldOpenDashboard) {
    try {
      const dashboardUrl = await getOrCreateDashboardPostUrl(subredditName);
      // Append username as query param so the WebView can read window.location.search
      const url = `${dashboardUrl}?username=${encodeURIComponent(username)}&subreddit=${encodeURIComponent(subredditName)}`;
      // Return navigateTo ALONE — combining with showToast can suppress navigation in some clients
      return c.json<any>({ navigateTo: url });
    } catch (err) {
      console.error('ContextLens: failed to open dashboard', err);
      return c.json<UiResponse>({
        showToast: modNoteAdded
          ? 'Mod note added, but failed to open dashboard. Please try again.'
          : 'Failed to open dashboard. Please try again.',
      });
    }
  }

  if (modNoteAdded) {
    return c.json<UiResponse>({ showToast: `Mod note added for u/${username}.` });
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
  let username = c.req.param('username');
  const subredditName = c.req.query('subredditName') ?? context.subredditName ?? '';

  // '__pending__' is sent by the WebView when no username is in the URL
  // (Devvit's iFrame URL doesn't forward Reddit post URL query params).
  // Resolve it from the Redis key the menu handler stored.
  if (username === '__pending__') {
    const userId = context.userId ?? '';
    const stored = await redis.get('contextlens:pending:' + userId);
    if (!stored) {
      console.error('ContextLens: /api/context/__pending__ — no pending user in Redis for userId:', userId);
      return c.json({ error: 'No pending user. Please re-open from the context menu.' }, 404);
    }
    username = stored;
  }

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

  console.log(`ContextLens server: received request ${method} ${url}`);

  const webReq = new Request(url, {
    method,
    headers,
    body: body ?? undefined,
  });

  try {
    const webRes = await app.fetch(webReq);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => res.setHeader(key, value));

    const responseBody = await webRes.arrayBuffer();
    res.end(Buffer.from(responseBody));
    console.log(`ContextLens server: responded with status ${webRes.status}`);
  } catch (error) {
    console.error('ContextLens server: error handling request', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(getServerPort(), () => {
  console.log(`ContextLens server listening on port ${getServerPort()}`);
});

