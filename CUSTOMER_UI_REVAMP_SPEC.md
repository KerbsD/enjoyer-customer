# Enjoyer customer UI revamp

Design review and implementation handoff. The nine 380 × 800 Figma exports cover the main journey. Reuse their layouts for the states below rather than drawing separate screens for every outcome. This is a customer-only visual revamp: the existing app decides which actions are available, what they do, and how the guest recovers.

## Frame-by-frame review

| Frame | What it shows | What to carry forward or correct |
| --- | --- | --- |
| `-1.png` | Public landing: café photo, “Sip, Stay, Enjoy.”, QR instruction and **View menu** | Keep browsing available without a QR. **View menu** should take guests to the menu section and move focus there; it must not open a visit. |
| `-2.png` | Closed-shop landing with today's hours and next opening | Use actual shop-local times, including “Closed today” and no next-opening line when unavailable. If a valid visit is already active, keep table context and order tracking available where currently allowed; do not offer checkout while closed. |
| `-3.png` | Recognized table landing with **View menu** | Use the real table name and show this only after visit resolution. Carry table identity and a discoverable **Table orders** entry into the menu so guests need not return to the hero. |
| `menu.png` | Compact header, scrolling category tabs, item cards, floating cart total and footer | Show only the selected category, with dynamic counts, spicy markers, sold-out states and gated add buttons. Support keyboard switching between tabs without resetting the cart. The floating total opens **Shared cart**; give it an accessible name that includes its purpose. Don't copy the tiny description or button sizes literally. |
| `item-drawer.png` | Item customization with quantity, note, temperature and priced substitution | Reuse for edits with populated values and **Update item**. Draw groups from the menu data, including required/optional counts, selection limits, included/extra prices and disabled sold-out options. Use radio controls for an exactly-one choice and checkboxes for multi-select; optional single-select must still allow returning to no selection. |
| `item-drawer-2.png` | Simple item with no option groups | Same sheet, without empty group headings or “choose options” instructions. Keep note, quantity and calculated total. Use **Add to cart** rather than **Order** in both sheets; saving does not send the item to the café. |
| `cart.png` | Right drawer with line edits, remove, refresh, total and review | Label it **Shared cart**, **Refresh cart** and **Clear cart** to distinguish it from submitted orders. Keep “Everyone at this table sees the same cart,” line options/notes and clear confirmation. If using icon-only edit/remove, label each with the item name and give it a full-size hit area. |
| `review-order.png` | Review panel inside the cart drawer with required name and placement | Keep the real table, reviewed line prices, options, notes and total. Example line prices add up to ₱630, not the displayed ₱520; all totals must come from the reviewed data. Replace “Pay on the waiter…” with **“Pay at the counter when your order is served. No payment is taken here.”** Keep **First name or nickname** required for handoff, not a login field. |
| `order-history.png` | Current **Table orders** drawer with summary, payment, details and cancel | Use **Table order total** and **Refresh orders**. This is the current visit, not customer history. Make line totals and summary data-driven: the sample shows ₱390 and ₱140 lines but a ₱390 order total. Show the first-order wait notice only while it applies; do not offer **Order again** while that notice is active. |

**View menu** and **Skip to menu** open the standalone menu and focus its main content. Public browsing uses `/menu`; table guests use `/order/menu` with the original QR fragment. The welcome and menu routes share the active ordering layout so switching screens does not open or resume a visit. The table menu’s **Back to welcome** action returns to `/order`; these transitions use one browser-history entry for the scan so resetting cannot expose an earlier screen with the old scan. No cross-visit history, online payment or new session behavior is implied.

## Missing states and how to render them

