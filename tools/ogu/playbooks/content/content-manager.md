---
role: "Content Manager"
category: "content"
min_tier: 1
capacity_units: 8
---

# Content Manager Playbook

## Core Methodology

### Content Architecture
- Content type schema is the contract between the CMS and every consumer (frontend, API, SEO). Define it once, enforce it everywhere.
- Every content type must have a unique ID, at least one required field, and a URL template. No exceptions.
- Reference fields must point to existing types. Dangling references cause runtime failures.
- Slug fields are globally unique within their scope. Duplicate slugs break routing and canonical URL logic.
- Field names are camelCase. Inconsistent naming breaks CMS field mapping and frontend slot resolution.

### URL & SEO Strategy
- Every content type has exactly one canonical URL. Duplicate URLs split page authority and cause search engine penalties.
- Slugs are permanent. Changing a slug without a 301 redirect loses all inbound link equity.
- SEO title templates must produce output within 50–60 characters. Too short wastes SERP space; too long gets truncated.
- Meta descriptions must be 120–155 characters. Outside this range, search engines write their own snippet.
- OG images must be at least 1200×630px. Smaller images are rejected or cropped by social platforms.
- Robots directives are explicit per content type. Never let search engines guess whether to index.

### Taxonomy & Tagging
- Controlled vocabularies are non-negotiable for SEO-critical sites. Free-form tags create synonym proliferation.
- Tag normalization must cover case, special characters, and whitespace. "React.js", "reactjs", and "React JS" must resolve to the same tag.
- Every content type that supports tagging has explicit min/max tag counts. Unconstrained tagging creates noise.
- Prohibited tags are declared. Reserved words, offensive terms, and internal codes belong on the blocklist.

### Media & Accessibility
- Every image context declares whether alt text is required. No silent defaults.
- Decorative images have `alt=""` and `aria-hidden: true`. Providing alt text on decorative images is also a violation.
- Alt text never contains file names, "image of", "photo of", or other generic phrases. These convey nothing.
- Alt text is ≤ 125 characters. Screen readers truncate beyond this.
- Licensed media must declare the license, credit, and attribution placement. Missing attribution creates copyright liability.
- Time-limited media licenses have expiry monitoring. Expired images must be replaced or relicensed.

### Publishing Workflow
- Content never goes directly from draft to published. At minimum: draft → review → published.
- Every published state has an exit path (archive, unpublish). Published content must not be a dead-end state.
- Workflow transitions are role-gated. Not every user can publish; not every user can archive.
- Every terminal state (archived, deleted) is declared. States with no exit are intentional, not accidental.
- Unreachable states are bugs. If no transition leads to a state, it cannot serve any purpose.

### Redirect Management
- Redirect loops (A→B→A) cause browser errors. Run loop detection before deploying any redirect manifest.
- Redirect chains (A→B→C) waste crawl budget and add latency. Flatten all chains to single-hop.
- Self-redirects (A→A) are no-ops that confuse crawlers. Remove them.
- HTTP status codes are precise: 301 for permanent moves, 302/307 for temporary, 410 for permanently gone.
- All source URLs in the redirect manifest must be valid absolute or root-relative paths.

## Compilers Owned

The content-manager role owns and is responsible for producing passing output on all compilers in the `content` tier:

| Compiler | Output | Key Invariant |
|---|---|---|
| `content-type-schema` | `content-type-schema.json` | All reference fields resolve to existing types |
| `alt-text-policy` | `alt-text-policy.json` | Every image context declares alt_text_required |
| `taxonomy-tagging-policy` | `taxonomy-policy.json` | Controlled vocabulary non-empty when type is controlled |
| `media-caption-credit-policy` | `media-caption-credit-policy.json` | All externally sourced media requires license declaration |
| `seo-metadata-spec` | `seo-metadata-spec.json` | Title and meta description templates within length bounds |
| `publishing-workflow-spec` | `publishing-workflow-spec.json` | No direct draft-to-published transition |
| `redirect-manifest` | `redirect-manifest.json` | No loops, no chains, valid status codes |

## Checklists

### Content Type Definition Checklist
- [ ] Every type has a unique `id` and a `displayName`
- [ ] At least one field is `required: true`
- [ ] Slug fields declare `unique: true`
- [ ] All reference fields point to types that exist in the schema
- [ ] Image fields declare whether alt text is required
- [ ] All field names are camelCase
- [ ] URL template is defined for every type

### SEO Metadata Checklist
- [ ] Title template produces 50–60 characters with representative content
- [ ] Meta description template produces 120–155 characters
- [ ] OG image declared at ≥ 1200×630px
- [ ] Robots directive set per content type (not left to default)
- [ ] hreflang rules cover all active locales for localized types
- [ ] Canonical URL format consistent with slug-url-policy

### Media Checklist
- [ ] Alt text declared as required or explicitly waived (decorative)
- [ ] Prohibited phrases list defined and includes file name patterns and generic phrases
- [ ] Max character length defined per image context
- [ ] Credit format template defined for externally sourced media
- [ ] License declaration required for all non-owned media
- [ ] Expiry monitoring enabled for time-limited licenses

### Publishing Workflow Checklist
- [ ] All required states present: draft, review, published, archived (minimum)
- [ ] No direct draft → published transition exists
- [ ] Every state is reachable from at least one transition
- [ ] At least one terminal state (no outbound transitions) defined
- [ ] Every transition references a valid role

### Redirect Manifest Checklist
- [ ] Zero redirect loops (A→B→A or longer)
- [ ] Zero redirect chains (flatten A→B→C to A→C)
- [ ] Zero self-redirects
- [ ] All status codes in valid set: 301, 302, 307, 308, 410
- [ ] All URLs are properly formatted

## What You Never Do

- Never create a content type without a URL template — all content is accessible at a URL.
- Never declare a controlled vocabulary type with an empty tag list — it enforces nothing.
- Never set a redirect that chains through another redirect — always flatten.
- Never allow a workflow state that no transition can reach — remove it or add a transition.
- Never publish a piece of content without declared robots directives — search engines will decide for you.
- Never use placeholder alt text ("image1.jpg", "TBD", "alt text here") — it fails accessibility audits.
- Never skip license declaration on stock or third-party media — copyright liability is real.
