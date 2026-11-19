import { peso } from "@/lib/shop-format";
import type { MenuCategoriesProps } from "@/types/menu";

export default function MenuCategories({
  categories,
  canAdd,
  onSelect,
}: MenuCategoriesProps) {
  if (categories.length === 0) {
    return (
      <div className="py-10.5 text-secondary">
        Nothing on the menu right now. Please check back soon.
      </div>
    );
  }
  return (
    <>
      <nav
        className="sticky top-0 z-5 flex gap-2 overflow-x-auto border-b border-line bg-paper py-4.25 scrollbar-thin"
        aria-label="Menu categories"
      >
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            className="shrink-0 rounded border border-line px-3.5 py-2.25 text-[13px] font-bold hover:border-accent hover:bg-accent"
            onClick={() => {
              document.getElementById(`heading-${category.id}`)?.focus();
              document
                .getElementById(`category-${category.id}`)
                ?.scrollIntoView();
            }}
          >
            {category.name}
          </button>
        ))}
      </nav>
      <div>
        {categories.map((category, index) => (
          <section
            className="scroll-mt-17.5 border-b border-line pt-11 pb-6.5 max-[720px]:pt-9"
            id={`category-${category.id}`}
            key={category.id}
            aria-labelledby={`heading-${category.id}`}
          >
            <div className="mb-5 flex items-baseline gap-4 max-[420px]:flex-wrap max-[420px]:gap-2.25">
              <span className="shrink-0 font-mono text-[10px] font-extrabold tracking-[0.17em] whitespace-nowrap text-[#615b50]">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(categories.length).padStart(2, "0")}
              </span>
              <h3
                className="m-0 text-[clamp(25px,4vw,36px)] leading-[1.1] font-black tracking-[-0.06em]"
                id={`heading-${category.id}`}
                tabIndex={-1}
              >
                {category.name}
              </h3>
              <span className="ml-auto font-mono text-[10px] font-extrabold tracking-[0.17em] whitespace-nowrap text-[#615b50] max-[420px]:text-[9px]">
                {category.items.length} ITEMS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-12 max-[720px]:grid-cols-1">
              {category.items.map((item) => (
                <article
                  className="flex min-w-0 items-start justify-between gap-3 border-t border-line pt-4.75 pb-5.5"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <h4
                        className={`m-0 text-[17px] leading-[1.35] font-extrabold tracking-[-0.03em]${item.isAvailable ? "" : " text-[#69645c]"}`}
                      >
                        {item.name}
                      </h4>
                      {item.isSpicy && (
                        <span
                          className="text-base text-[#d9381e]"
                          aria-label="Spicy"
                          title="Spicy"
                        >
                          ✳
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p
                        className={`mt-1.5 max-w-85 text-[13px] leading-normal ${item.isAvailable ? "text-secondary" : "text-[#69645c]"}`}
                      >
                        {item.description}
                      </p>
                    )}
                    {!item.isAvailable && (
                      <span className="mt-2.5 inline-block rounded bg-[#f8e7c3] px-2 py-1.5 text-[10px] font-extrabold tracking-[0.17em] text-[#6b3e07]">
                        SOLD OUT TODAY
                      </span>
                    )}
                    {canAdd && item.isAvailable && (
                      <button
                        className="mt-3.5 inline-flex items-center gap-2.5 rounded-md border border-ink px-2.75 py-2.25 text-xs font-extrabold hover:border-accent hover:bg-accent"
                        type="button"
                        onClick={() => onSelect(item)}
                      >
                        Customize item <span aria-hidden="true">↗</span>
                      </button>
                    )}
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 font-mono text-sm whitespace-nowrap ${item.isAvailable ? "" : "text-[#69645c]"}`}
                  >
                    {peso(item.price)}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
