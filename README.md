# LUXCV - Premium Resume Builder (with accounts)

The original static frontend (HTML, CSS, vanilla JS, 10 templates) now sits in `public/`
behind an Express + MongoDB backend in `server/`.

## Setup

```bash
npm install
cp .env.example .env          # then edit MONGODB_URI and JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste as JWT_SECRET
npm run create-admin -- --email admin@example.com --name "Site Admin" --password "ChangeMe123"
npm start                     # http://localhost:3000
```

Requires Node 18+ and a MongoDB (local `mongodb://127.0.0.1:27017/luxcv` or Atlas).
Open the site through the server (`http://localhost:3000`), not by double-clicking the HTML files.

Admins cannot be created from the website. Use `npm run create-admin`; running it for an
existing email promotes that account.

## Layout

```
server/  app.js server.js config.js
         models/ User.js Resume.js
         middleware/ auth.js (protect, isAdmin, adminAuthMiddleware)  csrf.js  pageGate.js
         routes/ auth.js resumes.js admin.js
         utils/ validate.js token.js pathGuard.js csp.js
         scripts/createAdmin.js
public/  (existing frontend)  + auth.html dashboard.html admin.html
         js/ auth-client.js auth-gate.js auth-page.js cloud-sync.js dashboard.js admin.js
         css/account.css
tests/   unit.test.js  e2e/
```

## API

| Method | Path | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public (rate limited) |
| POST | /api/auth/logout | anyone (clears cookie) |
| GET | /api/auth/me | logged in |
| GET/POST | /api/resumes, GET /api/resumes/latest | logged in (own resumes only) |
| GET/PUT/DELETE | /api/resumes/:id | owner only (others get 404) |
| GET | /api/admin/users?page&limit&q&status | admin |
| PUT | /api/admin/users/:id/status `{isActive}` | admin |
| DELETE | /api/admin/users/:id (cascades resumes) | admin |

## Security notes

- bcrypt (cost 12); JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- The token holds only the user id. Role and `isActive` are re-read from the database on every
  request, so deactivating or deleting a user locks them out immediately.
- `builder.html`, `dashboard.html`, `admin.html` and their scripts (including jsPDF/html2canvas)
  are not sent without a valid session (`pageGate.js`); admin files need role `admin`.
- State-changing API calls require an `X-Requested-With: luxcv` header (CSRF), CSP via helmet,
  login/register rate limit, generic login errors, NoSQL-injection and oversized-payload checks.
- PDF/print export is generated in the browser. It is protected by gating the code and by
  re-verifying the session with the server before each export; it cannot be fully server-enforced
  without moving PDF rendering to the server.
- Behind HTTPS in production set `NODE_ENV=production` (and `TRUST_PROXY=1` behind a proxy).

## Tests

```bash
npm test                      # unit tests, no database needed
npm i -D playwright && npx playwright install chromium
npm run test:e2e              # browser tests (use an in-memory stand-in API, no MongoDB needed)
```

## Manual test checklist

Logged out: no Login/Sign up/Register/Log out anywhere public; browse + preview works; "Use Template"
→ `/auth.html?next=/builder.html?template=<id>`; typing `/builder.html` directly redirects to auth.
Register/Login → lands in the builder on that template; edits appear in MongoDB `resumes`.
Logged in: "Use Template" opens the builder directly; Dashboard → Open/Delete/Log out.
Admin (`create-admin`): login → `/admin.html`; deactivate a user (their next request fails),
reactivate, delete (their resumes disappear); a normal user hitting `/admin.html` or `/api/admin/users`
gets redirected / 403.
