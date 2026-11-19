import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

import { prefersReducedMotion } from "@/lib/motion";

export default function useIntroReveal() {
  const intro = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const elements = intro.current?.querySelectorAll("[data-intro]");
      if (!elements?.length || prefersReducedMotion()) return;
      gsap.fromTo(
        elements,
        { y: 18, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    },
    { scope: intro },
  );

  return intro;
}
