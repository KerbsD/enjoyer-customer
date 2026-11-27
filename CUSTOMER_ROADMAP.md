# Enjoyer customer frontend: phased roadmap

This plan follows `../specs.md` for product behavior, `../api/README.md` and the API implementation for the current contract, and `../admin` for frontend organization. Complete and verify **one phase at a time** before beginning the next. Phases 1–4 are implemented; real-API cart, checkout, tracking and physical-device sign-off are still pending.

**Current direction:** Phases 8–10 replace the shared cart with a local draft per browser tab. Multiple phones can still order during the same table visit. Placed orders and the order limit remain shared across the visit. Earlier phases document the shared-cart implementation; Phase 10 applies the Phase 7 release checks to its replacement.

## What to carry over from the admin frontend

- `../admin/src/app`: small App Router route pages and layouts; business UI lives in feature modules rather than large page files.
- `../admin/src/modules`: feature-oriented components and hooks, with shared primitives in `src/components` and cross-cutting helpers in `src/lib`.
- `../admin/src/api`, `src/types`, `src/schemas`, `src/constants`: typed API calls/contracts, validation, and shared query keys/labels. Use these boundaries where they help; do not copy staff-only endpoints or types.
- `../admin/src/components/Providers.tsx`: a central client provider for TanStack Query; feature hooks handle reads, writes, cache invalidation, and UI state. Add dependencies only as each phase needs them.
- `../admin/src/app/globals.css` and `../admin/src/lib/shop-format.ts`: paper/ink/mustard design tokens, DM Sans/DM Mono, accessible focus states, PHP display, and Manila-time formatting. Make a **customer-specific, mobile-first** shell, not the admin sidebar/guard.
- `../admin/src/lib/realtime.ts` originates in `../api/src/client/realtime.ts`; reuse the API's maintained helper for header-authenticated SSE with polling fallback, adapting its invalidation wiring to customer resources.
- Admin already has typecheck, lint, unit, mocked Playwright, and opt-in live checks. Establish equivalent customer checks incrementally; mocked tests alone are not real-API sign-off.

The customer project began as the default Next.js starter; Phase 1 adds the public menu, QR flow, components, and initial checks. The API is a **separate** service; there is no customer login, and the admin's refresh-cookie/JWT flow must not be reused.

## Phase 1 — Foundation, scan, and read-only menu

**Goal:** a scanned table reaches a useful mobile menu, without order mutation yet.

- Set up the customer design tokens, fonts, page metadata, responsive shell, loading/error/empty states, API base URL, typed public request/error handling, PHP and `Asia/Manila` formatting, and initial typecheck/lint/test scripts.
- Implement the actual QR destination `/order#table=TOKEN`. Read the fragment on the client, keep the QR token out of query strings/server requests/logs, and send it only in JSON to `POST /tables/resolve`, `POST /tables/open` and `POST /tables/resume`, or later in the `X-Table-Token` header. Persist only as needed for same-tab refresh; a new scan must replace the previous table context. Never expose the token in rendered UI.
- Show the validated table name and clear invalid/deactivated/missing-QR or API-offline states. `/tables/open` creates or reuses a provisional session and returns the session ID and cart. `/tables/resume` refreshes the exact remembered visit atomically and never creates or joins another one. After a visit ends, **Reset this visit** clears the current QR fragment and visit marker without opening a new session. Ask the customer to scan the table QR again.
- Read `GET /menu` and `GET /store/status`: categories in API order, item descriptions/prices/spicy markers, visible sold-out items disabled, a reachable category navigator, and a clear closed-hours banner. Menu remains browsable when closed; ordering controls are not live yet. If a no-QR browsing entry is offered, it must never imply that a table is selected.

**Done when:** a real QR lands on the correct table/menu on a phone; bad/deactivated codes show an actionable error; browsing and closed/sold-out states work without login; tests cover fragment parsing and public API errors. Before printing QR codes, configure the API's `CUSTOMER_URL` to the deployed customer origin—otherwise codes may point at the admin `CLIENT_URL`.

