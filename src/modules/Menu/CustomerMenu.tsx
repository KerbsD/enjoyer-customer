"use client";

import Link from "next/link";

import type { StoreStatus } from "@/types/public";
import { shopClock, shopTime } from "@/lib/shop-format";

import SharedCart from "@/modules/Cart/SharedCart";
import ItemCustomizer from "./ItemCustomizer";
import MenuCategories from "./MenuCategories";

import { useCustomerMenu } from "./useCustomerMenu";
import useTableVisit from "./useTableVisit";

function ClosedNotice({ status }: { status: StoreStatus }) {
  if (status.isOpen) return null;
  const today = status.today;
  const hours =
    today.closed || !today.openTime || !today.closeTime
      ? "Closed today"
      : `Today's hours: ${shopClock(today.openTime)} – ${shopClock(today.closeTime)}`;
  return (
    <div
      className="mt-4.5 flex gap-3.5 rounded-lg border border-[#bd8500] bg-[#fff5d7] px-5 py-4.5"
      role="status"
    >
      <span className="text-2xl text-[#805800]" aria-hidden="true">
        ✳
      </span>
      <div>
        <strong className="text-[15px]">We&apos;re closed right now</strong>
        <p className="mt-1 text-sm leading-[1.45]">
          Feel free to browse. Ordering opens during shop hours.
        </p>
        <p className="mt-1 text-[13px] font-bold leading-[1.45]">
          {hours}
          {status.nextOpen ? ` · Next open ${shopTime(status.nextOpen)}` : ""}
        </p>
      </div>
    </div>
  );
}

export default function CustomerMenu({ mode }: { mode: "browse" | "table" }) {
  const visit = useTableVisit(mode);
  const { table } = visit;
  // Cart, editor, pending dialog transitions and review state belong to one visit.
  const key =
    table.kind === "ready"
      ? `${table.table.id}:${table.sessionId}:${table.cartId}`
      : table.kind;
  return <CustomerMenuContent key={key} mode={mode} visit={visit} />;
}

