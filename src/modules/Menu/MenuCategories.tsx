import { Flame, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { primaryButton } from "@/components/button-styles";
import { peso } from "@/lib/shop-format";
import type { MenuCategoriesProps } from "@/types/menu";

export default function MenuCategories({
  categories,
  canAdd,
  onSelect,
}: MenuCategoriesProps) {
  const tabsId = useId();
  const tabsStart = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number>();
  const selectedIndex = Math.max(
    0,
    categories.findIndex(({ id }) => id === selectedId),
  );
  const category = categories[selectedIndex];
  const tabId = (id: number) => `${tabsId}-tab-${id}`;
  const panelId = `${tabsId}-panel`;

  function selectCategory(id: number) {
    if (id === category?.id) return;
    setSelectedId(id);
    const start = tabsStart.current;
    if (start && start.getBoundingClientRect().top < 0) start.scrollIntoView();
  }

  if (!category) {
    return (
      <div className="py-10.5 text-secondary">
        Nothing on the menu right now. Please check back soon.
      </div>
    );
  }
  return (
    <>
      <div ref={tabsStart} />
      <div
        role="tablist"
        className="sticky top-0 z-5 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-paper px-4 py-2.5 scrollbar-thin sm:mx-0 sm:px-2"
        aria-label="Menu categories"
      >
        {categories.map((tab, index) => (
          <button
            type="button"
            role="tab"
            id={tabId(tab.id)}
            key={tab.id}
            aria-selected={tab.id === category.id}
            aria-controls={panelId}
            tabIndex={tab.id === category.id ? 0 : -1}
            className="min-h-11 shrink-0 rounded-md border border-line px-3 text-sm font-bold hover:border-control hover:bg-muted aria-selected:border-ink"
            onClick={() => selectCategory(tab.id)}
            onKeyDown={(event) => {
              let nextIndex: number;
              switch (event.key) {
                case "ArrowRight":
                  nextIndex = (index + 1) % categories.length;
                  break;
                case "ArrowLeft":
                  nextIndex =
                    (index + categories.length - 1) % categories.length;
                  break;
                case "Home":
                  nextIndex = 0;
                  break;
                case "End":
                  nextIndex = categories.length - 1;
                  break;
                default:
                  return;
              }
              event.preventDefault();
              const nextId = categories[nextIndex].id;
              const nextTab = document.getElementById(tabId(nextId));
              nextTab?.focus({ preventScroll: true });
              nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
              selectCategory(nextId);
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <section
        className="border-b border-line py-6"
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(category.id)}
        tabIndex={0}
      >
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="col-span-2 font-mono text-xs text-secondary">
            {String(selectedIndex + 1).padStart(2, "0")} /{" "}
            {String(categories.length).padStart(2, "0")}
          </span>
          <h2 className="text-[clamp(24px,4vw,34px)] leading-tight font-bold tracking-tight wrap-anywhere">
            {category.name}
          </h2>
          <span className="font-mono text-xs whitespace-nowrap text-secondary">
            {category.items.length}{" "}
            {category.items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {category.items.length === 0 && (
          <p className="text-secondary">No items in this category right now.</p>
        )}
        <div className="grid gap-3 min-[721px]:grid-cols-2">
          {category.items.map((item) => (
            <article
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start items-baseline gap-x-3 gap-y-2 rounded-lg border border-line p-3.5 sm:p-4"
              key={item.id}
            >
              <div className="flex min-w-0 items-baseline gap-1.5">
                <h3
                  className={`text-base leading-snug font-extrabold wrap-anywhere${item.isAvailable ? "" : " text-secondary"}`}
                >
                  {item.name}
                </h3>
                {item.isSpicy && (
                  <span
                    className="shrink-0 self-center text-danger"
                    title="Spicy"
                  >
                    <Flame size={16} aria-hidden="true" />
                    <span className="sr-only">Spicy</span>
                  </span>
                )}
              </div>
              <span className="font-mono text-sm whitespace-nowrap">
                {peso(item.price)}
              </span>
              {item.description && (
                <p className="col-span-2 text-sm leading-normal text-secondary">
                  {item.description}
                </p>
              )}
              {!item.isAvailable && (
                <span className="col-span-2 w-fit rounded-md bg-muted px-2.5 py-1.5 text-xs font-extrabold text-secondary">
                  SOLD OUT TODAY
                </span>
              )}
              {canAdd && item.isAvailable && (
                <button
                  className={`${primaryButton} col-span-2 mt-1 max-w-33 justify-self-end`}
                  type="button"
                  onClick={() => onSelect(item)}
                >
                  Add to Order
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