**Browser check (2026-11-18):** Headless Chromium loaded the live `/menu` and `/store/status` from the running API with CORS enabled for `http://localhost:3000`; the eight live categories rendered. Missing QR and a well-formed but unknown QR showed clear errors. No horizontal overflow at 320/390/768/1280px and no unexpected page errors; an automated axe scan at 390px reported zero violations. Intercepted-response checks covered closed hours and sold-out display. The **updated** `table-1.svg` decoded to `http://localhost:3000/order` and its unmodified embedded URL returned 200. Live `/tables/resolve`, `/tables/open`, Table 1 display, same-tab refresh, and header-scoped session lookup all passed without a token in API URLs. The earlier SVG pointed at the admin origin and was replaced. **Still required before physical QR distribution:** a physical-phone scan, a deactivated-table test, and manual keyboard/screen-reader review. Later phases must implement actual ordering before QR codes can be used for service.

## Phase 2 — Item customization and shared cart

**Goal:** customers can prepare a correct order from multiple phones at one table.

- Build item details/customization using the public menu's `optionGroups`: available choices, required `minSelections`, maximum `maxSelections`, option surcharges, quantity, and an optional **per-line** note (API maximum 500 characters). Show exact PHP totals; keep monetary data as decimal strings/integer centavos for calculation rather than floating-point rounding.
- Use `GET /tables/cart`, `POST /tables/cart/items`, `PATCH /tables/cart/items/:id`, and DELETE endpoints with `X-Table-Token`. Support add, edit quantity/options/note, remove, clear, and a persistently visible running total. The server cart is authoritative and survives refresh.
- Send the last-seen cart ID and `version` on every mutation. On `409 CART_VERSION_CONFLICT`, apply the returned latest cart, explain that another phone changed it, and require review before retrying rather than overwriting someone else's edits. A replacement visit cannot accept writes from the old cart. Handle unavailable/hidden items and options, empty cart, token/session expiry, and temporary network failure.

**Done when:** two devices can see the same cart after refreshing, stale writes do not lose changes, selection rules and the 500-character note limit are enforced in the UI and API, and the cart stays intact after a short disconnect.

**Verification (2026-11-18):** Unit tests cover selection/quantity/note constraints, exact centavo calculations, versioned cart requests and conflict payloads. Eight Chromium journeys against a mocked API cover add/customize/edit/remove/clear, refresh persistence, failed-add feedback, slow focus refresh, two-device conflicts and required review, a lost write response, closed-shop/sold-out states, the keyboard-accessible cart drawer, 320px/390px layouts, and automated axe checks. The development server was also checked in a browser with a real Table 1 QR and an intercepted add request: the dialog opens and the mocked item appears, without writing to Table 1. `GET /tables/cart` with that QR returned 200 with an empty version-0 cart and customer-origin CORS. **Still required:** write verification against a disposable real table, plus physical-device manual checks.

**Pre-commit audit follow-up (2026-11-19):** The suite now has 12 unit tests and
24 mocked Chromium journeys. Added coverage for session/editor reset, late
responses from an old visit, refresh failure with retained cart contents, missing
menu versus hidden items, changed option selections, unavailable-choice recovery,
remote additions during editing, keyboard focus through drawer/editor transitions,
malformed conflict payloads, and blocked review until recovery succeeds. Refreshes
resume the remembered visit atomically instead of checking the session and then
joining whatever `/tables/open` returns; tests cover both a normal resume and a
visit replaced at the resume boundary. Request timeouts cover both headers and
response bodies. Cart responses are validated with Zod. Browser tests build with
a pinned mock API origin and their own server. Full and production-only
dependency audits report zero vulnerabilities. Live writes and
physical-device/screen-reader checks remain pending.