function CustomerMenuContent({
  mode,
  visit,
}: {
  mode: "browse" | "table";
  visit: ReturnType<typeof useTableVisit>;
}) {
  const {
    table,
    intro,
    store,
    retryPublic,
    cart,
    menu,
    editor,
    canAdd,
    findItem,
    retryTable,
    startNewVisit,
  } = useCustomerMenu({ mode, visit });

  return (
    <div className={`min-h-screen${table.kind === "ready" ? " pb-20" : ""}`}>
      <button
        type="button"
        className="absolute -top-20 left-4 z-20 bg-accent px-4 py-3 font-extrabold focus:top-3"
        onClick={() => {
          document.getElementById("menu")?.focus();
          document.getElementById("menu")?.scrollIntoView();
        }}
      >
        Skip to menu
      </button>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-290 items-center justify-between gap-4 px-6 py-4.5 max-[420px]:px-4.5 max-[420px]:py-4">
          {mode === "table" ? (
            <span className="text-[25px] leading-none font-black tracking-[-0.09em] max-[420px]:text-[22px]">
              ENJOYER<span className="text-accent">.</span>
            </span>
          ) : (
            <Link
              href="/"
              className="text-[25px] leading-none font-black tracking-[-0.09em] max-[420px]:text-[22px]"
              aria-label="Enjoyer menu"
            >
              ENJOYER<span className="text-accent">.</span>
            </Link>
          )}
          <span className="whitespace-nowrap text-[11px] font-extrabold tracking-[0.17em] max-[420px]:text-[9px] max-[420px]:tracking-[0.08em]">
            THE MENU{" "}
            <span
              className="mx-2.5 text-[#9a7000] max-[420px]:mx-0.75"
              aria-hidden="true"
            >
              /
            </span>{" "}
            JUST ENJOY.
          </span>
        </div>
      </header>
      <main>
        <section ref={intro} className="overflow-hidden bg-accent">
          <div className="mx-auto flex max-w-290 items-center justify-between gap-7.5 px-6 pt-18 pb-20.5 max-[720px]:pt-14.25 max-[720px]:pb-17.25 max-[420px]:px-4.5 max-[420px]:pt-12.75 max-[420px]:pb-16">
            <div className="max-w-180">
              <p
                data-intro
                className="mb-4 text-[11px] font-extrabold tracking-[0.17em]"
              >
                <span className="mr-1.75 inline-block size-2 rounded-full bg-ink" />{" "}
                FOOD, DRINKS & GOOD TIMES
              </p>
              <h1
                data-intro
                className="m-0 max-w-175 text-[clamp(48px,8vw,96px)] leading-[0.96] font-black tracking-[-0.08em] max-[420px]:text-[clamp(42px,12vw,54px)]"
              >
                Find your <em className="block not-italic">happy place.</em>
              </h1>
              <p
                data-intro
                className="mt-6.5 max-w-105 text-base leading-[1.6] max-[420px]:mt-4.75 max-[420px]:text-sm"
              >
                Something good is always on the menu. Take a look around, stay a
                while, and just enjoy.
              </p>
            </div>
            <div
              data-intro
              className="flex size-43 shrink-0 rotate-13 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-ink max-[720px]:hidden"
              aria-hidden="true"
            >
              <span className="text-[10px] font-extrabold tracking-[0.13em]">
                TAKE IT EASY
              </span>
              <strong className="text-[82px] leading-none font-normal">
                ☺
              </strong>
              <span className="text-[10px] font-extrabold tracking-[0.13em]">
                JUST ENJOY.
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-290 px-6 pb-18 max-[420px]:px-4.5 max-[420px]:pb-15">
          {mode === "table" ? (
            <section
              className="relative -mt-6 flex min-h-19 items-center justify-between gap-4 rounded-lg bg-ink px-5.5 py-4.25 text-paper"
              aria-live="polite"
              aria-label="Your table"
            >
              {table.kind === "ready" && (
                <>
                  <div>
                    <span className="mb-0.5 block text-[11px] font-extrabold tracking-[0.17em] text-[#f4cf5f]">
                      YOU&apos;RE AT
                    </span>
                    <strong className="block text-2xl tracking-[-0.04em]">
                      {table.table.name}
                    </strong>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-extrabold tracking-[0.17em] text-[#d0c9bb] max-[720px]:hidden">
                    TAKE YOUR TIME{" "}
                    <span
                      className="ml-1.75 text-[15px] text-accent"
                      aria-hidden="true"
                    >
                      ✳
                    </span>
                  </span>
                </>
              )}
              {table.kind === "loading" && <p>Checking your table…</p>}
              {table.kind === "missing" && (
                <p>
                  This page needs a table QR code. Please scan the code at your
                  table or ask our staff for help.
                </p>
              )}
              {table.kind === "error" && (
                <div className="flex w-full items-center justify-between gap-5 max-[420px]:flex-col max-[420px]:items-start">
                  <p>{table.message}</p>
                  <button
                    className="shrink-0 rounded-md bg-accent px-3.25 py-2.25 font-extrabold text-ink"
                    type="button"
                    onClick={retryTable}
                  >
                    Try again
                  </button>
                </div>
              )}
              {table.kind === "ended" && (
                <div className="flex w-full items-center justify-between gap-5 max-[420px]:flex-col max-[420px]:items-start">
                  <p>
                    The previous visit at {table.table.name} has ended. If
                    you&apos;re at this table now, you can start a new visit.
                  </p>
                  <button
                    className="shrink-0 rounded-md bg-accent px-3.25 py-2.25 font-extrabold text-ink"
                    type="button"
                    onClick={() => void startNewVisit()}
                  >
                    Start a new visit
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section
              className="relative -mt-6 flex min-h-19 items-center gap-4 rounded-lg bg-ink px-5.5 py-4.25 text-sm text-paper"
              aria-label="Ordering information"
            >
              <span className="size-2 shrink-0 rounded-full bg-accent" />
              <p>Just browsing? To order, scan the QR code at your table.</p>
            </section>
          )}

          {store.kind === "ready" ? (
            <ClosedNotice status={store.data} />
          ) : store.kind === "error" ? (
            <div
              className="mt-4.5 rounded-lg border border-line px-4 py-3 text-sm"
              role="status"
            >
              Shop hours are unavailable. Please ask staff before ordering.{" "}
              <button
                className="ml-2 rounded-md bg-accent px-2.25 py-1 font-extrabold"
                onClick={retryPublic}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : (
            <p
              className="mt-4.5 rounded-lg border border-line px-4 py-3 text-sm"
              role="status"
            >
              Checking shop hours…
            </p>
          )}
          {table.kind === "ready" && cart.state.kind === "error" && (
            <div
              className="mt-4.5 rounded-lg border border-line px-4 py-3 text-sm"
              role="alert"
            >
              We couldn&apos;t load your shared cart. {cart.state.message}{" "}
              <button
                className="ml-2 rounded-md bg-accent px-2.25 py-1 font-extrabold"
                type="button"
                onClick={cart.refreshCart}
              >
                Try again
              </button>
            </div>
          )}

          <div
            id="menu"
            tabIndex={-1}
            className="flex items-end justify-between border-b border-ink pt-17.5 pb-6 max-[720px]:pt-13.75"
          >
            <div>
              <p className="mb-3 text-[11px] font-extrabold tracking-[0.17em] text-[#805800]">
                MADE FOR THE MOMENT
              </p>
              <h2 className="m-0 text-[clamp(32px,5vw,52px)] leading-none font-black tracking-[-0.065em]">
                What sounds good?
              </h2>
            </div>
            <span
              className="text-[45px] leading-none text-[#b17b00]"
              aria-hidden="true"
            >
              ✳
            </span>
          </div>

          {menu.kind === "loading" && (
            <div className="py-10.5 text-secondary" role="status">
              Bringing up the menu…
            </div>
          )}
          {menu.kind === "error" && (
            <div className="py-10.5 text-secondary" role="alert">
              <p>{menu.message}</p>
              <button
                className="rounded-md bg-accent px-3.25 py-2.25 font-extrabold text-ink"
                type="button"
                onClick={retryPublic}
              >
                Try again
              </button>
            </div>
          )}
          {menu.kind === "ready" && (
            <MenuCategories
              categories={menu.data}
              canAdd={canAdd}
              onSelect={(item) => {
                if (cart.state.kind === "ready")
                  editor.openItem(item, cart.state.data.version);
              }}
            />
          )}
          {table.kind === "ready" && (
            <SharedCart
              state={cart.state}
              busy={cart.busy}
              notice={cart.notice}
              needsReview={cart.needsReview}
              canReview={cart.canReview}
              revealId={cart.revealId}
              customizing={!!editor.editing}
              menuReady={menu.kind === "ready"}
              canEdit={store.kind === "ready" && store.data.isOpen}
              findItem={(line) => findItem(line.menuItem.id)}
              onEdit={(item, line) => {
                if (cart.state.kind === "ready")
                  editor.editLine(item, line, cart.state.data.version);
              }}
              onRemove={cart.removeItem}
              onClear={cart.clearItems}
              onRefresh={cart.refreshCart}
              onReview={cart.acknowledgeReview}
            />
          )}
          <div
            className="mt-8 flex flex-col gap-1.25 rounded-r-lg border-l-4 border-accent bg-muted px-5 py-4.5 text-sm leading-normal"
            role="note"
          >
            <strong>
              {mode === "table"
                ? "Your cart is ready. Checkout is coming next."
                : "Just browsing?"}
            </strong>
            <span className="text-secondary">
              {mode === "table"
                ? "You can customize items and build a shared cart, but cannot send an order to the kitchen yet. Please let our staff know what you'd like."
                : "Scan the QR code at your table to build a shared cart. Phone ordering is coming soon; please tell our staff what you'd like."}
            </span>
          </div>
        </div>
      </main>
      {editor.editing && table.kind === "ready" && (
        <ItemCustomizer
          key={`${editor.editing.item.id}:${editor.editing.line?.id ?? "new"}`}
          item={editor.editing.item}
          line={editor.editing.line}
          busy={cart.busy || cart.needsReview}
          actionError={cart.notice}
          onClose={editor.closeEditor}
          onSave={(form) =>
            editor.editing?.line
              ? cart.updateItem(
                  editor.editing.line.id,
                  form,
                  editor.editing.version,
                )
              : cart.addItem(
                  editor.editing!.item.id,
                  form,
                  editor.editing!.version,
                )
          }
        />
      )}
      <footer className="flex items-center justify-between gap-5 bg-ink px-[max(24px,calc((100vw-1112px)/2))] py-8 text-[11px] leading-normal font-extrabold tracking-[0.17em] text-paper max-[420px]:flex-col max-[420px]:items-start max-[420px]:px-4.5 max-[420px]:py-6.75">
        <span className="text-[22px] tracking-[-0.09em]">
          ENJOYER<span className="text-accent">.</span>
        </span>
        <span>GOOD FOOD. GOOD COMPANY. JUST ENJOY.</span>
      </footer>
    </div>
  );
}
