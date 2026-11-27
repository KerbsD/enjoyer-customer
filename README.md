# Enjoyer customer menu

Phases 1–5 of the [customer roadmap](CUSTOMER_ROADMAP.md): mobile-first public menu, store status, table QR entry, a shared cart, checkout, table-order tracking and cancellation, and live visit updates.

## Local setup

Use Node.js 22 or newer (verified with Node 24). Run the Enjoyer API separately, then configure its `CORS_ORIGINS` with this frontend's origin. From this directory:

```bash
npm install
cp .env.example .env.local
npm run dev
```

The customer app runs at `http://localhost:3000` by default. `.env.example` points to the API at `http://localhost:4000`; change `NEXT_PUBLIC_API_URL` if your API uses a different origin. The admin normally runs at `http://localhost:3001`. Do not assign the API and customer app the same port.

Browse the menu at `/`. To test a table, create an active table in the admin app, use its QR code (or its local test token), and visit `/order#table=TOKEN`. The token is a credential: keep it out of logs, URLs beyond the QR fragment, and shared screenshots. For printed QR codes, configure the API's `CUSTOMER_URL` to the **actual deployed customer origin**; otherwise it may fall back to the admin `CLIENT_URL`. Do not distribute codes for live ordering until later roadmap phases are complete.

To add an item, tap **Customize item**, choose any required options, then tap **Add to cart** in the dialog. The first button only opens customization. **View cart** opens the shared cart in a right-side drawer; Escape or the close button dismisses it. The cart updates live, with periodic checks if streaming is unavailable. Tab focus and **Refresh cart** still work. If another phone changes the cart first, review its latest contents before retrying. Notes are per item (up to 500 characters), not one order-wide note.

The menu, item dialog, and cart drawer open without animation.

Cart/editor state resets for each visit. A refresh resumes the exact visit the
tab remembered. If that visit was replaced or idle-expired, tap **Reset this
visit** and scan the table QR again. Resetting clears the previous scan; it
does not open or join a visit. Remote refreshes
preserve your editing focus and keep the last loaded cart visible if the
connection fails. Writes use the observed cart ID and version; an open clear
confirmation is invalidated if that version changes. If the preflight read fails,
nothing is sent and the editor stays open. If the write itself fails with an
uncertain outcome, a successful cart read and explicit review are required before
retrying. Requests time out after 15 seconds, including response-body reads.

From the cart, tap **Review order**, verify the table, items and total, then tap
**Place order** after entering a first name or nickname for staff. The first
order waits for staff confirmation. Pay at the counter
when the order is served; the app does not take payment. If the confirmation
response is lost, check the attempted order before trying again.
Checkout recovery keeps the request ID, not the nickname, in tab storage. If
an unresolved request did not place an order and the page was reloaded, review
the cart and enter a name again.

Open **Table orders** to see the current visit’s orders, payment status, total
and remaining allowance. Status updates live when connected, and **Refresh
orders** remains available. Orders can be cancelled before preparation;
cancelling does not put items back into the cart. For later changes, ask staff.

If the Owner enables an ordering network, guests outside the approved network
can still browse. They must connect to the café’s guest Wi-Fi and tap **Try
again** to open or resume their visit.

Deploy this frontend with the matching API version that supports `/tables/resume`,
requires `cartId` on cart writes, and supports the reviewed checkout and
`/tables/realtime/events` and `/tables/realtime/changes` requests.

For local phone testing, set `NEXT_PUBLIC_API_URL` to the PC's LAN API URL
in `.env.local` and, if Next.js blocks dev assets, set `NEXT_DEV_ORIGIN_HOST`
to the PC's LAN IP without a scheme or port. Restart with
`npm run dev -- --hostname 0.0.0.0` and allow the LAN customer origin in API CORS.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm audit --audit-level=high`. The browser suite uses mocked API responses and requires Chromium (`npx playwright install chromium` once). It builds and starts its own server on port 3103 with `NEXT_PUBLIC_API_URL=http://localhost:4000`, overriding local environment files; all test API calls are intercepted. Keep port 3103 free. A live cart **read** was verified; use only a disposable table for write sign-off, since adding, editing, or clearing its cart affects everyone at that table.
