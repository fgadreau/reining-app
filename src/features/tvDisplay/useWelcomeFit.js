import { useLayoutEffect, useRef } from "react";

// Fit only the waiting card. Reset to the approved natural sizes on every resize
// so a short title or a larger viewport immediately regains its original layout.
export function useWelcomeFit(dependencies) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return undefined;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      panel.removeAttribute('data-welcome-fit');
      const title = panel.querySelector('.tv-center-title');
      const subtitle = panel.querySelector('.tv-center-subtitle');
      const style = getComputedStyle(panel);
      const base = { title: parseFloat(getComputedStyle(title).fontSize), subtitle: subtitle ? parseFloat(getComputedStyle(subtitle).fontSize) : 0,
        gap: parseFloat(style.rowGap), padding: parseFloat(style.paddingTop) };
      const fits = () => {
        const box = panel.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(panel).paddingTop) + 1;
        return [...panel.children].every(child => {
          if (!child.getClientRects().length) return true;
          const r = child.getBoundingClientRect();
          return r.top >= box.top + inset && r.bottom <= box.bottom - inset && r.left >= box.left && r.right <= box.right;
        });
      };
      if (fits()) return;
      const apply = scale => {
        panel.dataset.welcomeFit = '';
        panel.style.setProperty('--welcome-title', `${Math.max(Math.min(34, base.title), base.title * scale)}px`);
        panel.style.setProperty('--welcome-subtitle', `${Math.max(Math.min(24, base.subtitle), base.subtitle * scale)}px`);
        panel.style.setProperty('--welcome-gap', `${Math.max(4, base.gap * scale)}px`);
        panel.style.setProperty('--welcome-padding', `${Math.max(8, base.padding * scale)}px`);
      };
      let low = 0.25, high = 1;
      apply(low);
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2; apply(mid);
        if (fits()) low = mid; else high = mid;
      }
      apply(low);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(panel);
    document.fonts?.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, dependencies);
  return ref;
}
