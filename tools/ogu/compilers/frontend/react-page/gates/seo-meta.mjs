/**
 * Gate: seo-meta
 * Every page must declare its title via one of:
 * - document.title = "..."
 * - <title> tag
 * - Next.js: export const metadata = { title: "..." } or generateMetadata()
 * - React Helmet: <Helmet><title>...</title></Helmet>
 * - Vite/React Router: <Head><title>...</title></Head>
 */
import { readFileSync, existsSync } from "fs";

const SEO_PATTERNS = [
  /document\.title\s*=/,
  /<title[\s>]/,
  /export\s+const\s+metadata\s*=/,
  /generateMetadata\s*\(/,
  /<Helmet\b/,
  /<Head\b/,
  /useTitle\s*\(/,
  /useMeta\s*\(/,
];

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP010", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const hasSeo = SEO_PATTERNS.some(re => re.test(content));

  if (!hasSeo) {
    return {
      pass: false,
      code: "RP010",
      message: "Page missing SEO title declaration",
      detail: {
        accepted: [
          "document.title = 'User Profile'",
          "export const metadata = { title: 'User Profile' }  // Next.js App Router",
          "<Helmet><title>User Profile</title></Helmet>  // React Helmet",
          "<Head><title>User Profile</title></Head>  // Next.js Pages Router",
        ],
      },
    };
  }

  return { pass: true };
}
