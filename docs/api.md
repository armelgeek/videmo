# Public API

Pro and Enterprise organizations can call the app's endpoints with an API key instead of a browser session.

- Create a key in **Account → API Keys**. It acts on the organization that was active when it was created, spends that organization's credits and follows its plan limits.
- Send it on every request: `Authorization: Bearer sk_live_…`.
- A revoked key, a key whose owner left the organization, or an organization whose plan no longer includes API access gets `401` / `403`.
- Managing keys (`/api/api-keys`) is session-only: a key cannot create or revoke keys.

## Endpoints

| Step | Method & path | Body |
|---|---|---|
| List / create projects | `GET` / `POST /api/video-projects` | see `lib/video-project/schema.ts` |
| Read / update a project | `GET` / `PATCH /api/video-projects/{id}` | |
| Write a script | `POST /api/generate-script` | `{ content, format?, language?, duration? }` |
| Split it into scenes | `POST /api/generate-storyboard` | `{ script, duration, ... }` |
| Illustrate a scene | `POST /api/generate-images` | `{ projectId, sceneIndex, prompt, aspectRatio }` |
| Voice a scene | `POST /api/generate-narration` | `{ projectId, sceneIndex, text, voice }` |
| Export the video | `POST /api/whiteboard/render` | `{ projectId, quality, aspectRatio, project }` → `202 { jobId }` |
| Follow the export | `GET /api/whiteboard/render/{jobId}` | → `{ status, progress }` |
| Download it | `GET /api/whiteboard/render/{jobId}/file` | MP4, kept 24 h |

Request bodies are validated with the zod schemas at the top of each route file.

## Example

```bash
curl -X POST "$APP_URL/api/generate-script" \
  -H "Authorization: Bearer $SKETCHPILOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Explain compound interest to first-time savers in one minute"}'
```

Errors follow the app's format: `{ "error": "..." }`, with `code: "insufficient_credits"` (402), `"quota_exceeded"` or `"feature_unavailable"` (403) for plan limits.
