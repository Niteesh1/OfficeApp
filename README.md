# Office Chores (Full Stack)

This repo now has a full-stack version of the chore calendar.

## Structure
- `frontend/` React app (Vite)
- `backend/` Node + Express + SQLite API
- `index.html` / `app.js` / `styles.css`: the original single-file prototype (still here)

## Backend (Node + SQLite)

1) Create env file from the template:

```
copy backend\.env.example backend\.env
```

2) Install deps and run:

```
cd backend
npm install
npm run dev
```

The API runs on `http://localhost:8081`.

### Auth
- Dev mode uses `DEV_BYPASS_AUTH=true` in `backend/.env`.
- For production, set `GOOGLE_CLIENT_ID` and set `DEV_BYPASS_AUTH=false`.
- The backend expects a Google ID token in the `Authorization: Bearer <token>` header.

## Frontend (React)

1) Create env file from the template:

```
copy frontend\.env.example frontend\.env
```

2) Install deps and run:

```
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173` and talks to the backend using `VITE_API_URL`.

## Single-Image Docker

This branch includes a single Docker image that serves both the API and the built frontend.

Build and run:

```
docker build -t officeapp:single .
docker run --rm -p 4000:4000 -e DEV_BYPASS_AUTH=true officeapp:single
```

Open `http://localhost:4000`.

## Deploy

### Frontend to GitHub Pages
- Build:

```
cd frontend
npm run build
```

- Set `base` in `frontend/vite.config.js` to `/<repo-name>/` before building.
- Push `frontend/dist` to a `gh-pages` branch (or use a GitHub Action).

### Backend to Fly.io
- Install flyctl, then from `backend/`:

```
fly launch
fly secrets set GOOGLE_CLIENT_ID=... CORS_ORIGIN=https://your-frontend
fly deploy
```

- Set `DATABASE_PATH` to a Fly volume path if you want persistence.

## Notes
- The backend currently returns all chores; the React app handles recurrence display.
- If you want multi-user sharing beyond Google auth, we can add team orgs and roles.

## Branch Guide

- `main`: Original local setup (run frontend + backend separately with npm).
- `docker-tesing`: Docker Compose setup with separate frontend and backend containers.
- `docker-live`: Single Docker image that serves both API and frontend on one port.

## Session Notes

- Docker Compose (branch `docker-tesing`):
  - Frontend: `http://localhost:3000`
  - Backend: `http://localhost:3001/api/health`
  - Run: `docker compose up --build`
- Single image (branch `docker-live`):
  - Build: `docker build -t officeapp:single .`
  - Run: `docker run --rm -p 4000:4000 -e DEV_BYPASS_AUTH=true officeapp:single`
  - URL: `http://localhost:4000`
- Render/Netlify deploy:
  - Backend URL example: `https://officeapp-....onrender.com`
  - Frontend env var: `VITE_API_URL=<backend-url>`
  - Backend env var: `CORS_ORIGIN=<netlify-url>`