## Phase 3 — Review, placement, and confirmation

**Goal:** turn the shared cart into an order safely and show an unambiguous result.

- Review table, lines, add-ons, notes, total, and **pay when served at the counter** messaging. Submit `POST /tables/orders` with the reviewed cart ID, version, total and unique request ID. Prevent accidental double submission and reconcile uncertain network results by refetching cart and checking for that exact order ID before offering a retry with the same request ID.
- Handle authoritative placement errors: `CART_VERSION_CONFLICT`, `CART_EMPTY`, `MENU_ITEM_UNAVAILABLE`, option validation, `STORE_CLOSED`, `ORDER_AWAITING_CONFIRMATION`, `ORDER_LIMIT_REACHED`, and ended/invalid table session. Refresh the relevant resources and show what the customer can do next.
- Show order number, current status, and remaining orders from the response. The first order is `pending_confirmation`; later orders in a confirmed open session are `received`. A second order cannot be placed while the first awaits confirmation. Rejected/expired/cancelled orders do not use the session limit.

**Done when:** a placed order appears on the admin board with correct snapshots, the shared cart clears only after successful placement, closed/limit/pending gates are respected, and confirmation never suggests online payment.

## Phase 4 — Table orders, tracking, and cancellation

**Goal:** anyone with that table QR can understand the current visit.

- Use `GET /tables/orders` for the current session's full order list, statuses, per-order details, combined eligible total, payment indicators, and remaining-order count. Do not promise access to previous closed visits.
- Show pending confirmation, received, preparing, ready, served, rejected, and cancelled distinctly. Show a customer cancel action only for `pending_confirmation` or `received`; submit `POST /tables/orders/:id/cancel`, then refetch after success or a status race. Once preparing, direct the customer to staff instead.
- Offer “order again” only when the store is open, the table/session remains valid, confirmation is not pending, and capacity remains. These are UI hints; the API makes the final decision.

**Done when:** a second phone with the same QR sees the current visit, cancellation changes the count/total correctly, and a staff-closed/expired session cannot accidentally show the next visit's orders.

**Automated verification:** Mocked browser tests cover second-phone tracking,
order details, cancellation and remaining capacity, a staff status race, and
visit replacement. Verify the same flow on two phones and a disposable API
table before sign-off. Live push updates are Phase 5.

## Phase 5 — Live synchronization and recovery

**Goal:** changes propagate without a manual refresh, with safe fallback.

- Use `../api/src/client/realtime.ts` with `GET /tables/realtime/events?sessionId=UUID` and its polling fallback; authenticate via `X-Table-Token`, **not** native `EventSource` or a token-bearing URL. Bind the watcher to the session ID returned by `/tables/open`, stop it on teardown/table switch, and treat every reconnect `sync` as a full resync.
- Map `cart` → cart; `orders`/`tables` → current-session orders and table context; `menu` → menu **and** cart prices/availability; `store` → hours/status. Advance realtime revision only after data is fetched and applied. Keep mutation/version-conflict handling from Phase 2.
- On `TABLE_SESSION_REQUIRED`, `INVALID_TABLE_QR`, or closed-session access, stop updates and show a scan/ask-staff flow; do not automatically follow the same QR into a newly opened visit. Show a modest connection status and recover from SSE to polling and back.

**Done when:** simultaneous phones receive cart/order/status/menu/store changes, polling works if SSE is unavailable, reconnections resync, and old sessions stay isolated.

**Automated verification:** The customer repo vendors the API browser helper
in `src/api/realtime.ts` so it can build independently. Tests cover full stream
sync, polling fallback, deferred revision acknowledgement after a failed read,
editor preservation, and stopping when visit access ends. Live verification
against the running API on two phones is still pending.

Reconnect recovery keeps an incomplete refresh pending across transports.
Customer read routes have a separate shared-IP budget from checkout and staff
traffic, and cross-origin browsers can honor the API’s `Retry-After` header.

