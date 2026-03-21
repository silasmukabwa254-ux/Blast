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

### Deployment prep

- Set `PORT` on the host if needed.
- Set `ALLOWED_ORIGINS` to the frontend origin you want to allow.
- The frontend join form reads `window.BLAST_JOIN_API_URL`, so point that at your deployed backend URL when you publish.

### Render deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and connect this repo.
3. Render will use `render.yaml` to deploy the backend from `backend/`.
4. After deploy, copy the Render service URL and update `window.BLAST_JOIN_API_URL` in the frontend to:
   `https://<your-render-service>.onrender.com/api/join`

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
