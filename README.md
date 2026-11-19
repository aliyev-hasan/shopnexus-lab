# ShopNexus — Intentionally Vulnerable E-Commerce Lab

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Purpose: security training](https://img.shields.io/badge/purpose-security%20training-red)](#-warning)

> ## ⚠️ WARNING
> **ShopNexus is intentionally vulnerable. It is a training target, not a real product.**
> Run it **only** on your own machine, in an isolated/local environment.
> Never deploy it to a public server, never expose it to the internet, and never reuse
> its credentials or secrets anywhere else.

ShopNexus is a fully working multi-vendor e-commerce platform (Node.js + Express + EJS + NeDB)
that has been **deliberately seeded with 15 security vulnerabilities** — 5 easy, 5 medium and
5 hard. Everything a normal shop needs works: registration, vendor stores, catalog and search,
cart, coupons, wallet, card checkout with OTP, orders, receipts with QR verification, refunds,
gift cards, reviews, Q&A, support tickets, notifications and a full admin console.

The application is meant to be *used* like a real shop while you hunt for the planted flaws.
It is aimed at:

- **Pentesters / AppSec engineers** practising web exploitation against a realistic multi-role app
- **Students and self-learners** working through OWASP-style vulnerability classes
- **Instructors** running secure-coding or capture-the-flag style workshops
- Anyone who wants a safe, local target for Burp Suite, ZAP, curl or Postman

A high-level challenge overview (difficulty tiers and vulnerability classes only, **no
locations and no solutions**) lives in [`CHALLENGES.md`](CHALLENGES.md).

---

## Features

### Application

- **Three separate portals** — Customer (`/auth/login`), Vendor (`/auth/vendor/login`) and
  Admin (`/auth/admin/login`), each with its own cookie and landing page
- **Multi-vendor marketplace** — 8 demo stores, per-vendor dashboards, product CRUD,
  vendor questions and answers
- **Catalog** — categories, search, price/brand filters, sorting, featured products
- **Shopping** — cart, wishlist, coupon codes, first-order and usage-limited promotions
- **Checkout** — wallet balance, saved cards, simulated card payments, OTP confirmation step
- **Post-purchase** — order history and search, status tracking, refunds, QR-verified receipts
- **Money features** — wallet top-up, gift cards, cashback, admin commission settings
- **Engagement** — product reviews, ratings, support tickets, in-app notifications
- **Admin console** — users, vendors, products, coupons, refunds, payments, platform settings
- **i18n** — Azerbaijani, English and Russian locales
- **Storage** — embedded NeDB files in `data/`, so there is no database to install

### Deliberately planted vulnerabilities

This lab contains 15+ deliberately planted vulnerabilities across easy, medium and hard
difficulty levels, covering common web security classes. Exact locations and types are not
disclosed here — finding them is part of the exercise.

Additional hardening gaps exist beyond the 15 headline challenges — treat any suspicious
behaviour as fair game.

---

## Requirements

- **Node.js 18 or newer** (20 / 22 LTS recommended)
- **npm** (bundled with Node.js)
- A modern browser

```bash
node -v
npm -v
```

No external database, message broker or network access is required.

---

## Installation

```bash
git clone https://github.com/aliyev-hasan/shopnexus-lab.git
cd shopnexus-lab
npm install
```

Create the local configuration file from the template:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env

# Windows cmd
copy .env.example .env
```

Start the server:

```bash
npm start
```

Then open **<http://localhost:3000>**.

### Development mode (auto-restart)

```bash
npm run dev
```

---

## Configuration

All configuration lives in `.env` (git-ignored). `.env.example` contains safe lab defaults.

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Runtime mode. Keep `development` for the lab. |
| `PORT` | `3000` | HTTP port the server listens on. |
| `PUBLIC_BASE_URL` | *(empty)* | Absolute base URL used in receipt/QR links. When empty, links are built from the incoming request host — the right behaviour for local experimenting. |
| `JWT_SECRET` | `development-only-jwt-key` | Development-only signing key. Do not reuse this value in any other project. |
| `SESSION_SECRET` | `development-only-session-key` | Signing key for the Express session cookie. Lab value only. |
| `DEMO_ACCOUNT_PASSWORD` | `ShopNexusLab2026!` | Only used by the seed scripts (`npm run seed`, `npm run seed:marketplace`). Does not affect the credentials below unless you reseed. |

> Every secret in `.env.example` is a **dummy**. Do not copy them into any other project.

### Changing the port

Edit `.env`:

```env
PORT=4000
```

or override it for a single run:

```bash
# PowerShell
$env:PORT=4000; npm start

# cmd
set PORT=4000 && npm start

# bash
PORT=4000 npm start
```

---

## Default Credentials

The repository ships with a pre-seeded database in `data/`, so every account below works
**immediately after `npm install` + `npm start`** — no seeding step needed.

| Role | Portal / login URL | Email | Password |
|------|--------------------|-------|----------|
| **Admin** | `/auth/admin/login` | `admin@shopnexus.cyou` | `7#8R5T#*ww9Aq*` |
| **Customer** | `/auth/login` | `customer@shopnexus.cyou` | `v5sr6tEGQn*!KT` |
| **Vendor** (demo store) | `/auth/vendor/login` | `vendor@shopnexus.cyou` | `ZHTsN&$3dnFKU!` |
| Vendor — Apple Store Baku | `/auth/vendor/login` | `apple@shopnexus.cyou` | `Qv&XSxAvN*G*8m` |
| Vendor — Samsung Store | `/auth/vendor/login` | `samsung@shopnexus.cyou` | `E5yEtgD%Xh#Vc!` |
| Vendor — Xiaomi Store | `/auth/vendor/login` | `xiaomi@shopnexus.cyou` | `eS&kfXpCa3S#8L` |
| Vendor — PC Arena Pro | `/auth/vendor/login` | `pcarena@shopnexus.cyou` | `tsp@Gk5rN3h@xn` |
| Vendor — SportHub | `/auth/vendor/login` | `sporthub@shopnexus.cyou` | `^cLNG8e*yfdtf6` |
| Vendor — Moda Avenue | `/auth/vendor/login` | `moda@shopnexus.cyou` | `t^GMe8aF8&6rX3` |
| Vendor — Nordic Home | `/auth/vendor/login` | `home@shopnexus.cyou` | `@T!^ZLEq^d8$KV` |
| Vendor — Beauty Lab | `/auth/vendor/login` | `beauty@shopnexus.cyou` | `xW&h3Et%4^S6JN` |

Full URLs (default port): `http://localhost:3000/auth/admin/login`,
`http://localhost:3000/auth/login`, `http://localhost:3000/auth/vendor/login`.

> Passwords contain symbols (`#`, `$`, `&`, `*`, `!`, `^`, `@`). Copy-paste them exactly —
> do not retype them by hand.

**After reseeding**, all demo accounts get the `DEMO_ACCOUNT_PASSWORD` value from `.env`
instead of the individual passwords above.

---

## Usage / Getting Started

1. Start the app with `npm start` and open **<http://localhost:3000>**.
2. Browse the storefront anonymously — catalog, product pages, search and filters.
3. Log in as the **Customer** at `/auth/login` and walk through the shopping flow:
   cart → coupon → checkout (wallet or card) → OTP → order → receipt/QR.
4. Log in as a **Vendor** at `/auth/vendor/login` and open `/vendor/dashboard`:
   products, questions, coupons and store settings.
5. Log in as the **Admin** at `/auth/admin/login` and open `/admin`:
   users, vendors, coupons, refunds, payments and platform settings.
6. Compare what each role can reach. Watch the requests in your proxy of choice
   (Burp Suite, ZAP, DevTools) and try to move outside your own account.

Handy starting routes:

| Route | What it is |
|-------|------------|
| `/` | Storefront home |
| `/products` | Catalog with search and filters |
| `/cart` | Cart and coupon application |
| `/checkout` | Checkout flow |
| `/orders` | Customer order history |
| `/wallet` | Wallet, top-up, gift cards |
| `/vendor/dashboard` | Vendor console |
| `/admin` | Admin console |

> **Use `http://localhost:3000`, not a LAN IP such as `192.168.x.x`.**
> Auth cookies are issued with the `Secure` flag, so browsers will not store them over
> plain HTTP on a non-localhost host — you would end up in a login loop.

### Resetting the lab

The shipped `data/` directory is the "clean" starting state. After experimenting:

```bash
git restore data
```

To rebuild the catalog, orders and promotions from scratch (users are kept):

```bash
npm run seed
npm run seed:marketplace   # rebuild the 8 demo vendor stores
```

Both seed scripts require `DEMO_ACCOUNT_PASSWORD` in `.env`.

---

## Project Structure

```
app.js                 Express app, middleware and route mounts
config/                database, JWT, session, multer, public-URL configuration
controllers/           request handlers / business logic
routes/                Express routers (customer, vendor, admin, debug)
models/                NeDB data models
services/              payments, receipts, pricing, notifications, auth sessions
middlewares/           auth, i18n, upload and session middleware
views/                 EJS templates
public/                static assets and uploaded files
data/                  NeDB database files (seeded demo state)
scripts/               seed, migration and static-check scripts
locales/               AZ / EN / RU translations
seed.js                base demo data (users, catalog, categories)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login redirects back to the login page | Open the app via `http://localhost:3000`, not a LAN IP. Clear cookies for `localhost`. |
| `EADDRINUSE` on start | Another process is using the port — set a different `PORT` in `.env`. |
| Empty catalog or vendor dashboards | Run `npm run seed` and `npm run seed:marketplace`. |
| Stale/locked data | Stop the server, delete `data/*.db~` temp files, restart. |
| `npm install` issues | Use Node.js 18+ and delete `node_modules` + `package-lock.json` only if you know what you are doing. |

---

## ⚠️ Warning / Disclaimer

This project is **intentionally insecure by design**. It exists to be attacked.

- Run it **only** on your own machine or in a disposable, isolated VM/container.
- **Never** deploy it to production, a public VPS, a shared host, or any network reachable
  by untrusted users.
- **Never** reuse the demo credentials, JWT/session secrets, or database files in another
  project.
- **Never** point these techniques at systems you do not own or have explicit written
  permission to test. Unauthorized access to computer systems is illegal in most
  jurisdictions.
- The demo images, brands and store names are fictional/AI-generated placeholders used for
  layout purposes only; no affiliation or endorsement is implied.

The author accepts **no liability** for damage, data loss or legal consequences resulting
from misuse of this code.

---

## License

[MIT](LICENSE) — for educational and security-training use only.
