# ShopNexus Lab — Challenge Overview

15 deliberately planted vulnerabilities across three difficulty tiers, plus assorted
hardening gaps in the rest of the application.

This document is intentionally generic: it lists **difficulty levels and broad
vulnerability classes only**. Specific endpoints, parameters, files and exploit steps are
not disclosed — locating and exploiting each issue is the exercise.

Solutions are not published anywhere in this repository.

---

## Easy (5)

Entry-level issues that you can usually find by browsing the app normally and watching the
HTTP traffic in your browser's developer tools:

- Open redirects
- Missing rate limiting on security-sensitive actions
- Broken object-level access to another user's content
- Business-logic validation gaps in discounts and promotions
- Unintended information exposure through diagnostic functionality

## Medium (5)

Requires a proxy (Burp Suite, ZAP, etc.) and some understanding of sessions, roles and data
access layers:

- Cross-site request forgery on state-changing actions
- Mass assignment through over-permissive update handlers
- Logic flaws in promotion usage accounting
- Query / operator injection into the data access layer
- Cross-portal role and token handling weaknesses

## Hard (5)

Multi-step, timing-sensitive or privilege-boundary issues that need careful reasoning about
application state:

- Broken object-level authorization in customer-support workflows
- Host header injection affecting generated links
- State-machine confusion in refund processing
- Race conditions in gift-card redemption
- Cross-tenant isolation bypass between vendors

---

## Rules

- Work only against your own local copy (`http://localhost:3000`).
- Never use these techniques against systems you do not own or have written permission to test.
- We do not publish walkthroughs or flags; research each issue yourself.
