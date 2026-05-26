# India Temple Heritage & Pilgrimage Information Portal

A fullstack web portal for discovering temples across India with historical context, deity details, rituals, festivals, darshan timings, visitor guidelines, nearby facilities, saved temples, sharing, and admin content approval.

## Features

- Responsive public portal for desktop and mobile
- State, city, deity, keyword, featured, and circuit-based discovery
- Temple detail pages with history, significance, rituals, festivals, timings, guidelines, and facilities
- Saved temples using browser local storage
- Share action through native share API or clipboard fallback
- Admin login, temple creation, editing, deletion, approval, and featured management
- JSON-backed data store for simple Phase 1 deployment and easy migration to MongoDB or PostgreSQL later

## Quick Start

```bash
npm start
```

Open `http://localhost:3000`.

Default admin credentials:

- Username: `admin`
- Password: `admin123`

For deployment, set stronger credentials:

```bash
ADMIN_USER=your-user ADMIN_PASS=your-strong-password npm start
```

On Windows PowerShell:

```powershell
$env:ADMIN_USER="your-user"
$env:ADMIN_PASS="your-strong-password"
npm start
```

## Project Structure

```text
.
├── data/
│   └── temples.json
├── docs/
│   ├── PRD.md
│   └── TECHNICAL_DOCUMENTATION.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
└── server.js
```

## API Overview

- `GET /api/health`
- `GET /api/metadata`
- `GET /api/temples`
- `GET /api/temples/:id`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `POST /api/admin/temples`
- `PUT /api/admin/temples/:id`
- `DELETE /api/admin/temples/:id`

## Deployment Notes

This project uses only Node.js built-in modules, so it does not require package installation. It can be deployed to any Node-compatible host. For Vercel/Netlify-style serverless hosting, the backend can be adapted into serverless functions and the `public` directory can remain the static frontend.