## Phase 6 — In-shop ordering and order names

**Goal:** keep QR menu browsing public while preventing a photo of a table QR from being enough to order remotely. No staff-issued code or per-order approval is added by this phase; the existing first-order confirmation flow stays in place.

- Add an owner-controlled **Ordering network** setting. The owner enrolls a designated café terminal once. While an authorized admin uses that terminal, the API can automatically refresh the saved public IP when it changes. Ordinary admin logins, including from home or mobile data, must not change it. Show the active address and last change in admin, audit updates, and provide an owner-only manual override and terminal revocation.
- Enforce the network rule in the API, not just the UI. Keep the menu and hours public; require the configured café network before opening or joining an ordering visit, changing the cart, or placing an order. If the network cannot be verified, keep browsing available and tell the customer to connect to guest Wi-Fi. Store hours remain a separate placement check.
- Require a first name or nickname on **each order**, validate and store it server-side, and show it on the staff board for handoff. It is a label, not a password or proof of presence.
- Keep the café network check for each ordering phone. Phases 8–10 replace shared editing with independent drafts; no phone claims exclusive control of the visit.
- Before relying on public-IP matching, verify what the deployed API sees from the café terminal, two phones on guest Wi-Fi, and a phone on mobile data. Check IPv4/IPv6, whether the ISP shares the public address with other subscribers, and whether the guest and admin networks use the same internet connection. If the address cannot reliably distinguish on-site traffic, revisit the network check before rollout. Keep guest and admin Wi-Fi separate.

**Done when:** the QR menu opens off-site but ordering is blocked; guests on café Wi-Fi can order during store hours with a name; an IP change can be recovered without a remote admin login changing the approved network. Complete this phase before distributing live ordering QR codes.

**First slice:** Checkout requires a first name or nickname; the API stores it
and the staff board shows it. Names are not returned in QR-scoped order views.
Apply API migration `0007_order_customer_name.sql` before deploying the matching
API, customer and admin builds.

**Network slice:** The owner can enroll, replace, or revoke the terminal and
manually override the approved IP. An enrolled browser checks for an address
change while a Manager or Owner is signed in. An enabled network check guards
table visits, cart/orders, cancellation, and realtime, while browsing stays
public. The restriction defaults to off and requires an explicit IP source in
production; verify the deployed proxy and guest egress before enabling it.
Nicknames are not persisted in browser storage. The network slice did not change shared-cart behavior.

## Phase 7 — Quality and release sign-off

**Goal:** make the full mobile journey dependable before table QR distribution.

- Add unit/API-contract tests for token handling, option selection/pricing, cart version conflicts, placement races, status/limit rules, and formatting. Add browser journeys for scan → customize → shared cart → review → confirm → track/cancel, including 320px/390px layouts, keyboard/screen-reader checks, and automated accessibility checks.
- Verify against a **running API** with disposable tables/orders: bad/deactivated QR, sold-out and hidden items, closed hours/holiday override, first-order confirmation and expiry, staff cancellation/payment, session close/idle expiry, two-phone cart conflict, SSE/polling fallback, refresh/offline recovery, and correct `CUSTOMER_URL` on downloaded/printed QR codes.
- Check API CORS for the deployed customer origin and `X-Table-Token`, HTTPS, network/console output, no token leakage in URLs beyond the QR fragment or in analytics/logs, and no customer access to staff endpoints. Record remaining manual checks separately from mocked-test passes.

**Done when:** automated checks pass and the real API + real QR flow is verified on common phones before codes are handed to customers.

## Phase 8 — API checkout without a shared cart

**Goal:** a phone can submit its own reviewed items to the current visit without creating, fetching, or updating a server cart.

