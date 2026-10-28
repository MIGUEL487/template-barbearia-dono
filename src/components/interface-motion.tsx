"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Animate: viewport entrances (WAAPI), gesture responses (CSS), no layout animation.
// Default content is visible, including without JavaScript or with reduced motion.
export function InterfaceMotion() {
  const path = usePathname();
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const active = new Set<Animation>();
    const selector = '.site-header .brand, .site-header > .cta, .admin-sidebar nav > a, .admin-mobile-brand, .admin-more > *, .admin-login form, .booking-actions > *, .demo-success > *, [data-motion], h1, h2, .service-row, .team-member, .gallery-piece, .proof > *, .how-section li, .admin-content header, .admin-content article, .admin-content tbody tr, .metric-overview > div, .admin-content form, .admin-content .rounded-xl, .booking-shell > form, .choice, .booking-summary, .field-label, [role="dialog"], .admin-more';
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (media.matches || document.hidden) continue;
        const animation = entry.target.animate(
          [{ translate: "0 16px" }, { translate: "0 0" }],
          { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" },
        );
        active.add(animation);
        animation.onfinish = animation.oncancel = () => active.delete(animation);
      }
    }, { threshold: .08 });
    const scan = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (seen.has(el) || el.closest(".cinematic, .ritual")) return;
        seen.add(el);
        // Keep fixed overlays and nested surfaces stable; animate their content.
        if (getComputedStyle(el).position === "fixed" || el.parentElement?.closest('[data-motion], .service-row, .team-member, .gallery-piece, .metric-overview > div, .choice, .admin-content form, .admin-content .rounded-xl')) return;
        observer.observe(el);
      });
      for (const animation of active) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target && !target.isConnected) animation.cancel();
      }
    };
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan(); });
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    const visibility = () => active.forEach(a => document.hidden ? a.pause() : a.play());
    const preference = () => { if (media.matches) active.forEach(a => a.cancel()); };
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    scan();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect(); observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", preference);
      active.forEach(a => a.cancel()); active.clear();
    };
  }, [path]);
  return null;
}
