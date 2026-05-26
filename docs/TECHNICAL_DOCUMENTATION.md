# Technical Documentation

## Overview

The India Temple Heritage & Pilgrimage Information Portal is a fullstack web application with a Node.js backend, a static responsive frontend, and a JSON data store. It is designed as a Phase 1 deployment-ready implementation that can later migrate to Express.js and MongoDB/PostgreSQL without changing the main product concepts.

## Architecture

```text
Browser
  |
  | Static files and REST calls
  v
Node.js HTTP Server
  |
  | Read/write JSON
  v
data/temples.json
```

## Technology Stack

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js built-in HTTP server
- Database: JSON file store for Phase 1
- Deployment: Any Node.js host

## Backend

The backend is implemented in `server.js`.

### Responsibilities

- Serve static frontend assets from `public/`.
- Provide public temple search APIs.
- Provide metadata APIs for filters and KPIs.
- Manage admin sessions with secure HTTP-only cookies.
- Validate temple payloads.
- Persist temple data to `data/temples.json`.

### Authentication

Admin authentication uses credentials from environment variables:

- `ADMIN_USER`
- `ADMIN_PASS`

If not set, the development defaults are:

- `admin`
- `admin123`

Successful login creates an in-memory session token and stores it in an HTTP-only cookie. Because sessions are in memory, users must log in again after a server restart.

### API Endpoints

#### Health

`GET /api/health`

Returns service status.

#### Metadata

`GET /api/metadata`

Returns available states, cities, deities, circuits, and KPI counts for approved temples.

#### Temple Search

`GET /api/temples`

Query parameters:

- `q`
- `state`
- `city`
- `deity`
- `circuit`
- `featured=true`
- `includePending=true` for authenticated admins only

#### Temple Detail

`GET /api/temples/:id`

Returns a single approved temple. Admins can view pending records.

#### Admin Login

`POST /api/admin/login`

Payload:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

#### Admin Logout

`POST /api/admin/logout`

Clears the admin session cookie.

#### Admin Session

`GET /api/admin/me`

Returns whether the current browser session is authenticated.

#### Create Temple

`POST /api/admin/temples`

Requires admin login.

#### Update Temple

`PUT /api/admin/temples/:id`

Requires admin login.

#### Delete Temple

`DELETE /api/admin/temples/:id`

Requires admin login.

## Data Model

Temple records are stored as an array in `data/temples.json`.

```json
{
  "id": "kashi-vishwanath",
  "name": "Kashi Vishwanath Temple",
  "state": "Uttar Pradesh",
  "city": "Varanasi",
  "deity": "Shiva",
  "circuit": "Jyotirlinga Circuit",
  "image": "https://example.com/image.jpg",
  "featured": true,
  "approved": true,
  "history": "Historical background...",
  "significance": "Religious significance...",
  "darshanTimings": "3:00 AM - 11:00 PM",
  "rituals": ["Mangala Aarti"],
  "festivals": ["Mahashivratri"],
  "guidelines": ["Carry identity proof"],
  "facilities": ["Railway station nearby"],
  "updatedAt": "2026-05-26T00:00:00.000Z"
}
```

## Frontend

The frontend lives in `public/`.

### Files

- `index.html`: semantic page structure and sections
- `styles.css`: responsive layout and culturally respectful visual system
- `app.js`: API integration, filtering, detail rendering, saved temples, sharing, and admin UI

### Public User Flow

1. User lands on the hero page.
2. User searches or browses by filters.
3. User opens temple detail.
4. User reviews history, rituals, festivals, timings, guidelines, and facilities.
5. User saves or shares temple information.

### Admin User Flow

1. Admin logs in.
2. Admin creates or edits a temple record.
3. Admin approves the record for public visibility.
4. Admin marks important records as featured when needed.

## Security Considerations

- Admin write APIs require a valid session.
- Admin session cookies are HTTP-only and SameSite=Lax.
- Payloads are validated for required fields.
- Static file serving prevents directory traversal by checking resolved paths.

## Performance Considerations

- No external JavaScript dependencies.
- Static assets are cached for one hour.
- API responses are small JSON payloads.
- Images are loaded lazily in temple cards.

## Scalability Path

For larger production use:

- Replace JSON file persistence with MongoDB or PostgreSQL.
- Add role-based admin permissions.
- Move sessions to Redis or database-backed storage.
- Add content source attribution and verification history.
- Add indexed search with PostgreSQL full-text search or Elasticsearch.
- Add CDN image hosting and asset optimization.

## Local Development

```bash
npm start
```

Visit `http://localhost:3000`.

## Deployment Checklist

- Set `ADMIN_USER` and `ADMIN_PASS`.
- Ensure Node.js 18 or newer.
- Configure persistent storage if editing content in production.
- Serve behind HTTPS.
- Add regular data backups.
- Verify temple information before approving public records.
