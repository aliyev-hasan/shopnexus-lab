# ShopNexus Lab — Challenge Brief

15 zəiflik, 3 çətinlik səviyyəsi. Həllər və exploit addımları bu repoda yoxdur.

> Bu sənəd yalnız hədəf səthini (endpoint və zəiflik kateqoriyasını) verir.
> Hər challenge-ın necə istismar olunacağını özünüz tapmalısınız.

## Easy (5)

### E1 — Open Redirect
- **Endpoint:** `POST /lang/:code` (həmçinin `POST /cart/add`, `POST /wishlist/add`)
- **Hədəf:** istifadəçini xarici domenə yönləndirmək.

### E2 — OTP Rate Limiting
- **Endpoint:** `POST /checkout/otp`
- **Hədəf:** OTP təsdiq mərhələsini məhdudiyyətsiz sınaqdan keçirmək.

### E3 — Review IDOR
- **Endpoint:** `POST /reviews/:id/delete`
- **Hədəf:** başqa istifadəçinin rəyini silmək.

### E4 — Coupon Validation (business logic)
- **Endpoint:** `POST /vendor/coupons`, `POST /admin/coupons` → `POST /cart/apply-coupon`
- **Hədəf:** məntiqsiz endirim dəyərləri ilə sifarişi sıfır qiymətə gətirmək.

### E5 — Hidden / Debug Endpoints
- **Endpoint:** `GET /debug/config`, `GET /debug/settings`, `GET /debug/stats`, `GET /admin/system`
- **Hədəf:** autentifikasiyasız sistem/konfiqurasiya məlumatı əldə etmək.

## Medium (5)

### M6 — CSRF
- **Endpoint:** `POST /user/profile`, `POST /user/address`, `POST /user/address/:id`
- **Hədəf:** istifadəçinin sessiyası ilə onun adından state-changing sorğu göndərmək.

### M7 — Mass Assignment
- **Endpoint:** `POST /user/profile`
- **Hədəf:** profil yeniləmə sorğusu ilə icazəsiz sahə (məs. rol) dəyişmək.

### M8 — First-order Coupon Sayım Xətası
- **Endpoint:** `POST /orders`
- **Hədəf:** "ilk sifariş" kuponunu təkrar-təkrar tətbiq etmək.

### M9 — NoSQL / Query Injection
- **Endpoint:** `POST /orders/search`
- **Hədəf:** filtr obyekti ilə başqa istifadəçilərin sifarişlərinə çıxış əldə etmək.

### M10 — Cross-Portal / JWT Role Mismatch
- **Endpoint:** auth axını (`/auth/*`)
- **Hədəf:** token/rol məntiqindən istifadə edərək yüksək səlahiyyətli portala keçmək.

## Hard (5)

### H11 — Support Ticket Authorization
- **Endpoint:** `POST /support/:id/reply`
- **Hədəf:** başqa istifadəçinin dəstək biletinə cavab yazmaq.

### H12 — Host Header Injection
- **Endpoint:** `GET /receipts/:token`, `GET /orders/:id/receipt`
- **Hədəf:** qəbz/QR linkini nəzarət etdiyiniz hosta yönləndirmək.

### H13 — Refund State-Machine Confusion
- **Endpoint:** `POST /admin/refunds/:id/approve`
- **Hədəf:** eyni geri qaytarmanı təkrar təsdiqləyib balansı iki dəfə artırmaq.

### H14 — Gift Card Race Condition
- **Endpoint:** `POST /wallet/redeem-giftcard`
- **Hədəf:** paralel sorğularla eyni gift card kodunu bir neçə dəfə istifadə etmək.

### H15 — Vendor Isolation (BOLA)
- **Endpoint:** `POST /vendor/questions/:id/answer`
- **Hədəf:** başqa vendor-un məhsul sualına cavab yazmaq.

---

## Qaydalar

- Yalnız **öz lokal nüsxənizdə** işləyin (`http://localhost:3000`).
- Başqa şəxslərin sistemlərinə qarşı bu üsulları tətbiq etmək qanunsuzdur.
- Həlləri paylaşmırıq; öyrənmək üçün özünüz araşdırın.
