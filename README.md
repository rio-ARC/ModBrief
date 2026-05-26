# ContextLens

**ContextLens** is a Reddit Devvit moderation app built for the Reddit Mod Tools Hackathon.

The single most important design principle behind ContextLens: **Compress a 4-minute moderator investigation into a 30-second panel read.**

When a moderator right-clicks any post or comment and selects "View user context", a welcome modal or a context form opens instantly, summarizing user history. The moderator can toggle a dashboard check to navigate directly to the interactive full dashboard embedded on a custom post.

## Features

- **Instant Context**: Right-click context menu integration for Posts and Comments.
- **Narrative Engine**: Generates a quick 30-second summary of a user's recent activity and moderation history.
- **Signal Scoring**: Highlights concern/watch/clean signals such as posting bursts, new account status, low karma, or recent removals.
- **Interactive Full Dashboard**: Hosts a dedicated, custom post-embedded dashboard where moderators can view detailed signal grids, action logs, and history tabs.
- **First-Launch Onboarding**: Greets moderators with a welcome form on their first run to introduce features and direct usage.
- **Quick Actions**: Add moderation notes, remove content, or ban users directly from the context modal or the interactive dashboard.
- **Toolbox Integration**: Parses existing Toolbox usernotes.

## Tech Stack & Architecture

- **Devvit Platform**: Reddit's developer platform for custom apps, UI forms, and background jobs.
- **Hono (v4.4)**: A fast, lightweight web framework used for routing client-side API calls inside Devvit.
- **React & Vite**: Powers the frontend WebView panel, rendering styled tables, signal badges, and interactive controls.
- **esbuild**: Used for custom bundling of the Node.js server to ensure compatibility within the sandboxed Devvit execution runtime.
- **Redis KV Cache**: Caches fetched user history profiles to improve performance, and manages transient moderator session data:
  - When the context menu is clicked, user and post metadata are cached in Redis keyed under the moderator's `userId`.
  - When the WebView iframe loads inside the custom post (where Reddit does not forward query parameters), the client queries the `/api/pending-user` endpoint to resolve the active context seamlessly.

## Project Structure

```
ModBrief/
├── src/
│   ├── client/       # React frontend for the WebView panel
│   │   ├── components/
│   │   ├── panels/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── server/       # Hono backend and Devvit integration
│   │   ├── index.ts  # Main Devvit/Hono entry point
│   │   ├── contextAggregator.ts
│   │   ├── narrativeEngine.ts
│   │   └── signalScorer.ts
│   └── shared/       # Shared types between client and server
├── assets/           # App icons
├── devvit.json       # Devvit app configuration
├── package.json      # Node.js dependencies and build scripts
└── tsconfig.json     # Compiler rules
```

## Setup & Deployment

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Local Development (Client)**
   ```bash
   npm run dev
   ```

3. **Build the Project**
   This compiles both the Vite client and the esbuild server bundle.
   ```bash
   npm run build
   ```

4. **Upload to Devvit**
   Ensure you have the Devvit CLI installed and authenticated.
   ```bash
   npx devvit upload
   ```

5. **Install on a Test Subreddit**
   ```bash
   npx devvit install r/<your_test_subreddit>
   ```

## License

MIT
