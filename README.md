# Jobs in Germany

An animated job portal in the colours of the German flag. Candidates can browse jobs and apply online with their CV, and admins manage everything from a built-in admin panel.

## Features

**Public website**
- Animated homepage: rotating city names, floating cards, scroll-reveal sections, count-up stats, a city ticker and category cards
- Job listing with live search and filters (city, category, job type, work mode, experience, visa sponsorship), plus sorting
- Job detail page with an application form: drag & drop CV upload (PDF/DOC/DOCX, max 5 MB), upload progress bar, validation and a success animation
- Duplicate-application check, honeypot spam protection and rate limiting
- Responsive on mobile; honours `prefers-reduced-motion`

**Admin panel** (`/admin`)
- Dashboard: key numbers, applications over the last 14 days, the hiring pipeline, top jobs and the latest applications
- Jobs: create, edit, duplicate and delete jobs, change status (active / draft / closed) and mark jobs as featured
- Applications: search and filter by job and status, change status (new → reviewing → shortlisted → interview → offered → hired / rejected), add internal notes, view or download CVs, and delete applications
- Downloads: **Export CSV** (opens in Excel) and **Download all (ZIP)**, which contains the CSV plus every CV. Both follow the current job and status filters.

## Setting up MongoDB Atlas

All data is stored in MongoDB Atlas: jobs, applications, admin sessions and the uploaded CVs (CVs are stored with GridFS). Your web host doesn't need any disk storage of its own.

1. **Create a cluster.** Sign in at https://cloud.mongodb.com and create a cluster. The free M0 tier is enough to start.
2. **Create a database user.** Go to **Database Access → Add New Database User**, choose password authentication and give the user the *Read and write to any database* role. Note the username and password.
3. **Allow your server to connect.** Go to **Network Access → Add IP Address** and add your server's IP address. For local testing, *Add Current IP Address* is enough. Some hosts (Render, Railway) have no fixed IP; for those you'll need `0.0.0.0/0` (allow from anywhere), so use a strong database password.
4. **Copy the connection string.** On your cluster, click **Connect → Drivers** and copy the `mongodb+srv://…` string.
5. **Configure the app.** Copy `.env.example` to `.env` and paste the string into `MONGODB_URI`, replacing `<username>` and `<password>`. If the password contains special characters such as `@ : / ? #`, URL-encode them (for example `@` becomes `%40`).

On first start the app creates the `jobsingermany` database, sets up its indexes and adds 10 sample jobs from fictional companies. You can edit or delete them in the admin panel.

## Running it

You need Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and ADMIN_PASSWORD
npm start
```

Then open http://localhost:3000. The admin panel is at http://localhost:3000/admin. `GET /api/health` reports whether the database is reachable, which is useful for your host's health checks.

If the app can't connect, it stops with a message. The usual causes are a wrong username or password in `MONGODB_URI`, or the server's IP address not being on the Atlas Network Access list.

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | *(required)* | Your MongoDB Atlas connection string |
| `MONGODB_DB` | `jobsingermany` | Database name |
| `ADMIN_USERNAME` | `admin` | Admin login name |
| `ADMIN_PASSWORD` | `admin123` | Admin password. **Change it before going live.** The panel shows a warning while the default is in use. |
| `PORT` | `3000` | HTTP port |
| `DNS_SERVERS` | *(system DNS)* | DNS servers for the Atlas address lookup, for example `8.8.8.8,1.1.1.1`. See Troubleshooting. |
| `TRUST_PROXY` | *(off)* | Set to `1` behind a hosting proxy (Render, Railway, Heroku, Nginx) so rate limits see visitors' real IPs |

Settings can go in `.env` or be set as environment variables in your hosting dashboard. Never commit `.env`; it is already in `.gitignore`.

## Troubleshooting

The app prints a hint under the error message when it can't connect. The common cases:

**`querySrv ECONNREFUSED _mongodb._tcp.…`**
Your computer's DNS server refused the special lookup ("SRV record") that `mongodb+srv://` addresses need. This often happens on Windows with some home routers, ISPs and VPNs. It is not a password or IP access problem. The app automatically retries with Google and Cloudflare DNS. If it still fails, try these in order:

1. Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `.env`.
2. Change your computer's DNS to `8.8.8.8` and `1.1.1.1`. On Windows: *Settings → Network & internet → your connection → DNS server assignment → Edit → Manual*. Or turn off your VPN.
3. Use the standard connection string, which needs no SRV lookup. In Atlas, go to *Connect → Drivers*, choose Node.js version **2.2.12 or later**, and copy the `mongodb://…:27017,…` string. It is long, but it works on any network.

**`getaddrinfo ENOTFOUND ac-…-shard-00-00….mongodb.net`**
Same cause, one step later: the cluster was found, but your DNS can't look up its database servers. The app also retries these lookups with public DNS automatically. If it still fails, use the same three fixes as above.

**`querySrv ENOTFOUND` / `ENODATA`:** the cluster address is wrong. Copy the connection string from Atlas again.

**`bad auth` / `Authentication failed`:** wrong database username or password. This is the user from *Database Access*, not your Atlas account login. Special characters in the password must be URL-encoded.

**`Server selection timed out`:** Atlas isn't letting your IP address in (*Network Access*), or your network blocks outgoing port 27017. Some office and school networks do.

## Deployment notes

- This is a Node.js app, not a static site. It needs a host that runs Node (Render, Railway, Fly.io, a VPS and so on). Set the variables above in the host's dashboard.
- Atlas backs up paid clusters automatically. On the free tier, export your data now and then (Atlas → your cluster → *Browse Collections*, or `mongodump`).
- Serve the site over HTTPS. Behind a reverse proxy, the session cookie is marked `Secure` automatically.
- CVs contain personal data. Make sure your privacy policy covers how they are stored (GDPR). For EU data residency, pick an EU region (for example Frankfurt) when you create the Atlas cluster.

## Project structure

```
server.js            Express server and REST API
lib/store.js         MongoDB data layer (collections + GridFS for CVs)
lib/auth.js          Admin login, sessions and lockout after failed attempts
lib/seed.js          Sample jobs
public/              Website (HTML/CSS/JS, no build step)
  index.html         Homepage
  jobs.html          Job listing
  job.html           Job detail and application form
  admin/             Admin panel
  assets/            Logo variants and favicon
```
