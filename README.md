# ⚠️ ShopNexus — Intentionally Vulnerable Web Lab

> **BU TƏTBİQ QƏSDƏN ZƏİFDİR. YALNIZ LOKAL MÜHİTDƏ, TƏHSİL MƏQSƏDİLƏ İSTİFADƏ EDİN.**
>
> This application is intentionally vulnerable. Run it **locally only**.
> Do **not** deploy it to a public server, do **not** expose it to the internet,
> and never reuse these credentials or secrets anywhere else.

ShopNexus — Node.js/Express + NeDB üzərində qurulmuş, çoxrollu (Customer / Vendor / Admin)
e-ticarət platformasıdır. Layihə təhlükəsizlik məşqi (web security lab) üçün hazırlanıb:
tətbiqin əsas funksionallığı tam işləkdir, içinə isə **15 qəsdən yerləşdirilmiş zəiflik**
(5 Easy, 5 Medium, 5 Hard) daxil edilib.

Challenge siyahısı: [`CHALLENGES.md`](CHALLENGES.md). Həllər bu repoda yoxdur.

---

## Tələblər

- **Node.js 18+** (tövsiyə: 20 və ya 22 LTS)
- npm

Yoxlamaq üçün:

```bash
node -v
npm -v
```

## Quraşdırma və işə salma (lokal)

```bash
git clone <repo-url> shopnexus-lab
cd shopnexus-lab
npm install
```

Konfiqurasiya faylını yarat:

```bash
# Windows (cmd)
copy .env.example .env

# PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Serveri başladın:

```bash
npm start
```

Brauzerdə açın: **http://localhost:3000**

> Saytı mütləq `localhost` ünvanı ilə açın. `192.168.x.x` kimi LAN IP ilə açsanız,
> auth cookie-ləri (`Secure`) brauzer tərəfindən saxlanmaya bilər və giriş dövrəyə düşə bilər.

### Portu dəyişmək

`.env` faylında:

```env
PORT=4000
```

və ya env dəyişəni ilə:

```bash
# PowerShell
$env:PORT=4000; npm start

# cmd
set PORT=4000 && npm start

# bash
PORT=4000 npm start
```

### Development rejimi (avtomatik restart)

```bash
npm run dev
```

## Demo hesablar

Bütün hesablar yalnız bu lab üçündür. **Başqa yerdə istifadə etməyin.**

| Rol | Email | Şifrə |
|---|---|---|
| Admin | `admin@shopnexus.cyou` | `7#8R5T#*ww9Aq*` |
| Customer | `customer@shopnexus.cyou` | `v5sr6tEGQn*!KT` |
| Vendor | `vendor@shopnexus.cyou` | `ZHTsN&$3dnFKU!` |
| Vendor | `apple@shopnexus.cyou` | `Qv&XSxAvN*G*8m` |
| Vendor | `beauty@shopnexus.cyou` | `xW&h3Et%4^S6JN` |
| Vendor | `moda@shopnexus.cyou` | `t^GMe8aF8&6rX3` |
| Vendor | `home@shopnexus.cyou` | `@T!^ZLEq^d8$KV` |
| Vendor | `pcarena@shopnexus.cyou` | `tsp@Gk5rN3h@xn` |
| Vendor | `samsung@shopnexus.cyou` | `E5yEtgD%Xh#Vc!` |
| Vendor | `sporthub@shopnexus.cyou` | `^cLNG8e*yfdtf6` |
| Vendor | `xiaomi@shopnexus.cyou` | `eS&kfXpCa3S#8L` |

Giriş yolları (lokal):

- Customer: `http://localhost:3000/auth/login`
- Vendor: `http://localhost:3000/auth/vendor/login`
- Admin: `http://localhost:3000/auth/admin/login`

## Lazım gələrsə: datanı sıfırlamaq

Layihə ilə birlikdə hazır `data/` bazası gəlir. Təcrübələrdən sonra ilkin vəziyyətə qaytarmaq üçün (ilk commit-dən sonra):

```bash
git restore data
```

Bazadan tamamilə sıfırdan başlamaq istəsəniz, `data/` içindəki `*.db` fayllarını silib yenidən seed edin:

```bash
npm run seed
```

> Qeyd: `seed` bütün hesablar üçün `.env`-dəki `DEMO_ACCOUNT_PASSWORD` dəyərini istifadə edir,
> yəni yuxarıdakı fərdi şifrələr yalnız hazır `data/` bazası ilə işləyir.

## Challenge-lər

| # | Çətinlik | Zəiflik | Endpoint |
|---|---|---|---|
| E1 | Easy | Open Redirect | `POST /lang/:code` |
| E2 | Easy | OTP Rate Limiting | `POST /checkout/otp` |
| E3 | Easy | Review IDOR | `POST /reviews/:id/delete` |
| E4 | Easy | Coupon Validation (business logic) | `POST /vendor/coupons`, `POST /admin/coupons` |
| E5 | Easy | Hidden / Debug Endpoints | `GET /debug/*`, `GET /admin/system` |
| M6 | Medium | CSRF | `POST /user/profile`, `POST /user/address` |
| M7 | Medium | Mass Assignment | `POST /user/profile` |
| M8 | Medium | First-order Coupon Sayım Xətası | `POST /orders` |
| M9 | Medium | NoSQL / Query Injection | `POST /orders/search` |
| M10 | Medium | Cross-Portal / JWT Role Mismatch | auth axını |
| H11 | Hard | Support Ticket Authorization | `POST /support/:id/reply` |
| H12 | Hard | Host Header Injection | `GET /receipts/:token` |
| H13 | Hard | Refund State-Machine Confusion | `POST /admin/refunds/:id/approve` |
| H14 | Hard | Gift Card Race Condition | `POST /wallet/redeem-giftcard` |
| H15 | Hard | Vendor Isolation (BOLA) | `POST /vendor/questions/:id/answer` |

Ətraflı brief: [`CHALLENGES.md`](CHALLENGES.md)

## Fayl strukturu

```
app.js                 # Express tətbiqi, route mount-ları
config/                # DB, JWT, multer, public URL konfiqurasiyası
controllers/           # biznes məntiqi
routes/                # Express router-lər
models/                # NeDB modelləri
services/              # ödəniş, qəbz, qiymət, bildiriş xidmətləri
middlewares/           # auth, i18n, session
views/                 # EJS şablonları
public/                # statik fayllar və upload-lar
data/                  # NeDB bazası (ilkin demo vəziyyəti)
scripts/               # seed, miqrasiya və yoxlama skriptləri
locales/               # AZ / EN / RU tərcümələr
```

## Təhlükəsizlik qeydləri

- `.env` faylındakı secret-lər **yalnız lab** üçündür (`development-only-*`).
- `PUBLIC_BASE_URL` boş buraxılıb ki, qəbz/QR linkləri lokal host ilə işləsin.
- Tətbiq `data/` qovluğunda NeDB faylları yazır. Bu fayllar sizin lokal vəziyyətinizdir.
- `.mcp.json`, `.env`, `node_modules/` və daxili qeydlər repoya daxil edilmir.
- Bu layihəni real məlumat, real istifadəçi hesabları və ya real secret-lərlə **heç vaxt** işlətməyin.

## Lisenziya

[MIT](LICENSE) — yalnız təhsil və təhlükəsizlik təlimi məqsədilə.

## GitHub-a yükləmə

```bash
git remote add origin https://github.com/<istifadeci>/shopnexus-lab.git
git push -u origin main
```

