"use client";

import { Clock, Coffee } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { actionButton, primaryButton } from "@/components/button-styles";

import type { StoreStatus } from "@/types/public";
import { shopClock, shopTime } from "@/lib/shop-format";

import SharedCart from "@/modules/Cart/SharedCart";
import TableOrders from "@/modules/Order/TableOrders";
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
    <div className="flex items-start gap-3.5 text-sm" role="status">
      <Clock
        className="mt-0.5 shrink-0 text-accent"
        size={24}
        aria-hidden="true"
      />
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

export default function CustomerMenu({
  mode,
  publicMenu = false,
}: {
  mode: "browse" | "table";
  publicMenu?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showingMenu =
    mode === "table" ? pathname === "/order/menu" : publicMenu;
  const lastScreen = useRef<boolean | null>(null);
  const visit = useTableVisit(mode);
  const { table } = visit;
  // Cart, editor, pending dialog transitions and review state belong to one visit.
  const key =
    table.kind === "ready"
      ? `${table.table.id}:${table.sessionId}:${table.cartId}`
      : table.kind;
  useEffect(() => {
    if (lastScreen.current === showingMenu) return;
    const fromMenu = lastScreen.current === true;
    lastScreen.current = showingMenu;
    if (showingMenu || fromMenu) {
      document
        .getElementById(showingMenu ? "menu" : "view-menu")
        ?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [showingMenu]);

  function changeScreen(next: "menu" | "welcome") {
    if (mode === "table") {
      // Keep the scan on one history entry. Resetting it must not leave an
      // earlier welcome/menu entry that can reopen the old visit.
      const { search, hash } = window.location;
      router.replace(
        `${next === "menu" ? "/order/menu" : "/order"}${search}${hash}`,
        { scroll: false },
      );
    } else if (next === "menu") {
      router.push("/menu");
    } else {
      router.replace("/");
    }
  }

  return (
    <CustomerMenuContent
      key={key}
      mode={mode}
      visit={visit}
      showingMenu={showingMenu}
      changeScreen={changeScreen}
    />
  );
}

function CustomerMenuContent({
  mode,
  visit,
  showingMenu,
  changeScreen,
}: {
  mode: "browse" | "table";
  visit: ReturnType<typeof useTableVisit>;
  showingMenu: boolean;
  changeScreen: (next: "menu" | "welcome") => void;
}) {
  const {
    table,
    store,
    retryPublic,
    cart,
    checkout,
    orders,
    realtimeStatus,
    menu,
    editor,
    canAdd,
    findItem,
    retryTable,
    resetVisit,
  } = useCustomerMenu({ mode, visit });

  const visitNotice = (
    <div aria-live="polite" className="grid gap-4">
      {mode === "table" ? (
        <>
          {!showingMenu && table.kind === "ready" && (
            <div className="grid gap-3 wrap-anywhere">
              <span className="text-sm font-bold text-accent">
                You&apos;re at:
              </span>
              <strong className="text-center text-4xl leading-tight tracking-tight">
                {table.table.name}
              </strong>
            </div>
          )}
          {table.kind === "loading" && <p>Checking your table…</p>}
          {table.kind === "missing" && (
            <p>
              This page needs a table QR code. Please scan the code at your
              table or ask our staff for help.
            </p>
          )}
          {table.kind === "error" && (
            <div className="grid gap-3 text-sm">
              <p>{table.message}</p>
              <button
                className={`${actionButton} justify-self-start`}
                type="button"
                onClick={retryTable}
              >
                Try again
              </button>
            </div>
          )}
          {table.kind === "ended" && (
            <div className="grid gap-3 text-sm">
              <p>
                The previous visit at {table.table.name} has ended. Reset this
                page, then scan the QR code at your table again to order.
              </p>
              <button
                className={`${actionButton} justify-self-start`}
                type="button"
                onClick={() => {
                  resetVisit();
                  if (showingMenu) changeScreen("welcome");
                }}
              >
                Reset this visit
              </button>
            </div>
          )}
        </>
      ) : (
        !showingMenu &&
        !(store.kind === "ready" && !store.data.isOpen) && (
          <div className="grid gap-3">
            <span className="text-sm font-bold text-accent">
              Just browsing?
            </span>
            <p className="text-lg leading-snug font-semibold">
              To order, scan the QR code at your table.
            </p>
          </div>
        )
      )}
      {store.kind === "ready" ? (
        <ClosedNotice status={store.data} />
      ) : store.kind === "error" ? (
        <div className="grid gap-3 text-sm">
          <p>Shop hours are unavailable. Please ask staff before ordering.</p>
          <button
            className={`${actionButton} justify-self-start`}
            onClick={retryPublic}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="text-sm">Checking shop hours…</p>
      )}
    </div>
  );

  if (!showingMenu) {
    return (
      <div className="min-h-dvh">
        <button
          type="button"
          className="absolute -top-20 left-4 z-20 bg-accent px-4 py-3 font-extrabold focus:top-3"
          onClick={() => changeScreen("menu")}
        >
          Skip to menu
        </button>
        <header className="relative isolate h-[clamp(225px,42svh,420px)] overflow-hidden bg-[#503323] text-paper">
          <Image
            src="/landing-img.jpg"
            alt=""
            fill
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            className="-z-20 object-cover object-[50%_88%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-b from-black/70 via-black/10 to-transparent"
          />
          <div className="mx-auto flex max-w-290 items-center justify-between gap-4 px-6 py-5">
            <HeaderLogo light />
            <Wordmark />
          </div>
        </header>
        <main className="mx-auto grid max-w-290 gap-8 px-6 py-10 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-12 md:py-14">
          <div>
            <h1 className="font-display text-[clamp(36px,11vw,72px)] leading-[1.02] font-normal tracking-tighter italic">
              Sip, Stay, Enjoy.
            </h1>
            <p className="mt-5 max-w-105 text-base leading-normal">
              Something good is always on the menu. Take a look around, stay a
              while, and just enjoy.
            </p>
            <div aria-hidden="true" className="mt-3 h-1.5 w-35 bg-accent" />
          </div>
          <div className="grid gap-5 rounded-lg bg-ink p-5 text-paper [&_button]:focus-visible:outline-paper">
            {visitNotice}
            <button
              id="view-menu"
              type="button"
              className={primaryButton}
              onClick={() => changeScreen("menu")}
            >
              View menu <Coffee aria-hidden="true" size={19} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-290 items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Back to welcome"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-muted"
            onClick={() => changeScreen("welcome")}
          >
            <HeaderLogo />
          </button>
          <Wordmark />
        </div>
      </header>
      <main
        id="menu"
        tabIndex={-1}
        aria-labelledby="menu-title"
        className="grow focus:outline-none"
      >
        <div className="mx-auto max-w-290 px-4 sm:px-6">
          <h1 id="menu-title" className="sr-only">
            Menu
          </h1>
          {(mode === "table" ||
            store.kind !== "ready" ||
            !store.data.isOpen) && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 empty:hidden">
              {table.kind === "ready" && (
                <p className="min-w-0 text-sm text-secondary wrap-anywhere">
                  <strong className="text-ink">At {table.table.name}</strong>
                  {" · "}
                  <span role="status">
                    {realtimeStatus === "live"
                      ? "Live updates"
                      : realtimeStatus === "polling"
                        ? "Checking for updates periodically"
                        : realtimeStatus === "connecting"
                          ? "Connecting to updates…"
                          : "Reconnecting · Refresh manually if needed"}
                  </span>
                </p>
              )}
              {((mode === "table" && table.kind !== "ready") ||
                store.kind !== "ready" ||
                !store.data.isOpen) && (
                <div className="w-full rounded-lg bg-ink p-4 text-paper [&_button]:focus-visible:outline-paper">
                  {visitNotice}
                </div>
              )}
            </div>
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
        </div>
      </main>
      <div className="pointer-events-none sticky bottom-0 z-10 bg-paper">
        {table.kind === "ready" && (
          <div className="mx-auto flex max-w-290 justify-end pt-2 pr-[max(16px,env(safe-area-inset-right))] pb-3 pl-[max(16px,env(safe-area-inset-left))] sm:pr-[max(24px,env(safe-area-inset-right))] sm:pl-[max(24px,env(safe-area-inset-left))]">
            <div className="pointer-events-auto flex min-w-0 items-end gap-2">
              <TableOrders
                tableName={table.table.name}
                storeOpen={store.kind === "ready" && store.data.isOpen}
                canOrder={canAdd && menu.kind === "ready"}
                orders={orders}
              />
              <SharedCart
                table={table.table}
                checkout={checkout}
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
            </div>
          </div>
        )}
        <footer className="pointer-events-auto bg-ink px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] text-center text-xs font-extrabold tracking-wider text-paper">
          GOOD FOOD. GOOD COMPANY.{" "}
          <span className="text-accent">JUST ENJOY.</span>
        </footer>
      </div>
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
    </div>
  );
}

function HeaderLogo({ light = false }: { light?: boolean }) {
  return (
    <Image
      src={light ? "/logo-white.png" : "/logo.png"}
      alt=""
      width={1096}
      height={490}
      className="h-auto w-16"
      unoptimized
    />
  );
}

function Wordmark() {
  return (
    <span className="text-2xl leading-none font-black tracking-[-0.07em]">
      ENJOYER<span className="text-accent">.</span>
    </span>
  );
}
