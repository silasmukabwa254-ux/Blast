# BLAST

BLAST is a website built with HTML, CSS, JavaScript, and a small Express backend for form submissions.

## Frontend

Use `index.html` for deployment.

## Backend

The backend lives in `backend/`.

### Run locally

1. Install Node.js.
2. Open a terminal in `backend/`.
3. Run `npm install`.
4. Start the server with `npm start`.
5. Open `http://localhost:3000/submissions` and sign in with `admin` / `blast123` if you did not set your own values.

### Deployment prep

- Set `PORT` on the host if needed.
- Set `ALLOWED_ORIGINS` to the frontend origin you want to allow.
- The backend now stores submissions in Render Postgres when deployed through the blueprint.
- The frontend join form reads `window.BLAST_JOIN_API_URL`, so point that at your deployed backend URL when you publish.
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` on the backend host before you open `/submissions` or `/api/submissions`.
- In production, the submissions pages are protected with HTTP Basic Auth.
- BLAST also includes a public feedback form on `feedback.html` and a protected review page at `/feedback`.
- Set `OPENAI_API_KEY` if you want the BLAST Bot to use the AI assistant mode.
- `BLAST_AI_MODEL` defaults to `gpt-5.4-mini` and can be changed later if you want a different model.
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `NOTIFY_TO_EMAIL` if you want email alerts for new submissions.
- `NOTIFY_FROM_EMAIL` is optional, but helps the email look cleaner.
- When SMTP is configured, BLAST sends an admin notification and a warm confirmation reply for join submissions. Feedback submissions also send a confirmation reply when the user includes an email address.
- The submissions and feedback dashboards also include a reply composer so you can answer people directly from the admin panel.

### Render deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and connect this repo.
3. Render will use `render.yaml` to deploy the backend from `backend/`.
4. Render will also create a Postgres database and connect it to the backend through `DATABASE_URL`.
5. After deploy, copy the Render service URL and update `window.BLAST_JOIN_API_URL` in the frontend to:
   `https://<your-render-service>.onrender.com/api/join`
6. Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Render service settings so the admin pages can be opened.
7. Add `OPENAI_API_KEY` in the Render service settings if you want the BLAST Bot to use OpenAI.
8. Add SMTP settings in the Render service settings if you want the backend to email you whenever someone submits the join form.

### API

- `GET /health`
- `GET /api/content`
- `GET /api/submissions`
- `GET /api/feedback`
- `POST /api/bot/chat`
- `POST /api/notifications/test`
- `PUT /api/content`
- `GET /api/content/export.json`
- `GET /submissions`
- `GET /feedback`
- `GET /content`
- `POST /api/join`
- `POST /api/feedback`
- `GET /submissions/export.csv`
- `GET /feedback/export.csv`

### Content management

- Open `/content` on the backend service after signing in with Basic Auth.
- Use it to edit the public homepage events and media without changing HTML.
- The homepage reads those sections from `/api/content`.
- Use `/api/content/export.json` to download a JSON backup of the homepage content.

## Quick Publish Options

### GitHub Pages

1. Create a new GitHub repository.
2. Add the remote:
   `git remote add origin <your-repo-url>`
3. Push:
   `git add .`
   `git commit -m "Initial BLAST site"`
   `git push -u origin main`
4. In GitHub, enable Pages from the `main` branch root.

### Netlify

1. Drag the project folder into Netlify Drop, or connect the GitHub repository.
2. No build command is needed.
3. Publish directory is the project root.
