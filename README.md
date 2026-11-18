# Enjoyer customer menu

Phase 1 of the [customer roadmap](CUSTOMER_ROADMAP.md): a mobile-first, read-only public menu, store status, and table QR entry at `/order#table=TOKEN`. Ordering and cart changes are **not available yet**; customers should ask staff to order.

## Local setup

Run the Enjoyer API separately, then configure its `CORS_ORIGINS` with this frontend's origin. From this directory:

```bash
npm install
cp .env.example .env.local
npm run dev
```

The customer app runs at `http://localhost:3000` by default. `.env.example` points to the API at `http://localhost:4000`; change `NEXT_PUBLIC_API_URL` if your API uses a different origin. The admin normally runs at `http://localhost:3001`. Do not assign the API and customer app the same port.

Browse the menu at `/`. To test a table, create an active table in the admin app, use its QR code (or its local test token), and visit `/order#table=TOKEN`. The token is a credential: keep it out of logs, URLs beyond the QR fragment, and shared screenshots. For printed QR codes, configure the API's `CUSTOMER_URL` to the **actual deployed customer origin**; otherwise it may fall back to the admin `CLIENT_URL`. Do not distribute codes for live ordering until later roadmap phases are complete.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