| Area | State or interaction | Use this treatment |
| --- | --- | --- |
| Entry and visit | Checking QR/visit; missing or malformed scan; invalid or inactive QR; transient request failure | Reuse the dark landing card with specific status copy. Always allow browsing; ask guests to scan or ask staff where applicable, and show **Try again** for a retryable check. Don't show an unverified table or ordering controls. |
| Entry and visit | Off café Wi‑Fi, including losing access mid-visit | In the same card, explain that browsing still works and that ordering needs café Wi‑Fi when the restriction is enabled. Keep the retry action after reconnecting. Do not present a replacement visit or checkout. |
| Entry and visit | Ended visit | Show **Reset this visit**, followed by a clear prompt to scan the table QR again. Reset clears the old scan and local visit state; it does not join or open a visit. |
| Store and menu | Hours loading or unknown; menu loading, empty or failed; unavailable items/options | Use an inline status or retry card; avoid presenting unknown hours as open. Leave the menu readable when ordering is blocked. Use a visible **Sold out** label and no add action for unavailable items; don't confuse a failed menu load with a removed item. |
| Item sheet | Selection validation, quantity bounds, note limit, saving, failed save, stale availability | Put errors beside the affected controls or above the CTA. Preserve inputs on ordinary save failure and retain the existing refresh/exit behavior for stale options. Keep note and quantity available for items without choices. |
| Shared cart | Loading, empty, failed read, background refresh failure, cart changed on another phone, uncertain write | Reuse the drawer and place a notice above the lines. Keep last-loaded content when the app can, labeled as stale when needed. Keep mutation/checkout controls blocked while recovery requires it. Preserve refresh and the explicit **I've reviewed the cart** step when the cart changes. Remote edits must not open the drawer or steal focus. |
| Shared cart | Item or add-on becomes unavailable; clear confirmation becomes stale | Mark the affected line and offer edit or remove as appropriate. Keep the inline confirmation for clearing the shared cart, with a safe **Keep items** action. Don't let the guest confirm against a newer version they haven't reviewed. |
| Checkout | Name validation, changed cart, pending submission, rejected or uncertain response | Show validation by the name field; if the reviewed cart changed, return the guest to the current cart for review. While a result is uncertain, make **Check order status** the recovery action and expose **Retry same order** only when the existing safeguards allow it. After reload, an attempt that did not place an order requires a fresh review and name. Do not retain the nickname in browser storage. |
| Checkout | Order confirmation — the main missing success view | Reuse the cart review card as a receipt: order number, actual status, total, remaining order allowance, counter payment guidance, and **Done**. For the first order, clearly say to wait for staff confirmation. |
| Table orders | Empty/loading/refreshing, failed or stale read, status and payment variants | Use the same drawer with a status above the summary and a manual refresh. Keep distinct text labels for Waiting for staff confirmation, Received, Preparing, Ready, Served, Rejected and Cancelled; show Paid/Unpaid separately. Expand details for timestamps, quantities, options, notes and any available cancellation/rejection reason. |
| Table orders | Cancellation and ordering again | Confirm that cancellation affects everyone at the table. Keep eligibility, busy and stale-read rules; show the outcome and don't imply cancelled items return to the cart. Direct guests to staff for changes after preparation begins. **Order again** returns to the menu, subject to current gates; it does not copy the previous order. |
| Connection | Connecting, live, polling fallback, reconnecting | Keep a short nonblocking text status near table identity and leave manual refresh discoverable. Use live-region announcements for meaningful changes, not every polling tick. |

## Visual system and responsive layout

Suggested tokens sampled from the exports or chosen to improve readability. Exact font families and desktop layouts cannot be established from the PNGs.

| Token | Value | Usage |
| --- | --- | --- |
| `paper` | `#FCFAF6` | Page and drawer surface |
| `ink` | `#151515` | Text, dark landing cards and footer |
| `accent` | `#F5B800` | Primary fill with ink text; decorative accents |
| `muted` | `#F3F0E9` | Review surface and neutral notices |
| `line` | `#E3E0DA` | Decorative card dividers, not the only input boundary |
| `control-border` | `#888785` | Input outlines and other required boundaries on paper |
| `secondary` | `#625C54` | Supporting text |
| `image-placeholder` | `#D9D9D9` | Reserved image surface only if real menu imagery is supplied |
| `success-text` / `danger-text` | `#21643D` / `#A02F16` | Positive status, errors and destructive labels; always pair color with text |

