# ClipForge

Turn streams into Shorts with AI.

Phase 1 is a local video studio: sign in, upload a source video, cut an exact timestamp range, and download a new H.264 MP4. The original file is not modified.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose **Start creating clips**. Without Supabase credentials, the studio creates a signed local session and stores projects in `data/db.json`. Uploads and renders stay on disk under `data/`.

Render jobs also run from a separate worker:

```bash
npm run worker
```

The web app starts a queued cut after the response is sent, so the worker is optional for local development.

## Checks

```bash
npm test
npx tsc --noEmit
npm run lint
```

`npm test` generates a 30-second sample, cuts seconds 10–25, and checks the MP4 with FFprobe.

## Credentials

Copy `.env.example` to `.env.local`. Nothing there is required for the local cut flow.

- `SESSION_SECRET` is required when `NODE_ENV=production`.
- Supabase Auth and the SQL migration in `supabase/migrations/0001_phase1.sql` are ready, and they are not used until the URL and publishable key are set.
- Cloudflare R2 signed upload and download URLs are implemented, and they are not used until the R2 variables are set. Local disk is the storage that the tests exercise.
- `GEMINI_API_KEY` is required before a YouTube link can be watched for highlights. `YOUTUBE_API_KEY` is optional and only adds duration metadata.

Do not commit real API keys.

## Phase 1 status

Working and covered by tests:

- Signed local session
- User-scoped video, job, render, and usage records
- Upload validation and FFprobe inspection
- FFmpeg timestamp cut to H.264/AAC MP4
- Playable download with range requests
- Usage seconds attributed to the owning user
- Another user cannot read those records through the store

YouTube links:

- Public watch, shorts, and youtu.be URLs are normalized.
- Title, creator, and thumbnail come from YouTube oEmbed when the video is public.
- Rendering is blocked until an uploaded source file is attached. Gemini does not supply that file.
- Highlight parsing is tested with a stand-in response. A live Gemini call has not been run, because that spends API credit.

Not verified against live services yet:

- A real Gemini YouTube watch with `GEMINI_API_KEY`
- Supabase login and Row Level Security on a hosted database
- Cloudflare R2 upload and download
- Multipart upload for very large files
