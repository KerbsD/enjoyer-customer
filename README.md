# Enjoyer customer menu

Phases 1–2 of the [customer roadmap](CUSTOMER_ROADMAP.md): mobile-first public menu, store status, table QR entry at `/order#table=TOKEN`, item customization, and a versioned shared cart. Customers **cannot place orders yet**; checkout and order tracking are later phases. Ask staff to take your order.

## Local setup

Use Node.js 22 or newer (verified with Node 24). Run the Enjoyer API separately, then configure its `CORS_ORIGINS` with this frontend's origin. From this directory:

```bash
npm install
cp .env.example .env.local
npm run dev
```

The customer app runs at `http://localhost:3000` by default. `.env.example` points to the API at `http://localhost:4000`; change `NEXT_PUBLIC_API_URL` if your API uses a different origin. The admin normally runs at `http://localhost:3001`. Do not assign the API and customer app the same port.

Browse the menu at `/`. To test a table, create an active table in the admin app, use its QR code (or its local test token), and visit `/order#table=TOKEN`. The token is a credential: keep it out of logs, URLs beyond the QR fragment, and shared screenshots. For printed QR codes, configure the API's `CUSTOMER_URL` to the **actual deployed customer origin**; otherwise it may fall back to the admin `CLIENT_URL`. Do not distribute codes for live ordering until later roadmap phases are complete.

To add an item, tap **Customize item**, choose any required options, then tap **Add to cart** in the dialog. The first button only opens customization. **View cart** opens the shared cart in a right-side drawer; Escape or the close button dismisses it. The cart refreshes on page load, tab focus, or the **Refresh cart** button; instant push updates are planned for Phase 5. If another phone changes the cart first, review its latest contents before retrying. Notes are per item (up to 500 characters), not one order-wide note.

The menu entrance, item dialog, and cart drawer use GSAP motion. They honor the device's reduced-motion preference.

Cart/editor state resets for each visit. A refresh resumes the exact visit the
tab remembered; if that visit was replaced or idle-expired, the app asks before
starting a new one instead of joining the table's current visit. Remote refreshes
preserve your editing focus and keep the last loaded cart visible if the
connection fails. Writes use the observed cart ID and version; an open clear
confirmation is invalidated if that version changes. If the preflight read fails,
nothing is sent and the editor stays open. If the write itself fails with an
uncertain outcome, a successful cart read and explicit review are required before
retrying. Requests time out after 15 seconds, including response-body reads.

Deploy this frontend with the matching API change that requires `cartId` on
cart writes. Older frontend and API versions are not write-compatible with it.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm audit --audit-level=high`. The browser suite uses mocked API responses and requires Chromium (`npx playwright install chromium` once). It builds and starts its own server on port 3103 with `NEXT_PUBLIC_API_URL=http://localhost:4000`, overriding local environment files; all test API calls are intercepted. Keep port 3103 free. A live cart **read** was verified; use only a disposable table for write sign-off, since adding, editing, or clearing its cart affects everyone at that table.
