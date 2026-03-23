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

### Render deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and connect this repo.
3. Render will use `render.yaml` to deploy the backend from `backend/`.
4. Render will also create a Postgres database and connect it to the backend through `DATABASE_URL`.
5. After deploy, copy the Render service URL and update `window.BLAST_JOIN_API_URL` in the frontend to:
   `https://<your-render-service>.onrender.com/api/join`
6. Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Render service settings so the admin pages can be opened.

### API

- `GET /health`
- `GET /api/submissions`
- `GET /submissions`
- `POST /api/join`

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