- Define the checkout contract around the visit ID, item IDs, quantities, selected option IDs, per-item notes, customer name, and a unique request ID. Add a server review step that returns authoritative prices and totals. Bind the reviewed result to the visit and selection so checkout can require explicit re-review if prices, availability, or selections change. Review does not reserve availability or use an order slot.
- Revalidate the QR token, exact session, café network, store hours, selections, and price at placement. Keep the existing order snapshots, first-order confirmation, and visit-wide order limit. Serialize placement per visit in the database so concurrent phones cannot bypass confirmation or exceed the limit.
- Replace cart-version-based retry recovery with durable, session-scoped idempotency. An identical retry with the same request ID returns the original result; reusing an ID with a different submission must not create another order. Support resolving an uncertain attempt without relying on a cart version or treating “not found yet” as proof that a delayed request cannot still commit.
- Make session open/resume, order history/cancellation, realtime access, and staff table views work without a cart row. Keep a temporary compatibility path if the existing customer build is still deployed, and ensure old and new placement paths enforce the same visit-wide rules.

**Done when:** integration tests place orders with no server cart, reject stale visits and changed prices, replay a lost response without duplication, and show that concurrent submissions respect first-order confirmation and the remaining limit.

## Phase 9 — Local cart and customer checkout

**Goal:** customers can edit their own draft instantly, while placed orders remain visible to everyone at the table.

- Store draft items in `sessionStorage`, scoped to the exact table visit. Add, edit, remove, and clear locally with no cart requests, loading button states, or cross-phone version conflicts. Restore the draft on same-tab refresh, and discard it when the customer resets or switches visits or the API invalidates the session. Keep the QR token and customer name out of draft storage.
- Preserve customization rules, per-item notes, and exact centavo calculations. Show the local total while editing and the API-confirmed total at review. Preserve draft items when review or checkout fails, and require explicit confirmation after any repricing. Clear the submitted draft only after placement is confirmed.
- Use the new checkout contract and preserve the pending request ID across a same-tab reload so an interrupted submission can be reconciled. Keep realtime updates for orders, tables, menu, and store status. Menu updates can flag unavailable local items for review; they must not replace or erase the draft.

**Done when:** the browser tests show that local edits cause no cart requests, two phones retain separate drafts while seeing the same placed orders, and refresh, repricing, failed submission, and expired visits behave as expected.

## Phase 10 — Cutover, cleanup, and release sign-off

**Goal:** retire shared-cart infrastructure after the local-cart flow passes live verification.

- Coordinate the API/customer rollout and any staff-facing contract changes. Let active legacy visits finish before disabling shared-cart access. Unsubmitted shared drafts are not copied into each phone’s local cart; if an active visit must be switched, communicate that its shared draft must be re-entered. Preserve placed orders and current order history.
- Remove the legacy `/tables/cart` routes, cart revisions in realtime, cart fields in visit responses, and unused client and API code after confirming there are no remaining consumers. Retire cart tables through a separate migration after the rollback window. Update `../specs.md` and the API and customer documentation for the new flow.
- Repeat the Phase 7 release checks on a running API and a disposable table, replacing shared-cart conflict cases with two-phone draft isolation and concurrent checkout tests. Verify same-tab recovery, lost-response retries, price changes, staff handoff, cancellation, session expiry, guest Wi-Fi restrictions, and SSE/polling fallback using two phones and a real QR.

**Done when:** no deployed client calls legacy cart endpoints, the two-phone flow passes live checks, and placed orders and visit limits behave the same after cutover.

## Boundaries and decisions to confirm during implementation

- The product spec calls this an “order note,” but the implemented API stores a **note on each cart line/order item** (500 characters). Use per-item notes for now; a single order-wide note would require an API/product decision.
- No customer account, online payment, refunds, photo upload/menu images, past-session history, or unscoped notifications are part of these phases. Do not introduce a temporary ordering-pause feature without product rules and API support.
- `../specs.md` remains the authority for intended behavior; where the live API contract differs, surface the difference rather than silently inventing a new frontend-only rule.