- **Type:** Use an italic display serif for the landing headline (about 40–48 px at 380 px width, wrapping when needed); use sans-serif for the interface and monospace or tabular numerals for prices and order references. Aim for 24–28 px drawer titles, 16 px item names, 14–16 px body and action text, and at least 12 px for nonessential metadata. Confirm the actual Figma fonts if exact matching matters.
- **Spacing:** Start with a 4 px base, 16–24 px outer gutters, 12–16 px internal padding, 8–12 px between controls, and 8–12 px card radii. Use a larger top radius for the item sheet. The hero photo is roughly 42% of the reference height; let it shrink on short viewports rather than pushing the main action off-screen.
- **Menu:** At phone widths, stack item cards and scroll category chips horizontally without clipping keyboard focus. At larger widths retain the existing two-column pattern as space permits (around 720 px is the current split). Leave a clear visual trail to the cart and Table orders; account for the floating cart when spacing the footer.
- **Drawers:** Keep the item customizer a bottom sheet on phones, with a scrollable body for long option groups. Keep cart and table orders right-aligned; widen beyond the mockup's ~270 px on phones when necessary for long prices, names, or controls, and use full width on very narrow screens. On larger screens, a bounded right panel around 400–480 px is a starting point. Keep primary actions reachable with the keyboard open, at text zoom, and above device safe areas. Avoid overlapping modals.
- **Responsive checks:** Review at 320 and 380 CSS px, tablet and desktop. Test long names, large totals, multiple options, empty states, long order lists and landscape. The PNGs don't establish a desktop design, so treat larger layouts as adaptations rather than exact reproductions.

## Accessibility and interaction acceptance

- Sampled contrast on paper: ink **17.52:1**; proposed secondary text **6.34:1**; control border **3.44:1**. Ink on yellow is **10.21:1**. The sampled gray `#888785` is too light for normal text; yellow on paper (**1.72:1**) and light dividers on paper (**1.26:1**) should not be the only focus or control indicators. Verify the rendered UI, including text over the hero photo, before claiming compliance.
- Target 44 × 44 CSS px for tap controls, including close, quantity, edit/remove, refresh and cancel. Provide visible focus, selected/disabled states, and text for statuses rather than relying on color. Don't make key descriptions or payment guidance tiny to fit the export.
- Preserve dialog naming, initial and trapped focus, Escape, focus restoration, and category tab focus. Close the cart before opening the item editor so dialogs do not stack. The customer UI currently opens and scrolls without animation. Use real buttons and inputs, group option labels, and announce submit/recovery outcomes without stealing focus.
- Recheck the existing [browser scenarios](tests/e2e/cart.spec.ts), especially browse/closed, QR retry/reset, conflict and lost responses, first-order gating, cancellation, fallback polling, and keyboard access. This review compared the exports with source; it does not certify the eventual on-device UI.

## Assets and scope decisions

- Supply the original café photo and cup logo/wordmark, preferably with an SVG for the mark. The exports are layout references, not runtime assets. Use Lucide for utility icons. If individual menu photos are intended, the current `PublicItem` contract has no image field; default to text cards until a photo source is agreed, rather than shipping gray boxes for every item.
- Preserve the current shared-cart and table-wide cancellation rules. One ordering phone per table and submitting-device-only cancellation are separate product decisions, not required to complete this design.
- Keep the revamp Tailwind-first. Preserve existing API calls and behavior, dedicated types/constants/validation, and the Menu hooks' existing client boundaries. Leave the deferred audit fixes for Phase 7, including stale cancellation status/totals and stale shop hours. Admin design review remains separate, pending its Figma references.
