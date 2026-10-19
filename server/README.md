# Work Study — Backend API + PostgreSQL

Production setup designed for **two servers**:

- **DB server** — PostgreSQL 16 (holds the OB library + app data)
- **App server** — this Node API (+ the built web frontend)

```
  [ Web browser ] → [ App server: Node API + static web ] → [ DB server: PostgreSQL ]
                         VITE_API_URL                           DATABASE_URL
```

## 1. DB server (PostgreSQL)

Install PostgreSQL 16, then create the database and a least-privilege app user:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE workstudy LOGIN PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE workstudy OWNER workstudy;
SQL
```

Allow the app server to connect (in `postgresql.conf` set `listen_addresses='*'`, and add a
`hostssl workstudy workstudy <app-server-ip>/32 scram-sha-256` line to `pg_hba.conf`; reload).
Use SSL in production.

## 2. App server (this API)

```bash
cd server
cp .env.example .env            # set DATABASE_URL, API_PORT, CORS_ORIGIN, and a strong JWT_SECRET
npm ci
npm run migrate                 # applies db/migrations/*.sql
npm run seed                    # loads db/seed/machines.csv + ob_library.csv (37 + 13,759 rows)
npm run seed:users              # creates factories + the initial user accounts
npm start                       # serves the API on API_PORT (default 4000)
```

> **Secrets.** Set `JWT_SECRET` to a long random string (the server refuses to start without it):
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
> `npm run seed:users` writes each account's password to `server/SEED_CREDENTIALS.txt`
> (git-ignored, chmod 600) — hand them out securely and rotate after first login. Set
> `CORS_ORIGIN` to the exact web origin in production. There is no public sign-up; the admin
> seeds accounts.

Run it under a process manager (systemd or pm2) so it restarts on crash/boot. Example systemd unit:

```ini
[Unit]
Description=Work Study API
After=network.target
[Service]
WorkingDirectory=/opt/workstudy/server
EnvironmentFile=/opt/workstudy/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
User=workstudy
[Install]
WantedBy=multi-user.target
```

## 3. Frontend (same app server)

```bash
cd ../workstudy-demo
echo "VITE_API_URL=https://api.your-domain" > .env.production
npm ci && npm run build          # outputs dist/
```

Serve `workstudy-demo/dist` with nginx/Caddy on the app server, and reverse-proxy `/api` to the
Node API (or point `VITE_API_URL` straight at the API host). Set the API's `CORS_ORIGIN` to the
web origin.

## API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | — | liveness + DB check |
| GET | `/api/machines` | — | machine code → full name (37) |
| GET | `/api/ob-library/options` | — | cascading dropdown values |
| GET | `/api/ob-library` | — | filtered, paginated process search |
| POST | `/api/auth/login` | — | `{username,password}` → `{token,user}` |
| GET | `/api/auth/me` | Bearer | restore session from a token |
| GET | `/api/styles` | Bearer | styles visible to the user (factory-scoped) |
| POST | `/api/styles` | Bearer · `orderCreate` | create an order |
| GET/PATCH | `/api/styles/:id` | Bearer | read / merge-patch (sensitive transitions are RBAC-gated) |
| GET | `/api/operators` | Bearer | operators for the user's factory |
| PUT/POST/DELETE | `/api/operators/:factory` | Bearer · `operatorManage` | replace / append / clear |

Auth is a signed JWT in `Authorization: Bearer <token>` (8h default). RBAC is enforced
server-side in `src/rbac.js` + `src/auth.js` — e.g. a WSE gets `403` trying to approve an OB.
Non-cross-factory users only ever see and touch their own factory's data.

## Updating the OB library

Replace `db/seed/ob_library.csv` (columns: `category,product_type,fabric_type,section,process_name,machine_type,smv`)
and re-run `npm run seed` (it truncates and reloads). The schema, indexes and trigram search handle
the full ~13.7k-row library with sub-millisecond filtered queries.

## Schema

`db/migrations/001_init.sql` — `machines`, `ob_library` (indexed + `pg_trgm` for search), plus the
app tables (`factories`, `lines`, `users`, `operators`, `styles`, `style_operations`, `style_lines`,
`audit_log`) ready for the app-data API (next phase; the web app currently keeps per-session state
client-side and reads the OB library from this API).
