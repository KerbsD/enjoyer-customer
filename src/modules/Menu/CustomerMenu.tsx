"use client";

import Link from "next/link";

import { type StoreStatus } from "@/api/public";
import { peso, shopClock, shopTime } from "@/lib/shop-format";

import usePublicMenu from "./usePublicMenu";
import useTableVisit from "./useTableVisit";

function ClosedNotice({ status }: { status: StoreStatus }) {
  if (status.isOpen) return null;
  const today = status.today;
  const hours =
    today.closed || !today.openTime || !today.closeTime
      ? "Closed today"
      : `Today's hours: ${shopClock(today.openTime)} – ${shopClock(today.closeTime)}`;
  return (
    <div className="closed-notice" role="status">
      <span className="notice-icon" aria-hidden="true">
        ✳
      </span>
      <div>
        <strong>We&apos;re closed right now</strong>
        <p>Feel free to browse. Ordering opens during shop hours.</p>
        <p className="notice-hours">
          {hours}
          {status.nextOpen ? ` · Next open ${shopTime(status.nextOpen)}` : ""}
        </p>
      </div>
    </div>
  );
}

export default function CustomerMenu({ mode }: { mode: "browse" | "table" }) {
  const { menu, store, retryPublic } = usePublicMenu();
  const { table, retryTable, startNewVisit } = useTableVisit(mode);

  return (
    <div className="site">
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          document.getElementById("menu")?.focus();
          document.getElementById("menu")?.scrollIntoView();
        }}
      >
        Skip to menu
      </button>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="wordmark" aria-label="Enjoyer menu">
            ENJOYER<span>.</span>
          </Link>
          <span className="header-label">
            THE MENU <span aria-hidden="true">/</span> JUST ENJOY.
          </span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div className="intro-inner">
            <div className="intro-copy">
              <p className="eyebrow">
                <span className="yellow-dot" /> FOOD, DRINKS & GOOD TIMES
              </p>
              <h1>
                Find your <em>happy place.</em>
              </h1>
              <p className="intro-text">
                Something good is always on the menu. Take a look around, stay a
                while, and just enjoy.
              </p>
            </div>
            <div className="intro-stamp" aria-hidden="true">
              <span>TAKE IT EASY</span>
              <strong>☺</strong>
              <span>JUST ENJOY.</span>
            </div>
          </div>
        </section>

        <div className="content">
          {mode === "table" ? (
            <section
              className="table-strip"
              aria-live="polite"
              aria-label="Your table"
            >
              {table.kind === "ready" && (
                <>
                  <div>
                    <span className="strip-label">YOU&apos;RE AT</span>
                    <strong>{table.table.name}</strong>
                  </div>
                  <span className="strip-side">
                    TAKE YOUR TIME <span aria-hidden="true">✳</span>
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
                <div className="strip-message">
                  <p>{table.message}</p>
                  <button
                    type="button"
                    onClick={retryTable}
                  >
                    Try again
                  </button>
                </div>
              )}
              {table.kind === "ended" && (
                <div className="strip-message">
                  <p>
                    The previous visit at {table.table.name} has ended. If
                    you&apos;re at this table now, you can start a new visit.
                  </p>
                  <button type="button" onClick={() => void startNewVisit()}>
                    Start a new visit
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="browse-strip" aria-label="Ordering information">
              <span className="yellow-dot" />
              <p>Just browsing? To order, scan the QR code at your table.</p>
            </section>
          )}

          {store.kind === "ready" ? (
            <ClosedNotice status={store.data} />
          ) : store.kind === "error" ? (
            <div className="status-warning" role="status">
              Shop hours are unavailable. Please ask staff before ordering.{" "}
              <button onClick={retryPublic} type="button">
                Retry
              </button>
            </div>
          ) : (
            <p className="status-loading" role="status">
              Checking shop hours…
            </p>
          )}

          <div id="menu" tabIndex={-1} className="menu-heading">
            <div>
              <p className="eyebrow">MADE FOR THE MOMENT</p>
              <h2>What sounds good?</h2>
            </div>
            <span className="menu-heading-mark" aria-hidden="true">
              ✳
            </span>
          </div>

          {menu.kind === "loading" && (
            <div className="feedback" role="status">
              Bringing up the menu…
            </div>
          )}
          {menu.kind === "error" && (
            <div className="feedback" role="alert">
              <p>{menu.message}</p>
              <button type="button" onClick={retryPublic}>
                Try again
              </button>
            </div>
          )}
          {menu.kind === "ready" &&
            (menu.data.length === 0 ? (
              <div className="feedback">
                Nothing on the menu right now. Please check back soon.
              </div>
            ) : (
              <>
                <nav className="category-nav" aria-label="Menu categories">
                  {menu.data.map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      onClick={() => {
                        document
                          .getElementById(`heading-${category.id}`)
                          ?.focus();
                        document
                          .getElementById(`category-${category.id}`)
                          ?.scrollIntoView();
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </nav>
                <div className="category-list">
                  {menu.data.map((category, index) => (
                    <section
                      className="category"
                      id={`category-${category.id}`}
                      key={category.id}
                      aria-labelledby={`heading-${category.id}`}
                    >
                      <div className="category-title">
                        <span className="category-index">
                          {String(index + 1).padStart(2, "0")} /{" "}
                          {String(menu.data.length).padStart(2, "0")}
                        </span>
                        <h3 id={`heading-${category.id}`} tabIndex={-1}>
                          {category.name}
                        </h3>
                        <span className="category-count">
                          {category.items.length} ITEMS
                        </span>
                      </div>
                      <div className="item-grid">
                        {category.items.map((item) => (
                          <article
                            className={`menu-item${item.isAvailable ? "" : " sold-out"}`}
                            key={item.id}
                          >
                            <div className="item-info">
                              <div className="item-title">
                                <h4>{item.name}</h4>
                                {item.isSpicy && (
                                  <span
                                    className="spicy"
                                    aria-label="Spicy"
                                    title="Spicy"
                                  >
                                    ✳
                                  </span>
                                )}
                              </div>
                              {item.description && <p>{item.description}</p>}
                              {!item.isAvailable && (
                                <span className="unavailable">
                                  SOLD OUT TODAY
                                </span>
                              )}
                            </div>
                            <span className="item-price">
                              {peso(item.price)}
                            </span>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ))}
          <div className="phase-note" role="note">
            <strong>We&apos;re getting your ordering experience ready.</strong>
            <span>
              You can browse the menu now. Ordering from your phone is coming
              soon; please let our staff know what you&apos;d like.
            </span>
          </div>
        </div>
      </main>
      <footer className="footer">
        <span>
          ENJOYER<span className="footer-dot">.</span>
        </span>
        <span>GOOD FOOD. GOOD COMPANY. JUST ENJOY.</span>
      </footer>
    </div>
  );
}
