---
name: performance-web
description: Optimizes web application performance including Core Web Vitals, bundle size, and load times. Use when improving page speed, auditing performance, or reducing Time to Interactive. Triggers: "web performance", "Core Web Vitals", "Lighthouse score", "bundle size", "page load", "TTI", "LCP".
---

# Web Performance

## When to Use
- Lighthouse performance score is below acceptable threshold
- Users are reporting slow load times
- Preparing a page for high traffic or SEO optimization

## Workflow
1. Audit with Lighthouse and WebPageTest on realistic (3G) network conditions
2. Fix render-blocking resources: defer non-critical JS, inline critical CSS
3. Optimize images: WebP/AVIF formats, responsive srcset, lazy loading
4. Reduce bundle size: code splitting per route, tree shaking, analyze with bundle analyzer
5. Set performance budgets and enforce in CI to prevent regressions

## Quality Bar
- LCP < 2.5s, FID < 100ms, CLS < 0.1 on 3G mobile
- Total JavaScript bundle for initial load < 200KB gzipped
- All images have explicit width/height to prevent layout shifts
- Performance regression test in CI catches bundle size increases > 5KB
