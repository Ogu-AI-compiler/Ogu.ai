# Content Manager Compiler Network
> Domain Compiler Network — Content Manager Role Decomposition
> Generated for: formal compiler network build planning
> Stack assumptions: Headless CMS (Sanity, Contentful, Strapi, Storyblok), MDX pipelines, WordPress headless
> Excludes already-built and shared/cross-role compilers

---

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `content-type-schema` | per-project | Content inventory, field definitions, validation rules | `content-type-schema.json` |
| `cms-field-mapping-spec` | per-project | Content type schema, CMS platform config, frontend slots | `cms-field-mapping.json` |
| `slug-url-policy` | per-project | URL structure rules, locale config, redirect strategy | `slug-url-policy.json` |
| `canonical-url-policy` | per-project | URL policy, route list, syndication rules | `canonical-url-policy.json` |
| `taxonomy-tagging-policy` | per-project | Tag vocabulary, category hierarchy, content types | `taxonomy-policy.json` |
| `category-hierarchy-spec` | per-project | Category list, parent-child rules, content type map | `category-hierarchy.json` |
| `seo-metadata-spec` | per-feature | Page/content type list, keyword strategy, OG requirements | `seo-metadata-spec.json` |
| `schema-org-mapping` | per-feature | Content type schema, page type list, schema.org types | `schema-org-mapping.json` |
| `alt-text-policy` | per-project | Image usage contexts, a11y requirements, field rules | `alt-text-policy.json` |
| `media-caption-credit-policy` | per-project | Media types, licensing requirements, attribution rules | `media-caption-credit-policy.json` |
| `image-asset-manifest` | per-feature | Image list, alt text, dimensions, format requirements | `image-asset-manifest.json` |
| `author-profile-spec` | per-project | Author list, required fields, schema.org Person mapping | `author-profile-spec.json` |
| `content-brief-spec` | per-feature | Topic, audience, SEO targets, format requirements | `content-brief-spec.json` |
| `article-metadata-spec` | per-feature | Article list, required metadata fields, publish rules | `article-metadata-spec.json` |
| `content-entry-manifest` | per-feature | Content type schema, field values, publish status | `content-entry-manifest.json` |
| `landing-page-content-model` | per-campaign | Page purpose, section list, CTA requirements | `landing-page-content-model.json` |
| `reusable-content-block-library` | per-project | Block type list, slot definitions, component map | `content-block-library.json` |
| `cta-copy-manifest` | per-feature | CTA placement list, copy variants, action mapping | `cta-copy-manifest.json` |
| `internal-linking-map` | per-project | Content inventory, topic clusters, anchor text rules | `internal-linking-map.json` |
| `redirect-manifest` | per-project | Old URL list, new URL list, redirect type (301/302/410) | `redirect-manifest.json` |
| `publishing-workflow-spec` | per-project | Workflow states, roles, transition rules, approval gates | `publishing-workflow-spec.json` |
| `publish-schedule-manifest` | per-campaign | Content list, publish dates/times, timezone, priority | `publish-schedule-manifest.json` |
| `content-versioning-policy` | per-project | CMS versioning config, rollback rules, diff requirements | `content-versioning-policy.json` |
| `archive-unpublish-policy` | per-project | Staleness rules, redirect requirements, link audit rules | `archive-unpublish-policy.json` |
| `localization-content-spec` | per-feature | Locale list, field-level translation rules, fallback policy | `localization-content-spec.json` |
| `compliance-disclaimer-policy` | per-project | Regulated content types, disclaimer text, expiry rules | `compliance-disclaimer-policy.json` |
| `legal-approval-manifest` | per-feature | Content requiring legal review, approval states, expiry | `legal-approval-manifest.json` |
| `campaign-content-bundle` | per-campaign | Campaign brief, content list, variant map, schedule | `campaign-content-bundle.json` |
| `experiment-content-variant-spec` | per-campaign | Feature flag config, variant content, goal events | `experiment-content-spec.json` |
| `editorial-calendar` | per-project | Content pipeline, publish schedule, author assignments | `editorial-calendar.json` |
| `content-review-checklist` | per-feature | Quality rules, SEO gates, a11y gates, compliance gates | `content-review-checklist.json` |
| `stale-content-audit-report` | daily | Content inventory, last-modified dates, link validity | `stale-content-audit.json` |
| `content-refresh-plan` | per-project | Stale audit output, refresh priority rules | `content-refresh-plan.json` |
| `newsletter-distribution-manifest` | per-campaign | Recipient segments, content blocks, schedule, tracking | `newsletter-manifest.json` |
| `content-migration-manifest` | per-project | Source content, target CMS schema, field mapping | `content-migration-manifest.json` |
| `structured-faq-schema` | per-feature | Question list, answer content, schema.org FAQPage mapping | `faq-schema.json` |
| `content-analytics-mapping` | per-project | Content type list, tracking fields, event taxonomy | `content-analytics-mapping.json` |
| `moderation-policy` | per-project | User-generated content types, moderation rules, actions | `moderation-policy.json` |

---

## Detailed Breakdown

---

### 1. `content-type-schema`

**Frequency:** per-project

**Input:**
- Content inventory (what types of content exist: article, landing page, FAQ, product page, author, etc.)
- Field definitions per type (field name, type, required flag, validation rules)
- CMS platform target
- Validation constraint requirements

**Output:**
- `content-type-schema.json` — CMS-agnostic content type definitions: type ID, display name, field list (name, type, required, validation, localization flag, UI hint), relationship definitions (references between types), preview URL template

**Spec file:** `content-type-schema.spec.json`
```json
{
  "types": [
    {
      "id": "article",
      "displayName": "Article",
      "fields": [
        { "name": "title", "type": "string", "required": true, "maxLength": 100 },
        { "name": "slug", "type": "slug", "required": true, "unique": true },
        { "name": "body", "type": "richtext", "required": true },
        { "name": "author", "type": "reference", "referenceTo": "author", "required": true },
        { "name": "heroImage", "type": "image", "required": true },
        { "name": "seoTitle", "type": "string", "required": false, "maxLength": 60 }
      ]
    }
  ]
}
```

**Correctness Gates:**
1. Every content type has a unique `id` and a `displayName`
2. Every content type has at least one `required: true` field
3. Every `slug` field is declared `unique: true`
4. Reference fields declare their `referenceTo` type, which must exist in the schema
5. No circular reference dependencies exist (type A references type B which references type A — only if not explicitly permitted as bidirectional)
6. `richtext` fields declare allowed block types (not open-ended by default)
7. Image fields declare whether alt text is required at the field level
8. Field names follow a consistent naming convention (camelCase enforced)

**Error Codes:**
- `CM001` — Duplicate content type ID
- `CM002` — Reference field references non-existent content type
- `CM003` — Slug field missing unique constraint
- `CM004` — Image field missing alt text requirement declaration
- `CM005` — Field name violates naming convention

**Key Invariant:** Compiler must fail if any reference field's `referenceTo` value is not a defined content type in the schema.

**Safe Default:** Without content-type-schema, CMS fields are created ad-hoc with inconsistent naming, no validation, and no required field enforcement.

**Dependencies:**
- Content inventory (external input)

**Downstream Consumers:**
- `cms-field-mapping-spec`
- `content-entry-manifest`
- `article-metadata-spec`
- `landing-page-content-model`
- `seo-metadata-spec`
- `schema-org-mapping`
- `content-migration-manifest`
- Nearly all content compilers

---

### 2. `cms-field-mapping-spec`

**Frequency:** per-project

**Input:**
- `content-type-schema.json`
- CMS platform config (Sanity schema, Contentful model, etc.)
- Frontend component slot definitions (from `react-component` or `react-page` artifacts)
- Environment list (dev, staging, prod)

**Output:**
- `cms-field-mapping.json` — field-to-frontend mapping: content type ID, field name, CMS field ID (platform-specific), frontend slot reference, transformation rule (if field format differs from display format), environment-specific overrides

**Spec file:** `cms-field-mapping.spec.json`

**Correctness Gates:**
1. Every field in `content-type-schema` has a corresponding CMS field ID entry
2. Every frontend slot reference resolves to an existing `react-component` or `react-page` prop
3. Transformation rules are declared when CMS field type differs from frontend prop type
4. Environment-specific overrides are enumerated (no implicit inheritance)
5. No field is mapped to a non-existent frontend slot
6. Cross-compiler: every slot reference must exist in the corresponding `react-page` or `react-component` artifact

**Error Codes:**
- `CM010` — Content type field has no CMS field ID mapping
- `CM011` — Frontend slot reference not found in react-component/react-page artifact
- `CM012` — Type mismatch between CMS field and frontend slot with no transformation rule
- `CM013` — Environment override references undefined environment
- `CM014` — CMS field ID duplicated across mappings

**Key Invariant:** Compiler must fail if any field in `content-type-schema` has no corresponding CMS field ID in the mapping.

**Safe Default:** Without cms-field-mapping-spec, CMS fields are connected to frontend props through developer convention alone, causing field name drift and broken content rendering.

**Dependencies:**
- `content-type-schema.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `content-migration-manifest`
- `localization-content-spec`

---

### 3. `slug-url-policy`

**Frequency:** per-project

**Input:**
- URL structure requirements (path format, depth limits)
- Locale config (URL prefix per locale: `/en/`, `/fr/`, etc.)
- Redirect strategy (what happens when slug changes)
- Content type URL templates

**Output:**
- `slug-url-policy.json` — slug generation rules: per-content-type URL template (e.g., `/blog/{slug}`, `/products/{category}/{slug}`), allowed characters, max length, locale prefix rules, uniqueness scope (global / per-type / per-locale), auto-redirect-on-change rule, forbidden slug values (reserved words)

**Spec file:** `slug-url-policy.spec.json`

**Correctness Gates:**
1. Every content type has a URL template defined
2. URL templates use only declared path variables (no undefined `{variable}` placeholders)
3. Max slug length is defined and ≤ 75 characters (for URL length management)
4. Allowed character set is declared (typically `[a-z0-9-]`)
5. Forbidden slug values list is non-empty (at minimum: `admin`, `api`, `static`, `null`)
6. Auto-redirect-on-change rule is one of: `create-301` | `create-302` | `fail` | `manual`
7. Locale prefix rules cover all declared locales

**Error Codes:**
- `CM020` — Content type missing URL template
- `CM021` — URL template contains undefined path variable
- `CM022` — Max slug length not defined
- `CM023` — Forbidden slug values list is empty
- `CM024` — Auto-redirect-on-change rule not declared

**Key Invariant:** Compiler must fail if any content type has no URL template defined.

**Safe Default:** Without slug-url-policy, slugs are generated arbitrarily, creating URL inconsistencies, SEO fragmentation, and duplicate slug conflicts.

**Dependencies:**
- `content-type-schema.json`
- `localization-content-spec` (soft — locale prefixes)

**Downstream Consumers:**
- `canonical-url-policy`
- `redirect-manifest`
- `seo-metadata-spec`
- `internal-linking-map`
- `article-metadata-spec`

---

### 4. `canonical-url-policy`

**Frequency:** per-project

**Input:**
- `slug-url-policy.json`
- Route list (from `react-page` or `api-route` artifacts)
- Syndication partner list (if content is republished externally)
- Paginated content rules

**Output:**
- `canonical-url-policy.json` — canonical URL rules: per-content-type canonical URL format, self-referential canonical rule (default for all originating content), syndication override rules (for externally republished content), paginated content canonical rules (page 1 = canonical, pages 2+ point to page 1), duplicate content resolution strategy

**Spec file:** `canonical-url-policy.spec.json`

**Correctness Gates:**
1. Every content type has a canonical URL format defined
2. Self-referential canonical is the default rule (every original piece of content declares itself canonical)
3. Syndicated content declares the originating URL as canonical (not the syndication URL)
4. Paginated content: page 1 is canonical; pages > 1 point to page 1 (not to themselves)
5. Canonical URL format is consistent with `slug-url-policy` URL templates
6. No two different content types share a canonical URL pattern that could produce identical URLs
7. Cross-compiler: canonical URL format must map to a valid route in the `react-page` artifact registry

**Error Codes:**
- `CM030` — Content type missing canonical URL format
- `CM031` — Syndicated content missing originating URL declaration
- `CM032` — Paginated content page > 1 missing canonical to page 1
- `CM033` — Canonical URL format conflicts with slug-url-policy template
- `CM034` — Canonical URL maps to non-existent route

**Key Invariant:** Compiler must fail if any content type has no canonical URL format and is accessible at more than one URL.

**Safe Default:** Without canonical-url-policy, search engines index multiple URL variants of the same content, splitting page authority and causing duplicate content penalties.

**Dependencies:**
- `slug-url-policy.json`

**Downstream Consumers:**
- `seo-metadata-spec`
- `redirect-manifest`
- `article-metadata-spec`

---

### 5. `taxonomy-tagging-policy`

**Frequency:** per-project

**Input:**
- Tag vocabulary (controlled vocabulary vs free-form)
- Content types that support tagging
- Tag hierarchy requirements (flat vs hierarchical)
- Minimum/maximum tag count requirements
- Tagging governance rules

**Output:**
- `taxonomy-policy.json` — tagging rules: vocabulary type (`controlled` / `free-form` / `hybrid`), controlled vocabulary list (if applicable), per-content-type tag rules (min/max count, allowed vocabularies), tag normalization rules (lowercase, no special characters), prohibited tags list, tag merging/aliasing rules

**Spec file:** `taxonomy-policy.spec.json`

**Correctness Gates:**
1. Vocabulary type is declared: `controlled` | `free-form` | `hybrid`
2. For controlled vocabulary: tag list is non-empty and each tag has a unique ID
3. Per-content-type tag rules are defined for every content type that supports tagging
4. Min/max tag counts are numeric (not "a few" or "several")
5. Tag normalization rules cover: case, special characters, whitespace
6. Prohibited tags list is present (even if empty — must be explicitly declared)
7. Cross-compiler: tags used in content entries must resolve to approved vocabulary entries for controlled types

**Error Codes:**
- `CM040` — Vocabulary type not declared
- `CM041` — Controlled vocabulary list is empty
- `CM042` — Content type missing tag count rules
- `CM043` — Tag count min/max is non-numeric
- `CM044` — Tag normalization rules not defined

**Key Invariant:** Compiler must fail if a controlled vocabulary type is declared but the vocabulary list is empty.

**Safe Default:** Without taxonomy-tagging-policy, tags are applied inconsistently (mixed case, spelling variants), destroying taxonomy integrity and breaking tag-based navigation.

**Dependencies:**
- `content-type-schema.json`
- `category-hierarchy-spec.json`

**Downstream Consumers:**
- `article-metadata-spec`
- `content-entry-manifest`
- `internal-linking-map`
- `seo-metadata-spec`
- `stale-content-audit-report`

---

### 6. `category-hierarchy-spec`

**Frequency:** per-project

**Input:**
- Category list with intended parent-child relationships
- Content types that use categories
- Navigation/filtering requirements
- Maximum hierarchy depth

**Output:**
- `category-hierarchy.json` — category tree definition: category ID, slug, label, parent category ID, depth, content types assigned, child count, SEO description, active flag

**Spec file:** `category-hierarchy.spec.json`

**Correctness Gates:**
1. Every category has a unique `id` and a unique `slug` within its parent scope
2. Every non-root category has a valid `parent` ID that exists in the hierarchy
3. No circular parent-child relationships exist
4. Hierarchy depth does not exceed the declared maximum
5. Every category has at least one content type assigned
6. Every leaf category (no children) has at least one content item assigned (or is flagged `planned`)
7. Category slugs follow `slug-url-policy` normalization rules

**Error Codes:**
- `CM050` — Duplicate category slug within parent scope
- `CM051` — Parent ID references non-existent category
- `CM052` — Circular parent-child relationship detected
- `CM053` — Hierarchy depth exceeds declared maximum
- `CM054` — Leaf category has no content and is not flagged planned

**Key Invariant:** Compiler must fail if any non-root category references a parent ID that does not exist in the hierarchy.

**Safe Default:** Without category-hierarchy-spec, categories accumulate ad-hoc, creating navigation inconsistencies and orphaned category pages.

**Dependencies:**
- `slug-url-policy.json`

**Downstream Consumers:**
- `taxonomy-tagging-policy`
- `internal-linking-map`
- `seo-metadata-spec`
- `landing-page-content-model`

---

### 7. `seo-metadata-spec`

**Frequency:** per-feature

**Input:**
- `canonical-url-policy.json`
- `content-type-schema.json`
- Page/content type list
- Title tag length constraints (50–60 characters)
- Meta description length constraints (120–155 characters)
- Open Graph requirements
- Twitter Card requirements

**Output:**
- `seo-metadata-spec.json` — per-content-type SEO metadata rules: title tag template, meta description template, title max/min length, meta description max/min length, OG title/description/image rules, Twitter Card type, robots directive rules (index/noindex per type), hreflang rules per locale

**Spec file:** `seo-metadata-spec.spec.json`

**Correctness Gates:**
1. Every content type has a title tag template defined
2. Title tag template produces output within 50–60 character range (validated with sample data)
3. Meta description template produces output within 120–155 character range
4. OG image dimensions are declared (minimum 1200×630px)
5. Robots directive is declared per content type (`index,follow` | `noindex,nofollow` | etc.)
6. hreflang rules cover all declared locales for content types that are localized
7. Cross-compiler: SEO title template must use fields that exist in `content-type-schema`
8. Cross-compiler: canonical URL in meta tags must follow `canonical-url-policy` format
9. Cross-compiler: every content type in this spec maps to a valid route in `react-page` artifacts

**Error Codes:**
- `CM060` — Content type missing SEO title template
- `CM061` — Title template produces output outside 50–60 character range
- `CM062` — Meta description template produces output outside 120–155 character range
- `CM063` — OG image dimensions not declared
- `CM064` — Robots directive not declared for content type

**Key Invariant:** Compiler must fail if any content type's SEO title template references a field that does not exist in `content-type-schema`.

**Safe Default:** Without seo-metadata-spec, SEO tags are hardcoded, inconsistent, and unvalidated for length — causing truncated titles in SERPs and missing OG images in social shares.

**Dependencies:**
- `canonical-url-policy.json`
- `content-type-schema.json`
- `localization-content-spec.json` (for hreflang)

**Downstream Consumers:**
- `article-metadata-spec`
- `landing-page-content-model`
- `schema-org-mapping`
- `content-review-checklist`

---

### 8. `schema-org-mapping`

**Frequency:** per-feature

**Input:**
- `content-type-schema.json`
- Page type list
- Applicable schema.org types (Article, FAQPage, Product, Organization, BreadcrumbList, etc.)
- Rich result requirements (Google Rich Results targets)

**Output:**
- `schema-org-mapping.json` — per-content-type structured data mapping: content type ID, schema.org type, per-field mapping (content field → schema.org property), required properties list, optional properties list, nested type definitions, validation rules for rich results eligibility

**Spec file:** `schema-org-mapping.spec.json`

**Correctness Gates:**
1. Every content type targeted for rich results has a schema.org type declared
2. Every required schema.org property for the declared type is mapped to a content field
3. Every mapped content field exists in `content-type-schema`
4. Required properties for Google rich result eligibility are present (e.g., Article requires `headline`, `author`, `datePublished`, `image`)
5. Date fields use ISO 8601 format declaration
6. `@context` is `https://schema.org` (not `http://` or versioned URL)
7. Nested types (e.g., `author` as a `Person`) have their own field mappings

**Error Codes:**
- `CM070` — Content type missing schema.org type declaration
- `CM071` — Required schema.org property not mapped to content field
- `CM072` — Mapped field does not exist in content-type-schema
- `CM073` — Date field not declared as ISO 8601 format
- `CM074` — Nested schema.org type missing field mapping

**Key Invariant:** Compiler must fail if any required property for Google Rich Results eligibility is not mapped to a content field for the declared schema.org type.

**Safe Default:** Without schema-org-mapping, structured data is absent or invalid, disqualifying content from rich result features (featured snippets, FAQ rich results, etc.).

**Dependencies:**
- `content-type-schema.json`
- `seo-metadata-spec.json`
- `author-profile-spec.json`

**Downstream Consumers:**
- `article-metadata-spec`
- `structured-faq-schema`
- `content-review-checklist`

---

### 9. `alt-text-policy`

**Frequency:** per-project

**Input:**
- Image usage contexts (hero image, inline image, thumbnail, icon, decorative)
- a11y requirements (WCAG 2.1 SC 1.1.1)
- CMS field configuration for alt text
- Automated alt text generation rules (if applicable)

**Output:**
- `alt-text-policy.json` — per-context alt text rules: context name, alt text required flag, max character length, empty alt permitted flag (for decorative images), auto-generation rule, prohibited content (file names, "image of", redundant phrases), CMS field reference

**Spec file:** `alt-text-policy.spec.json`

**Correctness Gates:**
1. Every image context has an `alt_text_required` declaration
2. Decorative images have `empty_alt_permitted: true` and `aria_hidden: true` declared
3. Max character length is defined for every context (typically ≤ 125 characters)
4. Prohibited content list includes: file name patterns, generic phrases ("image of", "photo of", "picture of")
5. CMS field reference is defined for every context
6. Cross-compiler: alt text policy must align with `a11y-test` shared compiler requirements
7. Auto-generation rule is binary: `allowed` | `not-allowed` (not left undefined)

**Error Codes:**
- `CM080` — Image context missing alt_text_required declaration
- `CM081` — Decorative context missing empty_alt_permitted flag
- `CM082` — Max character length not defined for context
- `CM083` — Prohibited content list is absent
- `CM084` — Auto-generation rule not declared

**Key Invariant:** Compiler must fail if any image context has no `alt_text_required` declaration.

**Safe Default:** Without alt-text-policy, images are published without alt text, causing WCAG 1.1.1 violations and failing accessibility audits.

**Dependencies:**
- `content-type-schema.json`
- `a11y-test` (shared compiler — alignment check)

**Downstream Consumers:**
- `image-asset-manifest`
- `content-review-checklist`
- `media-caption-credit-policy`

---

### 10. `media-caption-credit-policy`

**Frequency:** per-project

**Input:**
- Media types in use (photography, illustration, video, audio, infographic)
- Licensing requirements (Creative Commons, stock, commissioned, owned)
- Attribution format requirements
- CMS field configuration for caption and credit

**Output:**
- `media-caption-credit-policy.json` — per-media-type caption and credit rules: media type, caption required flag, credit required flag, credit format template (e.g., `© {photographer}, {year} via {source}`), license declaration requirement, attribution placement rules, expiry monitoring flag

**Spec file:** `media-caption-credit-policy.spec.json`

**Correctness Gates:**
1. Every media type has a `caption_required` and `credit_required` declaration
2. Credit format template is defined for every media type requiring credit
3. License declaration is required for any externally sourced media
4. Attribution placement is declared: `inline` | `footer` | `metadata-only`
5. Expiry monitoring flag is set for licensed media with time-limited rights
6. Credit format template uses only declared variables (no undefined `{variable}` placeholders)

**Error Codes:**
- `CM090` — Media type missing caption/credit requirement declaration
- `CM091` — Credit format template contains undefined variable
- `CM092` — Externally sourced media missing license declaration requirement
- `CM093` — Attribution placement not declared
- `CM094` — Expiry monitoring not set for time-limited licensed media

**Key Invariant:** Compiler must fail if any externally sourced media type has no license declaration requirement.

**Safe Default:** Without media-caption-credit-policy, licensed images are published without attribution, creating copyright liability.

**Dependencies:**
- `alt-text-policy.json`

**Downstream Consumers:**
- `image-asset-manifest`
- `content-review-checklist`

---

### 11. `image-asset-manifest`

**Frequency:** per-feature

**Input:**
- Image list (file references or URLs)
- `alt-text-policy.json`
- `media-caption-credit-policy.json`
- Required dimensions per context
- Format requirements (WebP, AVIF, JPEG, PNG, SVG)

**Output:**
- `image-asset-manifest.json` — per-image declaration: image ID, file reference, alt text, caption (if applicable), credit/attribution, license, dimensions (width × height), format, context (hero/inline/thumbnail/OG), content entry reference, expiry date (for licensed assets)

**Spec file:** `image-asset-manifest.spec.json`

**Correctness Gates:**
1. Every image has a unique `image_id`
2. Every non-decorative image has a non-empty `alt_text` value
3. Alt text length does not exceed the maximum defined in `alt-text-policy`
4. Alt text does not contain prohibited phrases from `alt-text-policy`
5. Licensed images have `license` and `credit` fields populated
6. Image dimensions are declared and meet the minimum for the declared context
7. OG images are ≥ 1200×630px
8. Expired licensed assets are flagged with `status: expired`

**Error Codes:**
- `CM100` — Non-decorative image missing alt text
- `CM101` — Alt text exceeds maximum character length
- `CM102` — Alt text contains prohibited phrase
- `CM103` — Licensed image missing credit or license field
- `CM104` — OG image below 1200×630px minimum

**Key Invariant:** Compiler must fail if any non-decorative image has an empty or absent `alt_text` field.

**Safe Default:** Without image-asset-manifest, images are used without validated alt text, dimensions, or attribution, causing a11y failures and potential copyright issues.

**Dependencies:**
- `alt-text-policy.json`
- `media-caption-credit-policy.json`

**Downstream Consumers:**
- `article-metadata-spec`
- `content-entry-manifest`
- `landing-page-content-model`
- `content-review-checklist`

---

### 12. `author-profile-spec`

**Frequency:** per-project

**Input:**
- Author list
- Required profile fields (name, bio, headshot, social links)
- schema.org `Person` mapping requirements
- Publication byline format

**Output:**
- `author-profile-spec.json` — per-author definition: author ID, display name, slug, bio (short/long), headshot image reference, credentials/title, social profile links, schema.org Person property mapping, byline format template, active flag

**Spec file:** `author-profile-spec.spec.json`

**Correctness Gates:**
1. Every author has a unique `author_id` and a unique `slug`
2. Every author has a `display_name`, a short `bio`, and a `headshot` image reference
3. Headshot image reference exists in `image-asset-manifest`
4. schema.org `Person` mapping covers: `name`, `url`, `image`, `jobTitle` (or equivalent)
5. Every active author has `active: true` explicitly declared
6. Bio length is within declared limits (short bio ≤ 160 characters, long bio ≤ 500 characters)
7. Slug follows `slug-url-policy` normalization rules

**Error Codes:**
- `CM110` — Author missing display_name, bio, or headshot
- `CM111` — Headshot image reference not found in image-asset-manifest
- `CM112` — schema.org Person property missing required field mapping
- `CM113` — Bio exceeds declared length limit
- `CM114` — Author slug violates slug-url-policy rules

**Key Invariant:** Compiler must fail if any author used in a published content entry has no `headshot` image reference.

**Safe Default:** Without author-profile-spec, bylines are inconsistent and author schema.org markup is absent, reducing author entity recognition in search.

**Dependencies:**
- `image-asset-manifest.json`
- `slug-url-policy.json`
- `schema-org-mapping.json`

**Downstream Consumers:**
- `article-metadata-spec`
- `content-entry-manifest`
- `schema-org-mapping`

---

### 13. `content-brief-spec`

**Frequency:** per-feature

**Input:**
- Topic and target audience definition
- SEO keyword targets
- Format requirements (article / video / infographic / FAQ / landing page)
- Word count range
- Internal linking targets
- Publishing deadline

**Output:**
- `content-brief-spec.json` — content production brief: brief ID, topic, target persona, primary keyword, secondary keywords, format, target word count (min/max), required internal links, required CTAs, author assignment, deadline, content type target, approval workflow assignment

**Spec file:** `content-brief-spec.spec.json`

**Correctness Gates:**
1. Every brief has a unique `brief_id` and a `topic` (non-empty)
2. Primary keyword is defined (required for SEO-targeted content)
3. Target word count is a numeric range (min ≤ max)
4. Required internal links reference existing content slugs in the content inventory
5. Deadline is a valid ISO 8601 date
6. Content type target references an existing content type in `content-type-schema`
7. Author assignment references a valid author in `author-profile-spec`

**Error Codes:**
- `CM120` — Brief missing primary keyword
- `CM121` — Word count is non-numeric or min > max
- `CM122` — Internal link target references non-existent slug
- `CM123` — Content type target not in content-type-schema
- `CM124` — Author assignment references undefined author

**Key Invariant:** Compiler must fail if a content brief's content type target does not exist in `content-type-schema`.

**Safe Default:** Without content-brief-spec, content production lacks structured requirements, causing keyword gaps, missing CTAs, and misaligned content types.

**Dependencies:**
- `content-type-schema.json`
- `author-profile-spec.json`
- `internal-linking-map.json`
- `taxonomy-tagging-policy.json`

**Downstream Consumers:**
- `article-metadata-spec`
- `editorial-calendar`

---

### 14. `article-metadata-spec`

**Frequency:** per-feature

**Input:**
- Article list (or single article)
- `seo-metadata-spec.json`
- `content-type-schema.json`
- `author-profile-spec.json`
- `taxonomy-tagging-policy.json`
- `canonical-url-policy.json`

**Output:**
- `article-metadata-spec.json` — per-article metadata declaration: title, slug, excerpt, hero image reference, author reference, category, tags, SEO title, SEO description, OG image reference, canonical URL, publish date, last modified date, reading time estimate, schema.org type, content status, legal approval reference

**Spec file:** `article-metadata-spec.spec.json`

**Correctness Gates:**
1. Every article has: title, slug, excerpt, hero image, author, category, and publish status
2. Slug follows `slug-url-policy` rules and is unique across the content type
3. Hero image references an entry in `image-asset-manifest`
4. Author references a valid entry in `author-profile-spec`
5. SEO title length is within the range declared in `seo-metadata-spec` (50–60 characters)
6. SEO description length is within range (120–155 characters)
7. Tags validate against `taxonomy-tagging-policy` (count within min/max, terms from controlled vocabulary)
8. Canonical URL follows `canonical-url-policy` format
9. Cross-compiler: slug must not duplicate any existing slug in the content inventory

**Error Codes:**
- `CM130` — Required metadata field missing (title/slug/excerpt/hero/author)
- `CM131` — Slug is duplicate or violates slug-url-policy
- `CM132` — SEO title outside 50–60 character range
- `CM133` — Tag count outside taxonomy-tagging-policy min/max
- `CM134` — Hero image reference not found in image-asset-manifest

**Key Invariant:** Compiler must fail if any article in `published` status is missing any required metadata field (title, slug, excerpt, hero image, author, canonical URL).

**Safe Default:** Without article-metadata-spec, articles ship without SEO metadata, missing hero images, and invalid slugs, causing search indexing failures.

**Dependencies:**
- `seo-metadata-spec.json`
- `canonical-url-policy.json`
- `author-profile-spec.json`
- `image-asset-manifest.json`
- `taxonomy-tagging-policy.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `schema-org-mapping`
- `content-review-checklist`
- `internal-linking-map`

---

### 15. `content-entry-manifest`

**Frequency:** per-feature

**Input:**
- `content-type-schema.json`
- `cms-field-mapping-spec.json`
- Content field values (the actual content data)
- Publish status
- Workflow state

**Output:**
- `content-entry-manifest.json` — per-entry CMS data record: entry ID, content type, field values (one per defined field), workflow state, publish status, locale, version number, author references, last modified timestamp, validation results

**Spec file:** `content-entry-manifest.spec.json`

**Correctness Gates:**
1. Every required field in `content-type-schema` has a non-null value in the manifest
2. Field values conform to their declared type (string, integer, image, reference, etc.)
3. Reference fields point to valid entry IDs in the corresponding content type
4. Workflow state is one of the states declared in `publishing-workflow-spec`
5. Publish status is `draft` | `scheduled` | `published` | `archived`
6. Locale is declared and valid
7. For `published` status: all required metadata fields from `article-metadata-spec` are present
8. Cross-compiler: all CMS field IDs match entries in `cms-field-mapping-spec`

**Error Codes:**
- `CM140` — Required field has null or missing value
- `CM141` — Field value does not match declared type
- `CM142` — Reference field points to non-existent entry ID
- `CM143` — Workflow state not defined in publishing-workflow-spec
- `CM144` — Published entry missing required metadata field

**Key Invariant:** Compiler must fail if any entry in `published` status has a null value in a required field defined in `content-type-schema`.

**Safe Default:** Without content-entry-manifest, content entries are created without validation, allowing incomplete or malformed records to reach production.

**Dependencies:**
- `content-type-schema.json`
- `cms-field-mapping-spec.json`
- `publishing-workflow-spec.json`
- `article-metadata-spec.json` (for article entries)

**Downstream Consumers:**
- `schema-org-mapping` (runtime validation)
- `stale-content-audit-report`
- `content-review-checklist`

---

### 16. `landing-page-content-model`

**Frequency:** per-campaign

**Input:**
- Page purpose and campaign brief
- Section list (hero / value-prop / features / social-proof / CTA / FAQ)
- CTA requirements
- `react-page` artifact for the page
- Variant requirements (A/B test)

**Output:**
- `landing-page-content-model.json` — landing page content structure: page ID, purpose, section list (section ID, type, required content fields, CTA reference, optional sections), variant map (control/treatment section differences), SEO metadata reference, legal disclaimer reference

**Spec file:** `landing-page-content-model.spec.json`

**Correctness Gates:**
1. Every section has a `section_id` and a `type` from a declared section type vocabulary
2. Required sections (hero, CTA) are present in every landing page model
3. Every CTA reference resolves to an entry in `cta-copy-manifest`
4. SEO metadata reference resolves to a `seo-metadata-spec` entry
5. Legal disclaimer reference is present if content is in a regulated category
6. Variant sections are explicitly enumerated (not implied by absence)
7. Cross-compiler: page ID must reference a valid `react-page` artifact

**Error Codes:**
- `CM150` — Required section (hero or CTA) missing
- `CM151` — CTA reference not found in cta-copy-manifest
- `CM152` — Page ID not found in react-page artifact registry
- `CM153` — Regulated content missing legal disclaimer reference
- `CM154` — Variant sections not explicitly declared

**Key Invariant:** Compiler must fail if any landing page model has no hero section or no CTA section.

**Safe Default:** Without landing-page-content-model, landing pages are assembled ad-hoc without validated structure, CTA requirements, or legal disclaimer compliance.

**Dependencies:**
- `cta-copy-manifest.json`
- `seo-metadata-spec.json`
- `compliance-disclaimer-policy.json`

**Downstream Consumers:**
- `campaign-content-bundle`
- `content-review-checklist`

---

### 17. `reusable-content-block-library`

**Frequency:** per-project

**Input:**
- Content block type list (testimonial, callout, stats block, image-text, FAQ accordion, etc.)
- Slot definitions per block (what fields each block accepts)
- `react-component` artifact list (block-to-component mapping)
- Usage context rules (which pages/templates can use which blocks)

**Output:**
- `content-block-library.json` — per-block definition: block ID, display name, field list (name, type, required), usage contexts, component reference, preview template, max instances per page

**Spec file:** `content-block-library.spec.json`

**Correctness Gates:**
1. Every block has a unique `block_id` and a `component_reference`
2. Component reference resolves to a valid `react-component` artifact
3. Every required field in the block has a type declaration
4. Usage contexts are explicitly declared (not "can be used anywhere" without declaration)
5. Max instances per page is defined (even if `unlimited` — must be declared)
6. Cross-compiler: block field types must be compatible with the corresponding react-component prop types

**Error Codes:**
- `CM160` — Block missing component_reference
- `CM161` — Component reference not found in react-component artifact registry
- `CM162` — Block field missing type declaration
- `CM163` — Usage context not declared
- `CM164` — Max instances not declared

**Key Invariant:** Compiler must fail if any block's `component_reference` does not resolve to a known `react-component` artifact.

**Safe Default:** Without reusable-content-block-library, content blocks are recreated per page without shared definitions, causing component drift and inconsistent content structures.

**Dependencies:**
- `content-type-schema.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `landing-page-content-model`
- `campaign-content-bundle`

---

### 18. `cta-copy-manifest`

**Frequency:** per-feature

**Input:**
- CTA placement list (which pages/sections have CTAs)
- Copy variants (primary label, secondary label, microcopy)
- Action mapping (what the CTA triggers: route, form, modal, external URL)
- `react-page` / `react-component` surface references

**Output:**
- `cta-copy-manifest.json` — per-CTA declaration: CTA ID, placement context, primary label, secondary label (if applicable), aria-label (for accessibility), action type (`route` / `form` / `modal` / `external`), action target, copy character limits, experiment variant references

**Spec file:** `cta-copy-manifest.spec.json`

**Correctness Gates:**
1. Every CTA has a unique `cta_id` and a non-empty `primary_label`
2. Primary label length ≤ declared character limit (typically ≤ 40 characters)
3. `aria-label` is defined when primary label is ambiguous (e.g., "Learn more", "Click here")
4. Action target resolves to a valid route, form ID, or URL
5. `route` action targets exist in the route artifact registry
6. Cross-compiler: every CTA placement context maps to an existing `react-page` or `react-component` surface
7. Experiment variant references resolve to valid `feature-flag` keys

**Error Codes:**
- `CM170` — CTA missing primary label
- `CM171` — Primary label exceeds character limit
- `CM172` — Ambiguous label missing aria-label
- `CM173` — Route action target not found in route registry
- `CM174` — Feature flag key not found in feature-flag output

**Key Invariant:** Compiler must fail if any CTA with an ambiguous label ("Learn more", "Get started", "Click here") has no `aria-label` defined.

**Safe Default:** Without cta-copy-manifest, CTA copy is inconsistent across features and inaccessible to screen readers using generic labels.

**Dependencies:**
- `slug-url-policy.json`
- `feature-flag` (shared compiler — for variants)

**Downstream Consumers:**
- `landing-page-content-model`
- `campaign-content-bundle`
- `content-review-checklist`

---

### 19. `internal-linking-map`

**Frequency:** per-project

**Input:**
- Content inventory (all published URLs)
- Topic cluster definitions
- Anchor text rules
- Link authority distribution strategy

**Output:**
- `internal-linking-map.json` — internal link graph: source URL, target URL, anchor text, link context (body / nav / footer / CTA), link type (`pillar-to-cluster` / `cluster-to-cluster` / `cluster-to-pillar` / `contextual`), nofollow flag

**Spec file:** `internal-linking-map.spec.json`

**Correctness Gates:**
1. Every link entry has a source URL and a target URL
2. Every target URL exists in the content inventory (no broken internal links)
3. No redirect chains: target URL must be the final destination (not a URL that itself redirects)
4. Anchor text is non-empty and not generic ("click here", "read more")
5. Archived/unpublished pages are not link targets (validated against `archive-unpublish-policy`)
6. No orphaned content: every published page has at least one inbound internal link
7. Source and target URLs are not identical (no self-links)

**Error Codes:**
- `CM180` — Target URL does not exist in content inventory
- `CM181` — Target URL is a redirect (not final destination)
- `CM182` — Anchor text is generic or empty
- `CM183` — Target page is archived or unpublished
- `CM184` — Content page has zero inbound internal links (orphaned)

**Key Invariant:** Compiler must fail if any internal link target URL returns a non-200 status or points to an archived/unpublished page.

**Safe Default:** Without internal-linking-map, internal linking is ad-hoc, creating orphaned content, broken links after archiving, and unoptimized topic cluster structures.

**Dependencies:**
- `slug-url-policy.json`
- `category-hierarchy-spec.json`
- `archive-unpublish-policy.json`

**Downstream Consumers:**
- `content-review-checklist`
- `stale-content-audit-report`
- `redirect-manifest`

---

### 20. `redirect-manifest`

**Frequency:** per-project

**Input:**
- Old URL list (slugs that have changed or been removed)
- New URL list (destinations)
- Redirect type (301 permanent / 302 temporary / 410 gone)
- `canonical-url-policy.json`
- `slug-url-policy.json`

**Output:**
- `redirect-manifest.json` — redirect rule set: source path, destination path, redirect type (301/302/410), reason (slug-change / content-merged / content-removed / canonicalization), chain detection flag, creation date

**Spec file:** `redirect-manifest.spec.json`

**Correctness Gates:**
1. Every redirect has a source path, a destination path, and a redirect type
2. Redirect type is one of: `301` | `302` | `410`
3. No redirect chains: destination path must not itself be a redirect source
4. No redirect loops: A → B and B → A both existing is invalid
5. Destination paths for 301/302 redirects exist in the current route or content inventory
6. 410 redirects have no destination (explicitly `null` destination)
7. Source paths follow valid URL format (no malformed paths)
8. Cross-compiler: destination paths must resolve in `react-page` artifact registry or content inventory

**Error Codes:**
- `CM190` — Redirect missing type declaration
- `CM191` — Redirect chain detected (destination is itself a redirect source)
- `CM192` — Redirect loop detected (A→B and B→A)
- `CM193` — 301/302 destination not found in route or content inventory
- `CM194` — 410 redirect has non-null destination

**Key Invariant:** Compiler must fail if any redirect destination is itself a source in another redirect rule (chain detection).

**Safe Default:** Without redirect-manifest, URL changes result in 404s for previously indexed pages, destroying SEO equity and user bookmarks.

**Dependencies:**
- `slug-url-policy.json`
- `canonical-url-policy.json`

**Downstream Consumers:**
- `stale-content-audit-report`
- `internal-linking-map` (link validation)
- Web server / CDN routing config

---

### 21. `publishing-workflow-spec`

**Frequency:** per-project

**Input:**
- Workflow state list (draft / in-review / approved / scheduled / published / archived)
- Role list (author / editor / legal / publisher)
- Transition rules (which roles can make which state transitions)
- Approval gate requirements

**Output:**
- `publishing-workflow-spec.json` — state machine definition: state list, per-state allowed transitions, per-transition required role, required approval gates (legal sign-off, editor approval), notification triggers per transition, entry and exit conditions per state

**Spec file:** `publishing-workflow-spec.spec.json`

**Correctness Gates:**
1. Every state has a unique `state_id`
2. Every transition specifies: `from_state`, `to_state`, and `required_role`
3. `published` state can only be reached from `approved` or `scheduled` states (not directly from `draft`)
4. `archived` state has no transitions back to `published` (must go through `draft` or `approved`)
5. Legal approval gate is required for regulated content types (as declared in `compliance-disclaimer-policy`)
6. Workflow is a valid finite state machine (no transition to undefined states)
7. At least one terminal state is defined (`published` or `archived`)

**Error Codes:**
- `CM200` — State transition references undefined state
- `CM201` — Published state reachable directly from draft (approval step missing)
- `CM202` — Archived state has direct transition back to published
- `CM203` — Regulated content type missing legal approval gate
- `CM204` — Workflow has no terminal state

**Key Invariant:** Compiler must fail if the `published` state is reachable from `draft` without passing through an `approved` or equivalent state.

**Safe Default:** Without publishing-workflow-spec, content can be published directly from draft by any role, bypassing editorial review and legal approval.

**Dependencies:**
- `compliance-disclaimer-policy.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `publish-schedule-manifest`
- `legal-approval-manifest`
- `content-review-checklist`

---

### 22. `publish-schedule-manifest`

**Frequency:** per-campaign

**Input:**
- Content list with publish dates/times
- `publishing-workflow-spec.json`
- Timezone config
- Priority ordering
- Unpublish/expiry dates (if applicable)

**Output:**
- `publish-schedule-manifest.json` — publication schedule: entry ID, content type, publish datetime (ISO 8601 with timezone), unpublish datetime (if applicable), priority, workflow state at time of scheduling, conflict detection flag (two entries at same time on same channel)

**Spec file:** `publish-schedule-manifest.spec.json`

**Correctness Gates:**
1. Every scheduled entry has a publish datetime in ISO 8601 format with timezone offset
2. Every entry is in `approved` workflow state at time of scheduling
3. Unpublish datetime, if present, is after the publish datetime
4. No two entries have conflicting publish datetimes on the same channel/page slot
5. Publish datetime is in the future at time of spec creation
6. Entry ID references a valid content entry in `content-entry-manifest`
7. Cross-compiler: scheduled entries with feature-flag-dependent content reference valid flag keys

**Error Codes:**
- `CM210` — Publish datetime not in ISO 8601 format with timezone
- `CM211` — Scheduled entry not in approved workflow state
- `CM212` — Unpublish datetime is before publish datetime
- `CM213` — Conflicting publish datetimes on same channel
- `CM214` — Entry ID not found in content-entry-manifest

**Key Invariant:** Compiler must fail if any scheduled content entry is not in `approved` workflow state at the time of scheduling.

**Safe Default:** Without publish-schedule-manifest, scheduling is managed manually without conflict detection, causing content publication at incorrect times or collisions.

**Dependencies:**
- `publishing-workflow-spec.json`
- `content-entry-manifest.json`

**Downstream Consumers:**
- `campaign-content-bundle`
- `editorial-calendar`

---

### 23. `content-versioning-policy`

**Frequency:** per-project

**Input:**
- CMS versioning capabilities
- Rollback requirements (how many versions to retain)
- Diff requirements (what constitutes a "version" — field-level vs entry-level)
- Archive retention rules

**Output:**
- `content-versioning-policy.json` — versioning rules: version retention count (minimum versions per entry), field-level vs entry-level versioning declaration, rollback permission rules (who can rollback, to which states), version diff format, major vs minor version triggers, auto-versioning trigger events

**Spec file:** `content-versioning-policy.spec.json`

**Correctness Gates:**
1. Version retention count is a specific integer ≥ 5 for production content
2. Versioning granularity is declared: `field-level` | `entry-level`
3. Rollback permission is declared per role (not implied as "anyone")
4. Major version triggers are enumerated (e.g., title change, publish, status change)
5. Auto-versioning trigger events are defined (not left to CMS default)
6. Rollback from `published` state requires re-entry into workflow approval (not direct rollback)

**Error Codes:**
- `CM220` — Version retention count below minimum (5)
- `CM221` — Versioning granularity not declared
- `CM222` — Rollback permission not declared per role
- `CM223` — Major version triggers not enumerated
- `CM224` — Published-state rollback bypasses approval workflow

**Key Invariant:** Compiler must fail if rolling back a published entry directly restores a previous published version without re-entering the approval workflow.

**Safe Default:** Without content-versioning-policy, version history is managed by CMS defaults, with no guaranteed rollback capability or audit trail.

**Dependencies:**
- `publishing-workflow-spec.json`

**Downstream Consumers:**
- `stale-content-audit-report`
- `content-review-checklist`

---

### 24. `archive-unpublish-policy`

**Frequency:** per-project

**Input:**
- Staleness criteria (age, traffic threshold, product relevance)
- Redirect requirements on unpublish
- Link audit requirements (what to do with inbound links)
- Legal hold exceptions

**Output:**
- `archive-unpublish-policy.json` — archival rules: archive trigger criteria (age / traffic / manual / automated), required redirect on unpublish (`301` / `410` / none), inbound link audit requirement before archiving, legal hold override mechanism, content type exceptions (some types never archived), grace period before final deletion

**Spec file:** `archive-unpublish-policy.spec.json`

**Correctness Gates:**
1. Archive trigger criteria are specific (e.g., "no traffic for 90 days" — not "low traffic")
2. Redirect requirement is declared for every archive action: must create `301` redirect, `410` gone, or explicitly `none`
3. Inbound link audit is required before archiving any content with ≥ 1 inbound link
4. Legal hold mechanism is declared (cannot silently block archival without declared process)
5. Grace period before final deletion is a specific duration
6. Content type exceptions (e.g., "author profiles are never archived") are enumerated

**Error Codes:**
- `CM230` — Archive trigger criterion is non-specific
- `CM231` — Redirect requirement not declared for archive action
- `CM232` — Archiving content with inbound links without link audit
- `CM233` — Legal hold mechanism not declared
- `CM234` — Grace period not a specific duration

**Key Invariant:** Compiler must fail if any content with at least one inbound internal link can be archived without a prior link audit step.

**Safe Default:** Without archive-unpublish-policy, archived content leaves behind 404 errors for previously indexed URLs, destroying SEO equity and breaking internal links.

**Dependencies:**
- `redirect-manifest.json`
- `internal-linking-map.json`

**Downstream Consumers:**
- `stale-content-audit-report`
- `content-refresh-plan`
- `internal-linking-map`

---

### 25. `localization-content-spec`

**Frequency:** per-feature

**Input:**
- Locale list
- `content-type-schema.json` (which fields are localizable)
- Fallback locale rules
- `i18n` shared compiler output
- Translation readiness requirements

**Output:**
- `localization-content-spec.json` — per-content-type localization rules: locale list, per-field localization flag (`localize: true/false`), fallback locale (e.g., `en` is fallback for `fr-CA`), untranslated field behavior (`show-fallback` / `hide` / `placeholder`), translation completeness threshold (% of fields translated required before publish), hreflang config

**Spec file:** `localization-content-spec.spec.json`

**Correctness Gates:**
1. Every field in `content-type-schema` has a `localize` flag declared (no implicit assumption)
2. Every locale has a fallback locale defined (except the root locale)
3. Untranslated field behavior is one of: `show-fallback` | `hide` | `placeholder`
4. Translation completeness threshold is a specific percentage
5. hreflang config covers all declared locales
6. Cross-compiler: every i18n key used in content entries must have a corresponding entry in the `i18n` shared compiler output
7. Localized slugs follow `slug-url-policy` locale prefix rules

**Error Codes:**
- `CM240` — Content field missing localize flag declaration
- `CM241` — Locale missing fallback definition
- `CM242` — Untranslated field behavior not declared
- `CM243` — Translation completeness threshold not defined
- `CM244` — i18n key used in content entry not found in i18n output

**Key Invariant:** Compiler must fail if any locale-specific content entry is published with a translation completeness score below the declared threshold.

**Safe Default:** Without localization-content-spec, localized content publishes with untranslated fields silently falling back to the default locale or showing blank content.

**Dependencies:**
- `content-type-schema.json`
- `slug-url-policy.json`
- `i18n` (shared compiler)

**Downstream Consumers:**
- `article-metadata-spec`
- `seo-metadata-spec` (hreflang)
- `content-entry-manifest`
- `content-review-checklist`

---

### 26. `compliance-disclaimer-policy`

**Frequency:** per-project

**Input:**
- Regulated content type list (financial, medical, legal, age-restricted)
- Disclaimer text per category
- Jurisdiction requirements
- Expiry rules for disclaimers

**Output:**
- `compliance-disclaimer-policy.json` — per-regulated-category disclaimer rules: category ID, disclaimer text (or CMS key reference), disclaimer placement (header / footer / inline), required on publish flag, expiry date, jurisdiction applicability, update trigger (when disclaimer must be reviewed), legal approval reference

**Spec file:** `compliance-disclaimer-policy.spec.json`

**Correctness Gates:**
1. Every regulated content category has a disclaimer rule entry
2. Disclaimer text is either inline or references a valid CMS content key
3. Disclaimer placement is declared: `header` | `footer` | `inline`
4. Expiry date is defined for time-sensitive disclaimers
5. Expired disclaimers are flagged as `status: expired` and block publishing
6. Jurisdiction applicability is declared (not globally applied by default without consideration)
7. Legal approval reference is present for every disclaimer entry

**Error Codes:**
- `CM250` — Regulated category missing disclaimer rule
- `CM251` — Disclaimer text is empty or references invalid CMS key
- `CM252` — Disclaimer placement not declared
- `CM253` — Expired disclaimer not flagged as expired
- `CM254` — Disclaimer missing legal approval reference

**Key Invariant:** Compiler must fail if any content entry in a regulated category is published without a valid, non-expired disclaimer attached.

**Safe Default:** Without compliance-disclaimer-policy, regulated content publishes without required disclaimers, creating legal and regulatory liability.

**Dependencies:**
- `publishing-workflow-spec.json`
- `content-type-schema.json`

**Downstream Consumers:**
- `legal-approval-manifest`
- `landing-page-content-model`
- `content-review-checklist`
- `publishing-workflow-spec`

---

### 27. `legal-approval-manifest`

**Frequency:** per-feature

**Input:**
- Content entries requiring legal review (flagged by content type or manually)
- `compliance-disclaimer-policy.json`
- Approval states (pending / approved / rejected / expired)
- Approver list

**Output:**
- `legal-approval-manifest.json` — per-entry legal approval record: entry ID, content type, regulated category, approval state, approver identity, approval timestamp, expiry date, rejection reason (if rejected), re-review trigger conditions

**Spec file:** `legal-approval-manifest.spec.json`

**Correctness Gates:**
1. Every content entry flagged as regulated has a legal approval record
2. Approval state is one of: `pending` | `approved` | `rejected` | `expired`
3. `approved` entries have an approver identity and approval timestamp
4. Expiry date is defined for every approved entry (legal approval does not last indefinitely)
5. Expired approvals block publishing until re-approved
6. Rejection records include a rejection reason
7. Re-review trigger conditions are defined (e.g., "content body changed after approval invalidates approval")

**Error Codes:**
- `CM260` — Regulated content entry missing legal approval record
- `CM261` — Approved entry missing approver identity or timestamp
- `CM262` — Approval expiry date not defined
- `CM263` — Expired approval not blocking publish
- `CM264` — Rejection record missing reason

**Key Invariant:** Compiler must fail if any content entry in a regulated category has approval state `expired` and is not blocked from publishing.

**Safe Default:** Without legal-approval-manifest, regulated content publishes without approval tracking, creating undetectable compliance failures.

**Dependencies:**
- `compliance-disclaimer-policy.json`
- `publishing-workflow-spec.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `publish-schedule-manifest`
- `content-review-checklist`

---

### 28. `campaign-content-bundle`

**Frequency:** per-campaign

**Input:**
- Campaign brief
- `landing-page-content-model.json`
- Content entry list for the campaign
- `publish-schedule-manifest.json`
- Variant map (A/B test variants)
- Distribution channel list

**Output:**
- `campaign-content-bundle.json` — campaign content package: campaign ID, goal, content entry list (with publish states), landing page model reference, variant map, schedule reference, channel distribution list (web / email / social / newsletter), UTM parameter schema, legal approval manifest reference

**Spec file:** `campaign-content-bundle.spec.json`

**Correctness Gates:**
1. Campaign has a unique `campaign_id` and a declared goal
2. Every content entry in the bundle has a publish state declared
3. Landing page model reference resolves to a valid `landing-page-content-model` entry
4. Schedule reference resolves to a valid `publish-schedule-manifest` entry
5. UTM parameter schema is defined (source, medium, campaign, content, term)
6. Legal approval manifest reference is present if any content is regulated
7. Variant map entries reference valid `experiment-content-variant-spec` IDs
8. Cross-compiler: variant map must reference valid `feature-flag` keys

**Error Codes:**
- `CM270` — Campaign missing declared goal
- `CM271` — Content entry in bundle missing publish state
- `CM272` — Landing page model reference not found
- `CM273` — UTM parameter schema not defined
- `CM274` — Feature flag key not found in feature-flag output

**Key Invariant:** Compiler must fail if any content entry in the campaign bundle is in `draft` state when the campaign schedule starts.

**Safe Default:** Without campaign-content-bundle, campaign assets are coordinated informally, causing untracked content states, missing UTMs, and incomplete launch checklists.

**Dependencies:**
- `landing-page-content-model.json`
- `publish-schedule-manifest.json`
- `experiment-content-variant-spec.json`
- `legal-approval-manifest.json`
- `feature-flag` (shared compiler)

**Downstream Consumers:**
- `newsletter-distribution-manifest`
- Content analytics tracking

---

### 29. `experiment-content-variant-spec`

**Frequency:** per-campaign

**Input:**
- `feature-flag` shared compiler output
- Variant content definitions (control and treatments)
- Goal event definitions (`analytics-event` shared compiler)
- Content field delta map (which fields differ per variant)

**Output:**
- `experiment-content-spec.json` — per-variant content definition: experiment ID, flag key, control content reference, treatment variant list (variant ID, field deltas vs control, publish status), goal events, exclusion rules, traffic allocation, content type scope

**Spec file:** `experiment-content-spec.spec.json`

**Correctness Gates:**
1. Every experiment has a control variant explicitly defined
2. Every treatment variant declares only the field deltas from control (not a full content copy)
3. Cross-compiler: every `flag_key` resolves in the `feature-flag` shared compiler output
4. Goal events reference valid `analytics-event` entries
5. Traffic allocation sums to 100% (control + treatments)
6. Control and all treatment variants share the same content type
7. No treatment variant can be in `published` state while its `flag_key` is disabled

**Error Codes:**
- `CM280` — Control variant not explicitly defined
- `CM281` — Treatment variant contains full content copy instead of delta
- `CM282` — Flag key not found in feature-flag output
- `CM283` — Traffic allocation does not sum to 100%
- `CM284` — Goal event not found in analytics-event catalog

**Key Invariant:** Compiler must fail if any treatment variant's flag key does not exist in the `feature-flag` compiler output.

**Safe Default:** Without experiment-content-variant-spec, A/B test content variants are implemented as separate hardcoded pages with no structured relationship to the flag system.

**Dependencies:**
- `content-type-schema.json`
- `feature-flag` (shared compiler)
- `analytics-event` (shared compiler)

**Downstream Consumers:**
- `campaign-content-bundle`
- `content-review-checklist`

---

### 30. `editorial-calendar`

**Frequency:** per-project

**Input:**
- Content pipeline (briefs in progress, drafts, scheduled entries)
- `publish-schedule-manifest.json`
- Author assignments
- Campaign content bundles

**Output:**
- `editorial-calendar.json` — structured publication timeline: entry list (entry ID, title, content type, author, status, publish date, campaign reference), coverage gaps (weeks/topics with no scheduled content), resource conflicts (one author with too many entries in same window), priority ordering

**Spec file:** `editorial-calendar.spec.json`

**Correctness Gates:**
1. Every entry has a status: `brief` | `in-progress` | `in-review` | `approved` | `scheduled` | `published`
2. Every entry has an author assignment
3. Publish dates are in ISO 8601 format
4. No author has more than the declared maximum concurrent entries in active status
5. Coverage gaps (periods with no scheduled content) are flagged
6. Campaign entries reference valid `campaign-content-bundle` IDs
7. All publish dates are consistent with `publish-schedule-manifest` entries

**Error Codes:**
- `CM290` — Entry missing author assignment
- `CM291` — Publish date not in ISO 8601 format
- `CM292` — Author exceeds maximum concurrent entry limit
- `CM293` — Coverage gap detected and not acknowledged
- `CM294` — Campaign entry references non-existent campaign bundle

**Key Invariant:** Compiler must fail if any entry in `scheduled` status has no publish date defined.

**Safe Default:** Without editorial-calendar, publication timing is managed in spreadsheets, causing uncoordinated publishing, author conflicts, and content gaps.

**Dependencies:**
- `publish-schedule-manifest.json`
- `content-brief-spec.json`
- `campaign-content-bundle.json`

**Downstream Consumers:**
- `stale-content-audit-report`

---

### 31. `content-review-checklist`

**Frequency:** per-feature

**Input:**
- `seo-metadata-spec.json`
- `alt-text-policy.json`
- `compliance-disclaimer-policy.json`
- `legal-approval-manifest.json`
- `publishing-workflow-spec.json`
- Quality rule set

**Output:**
- `content-review-checklist.json` — structured review gate: checklist ID, content type scope, check list (check ID, category, rule description, pass criterion, auto-checkable flag, reference policy)

**Spec file:** `content-review-checklist.spec.json`

**Correctness Gates:**
1. Checklist covers all mandatory categories: SEO, accessibility, legal/compliance, metadata completeness, link validity
2. Every check has a binary `pass_criterion` (not qualitative)
3. Every check has an `auto_checkable` flag
4. Checks reference the source policy document for each rule
5. `published` state is only reached if all non-waivable checks pass
6. Legal compliance checks reference `legal-approval-manifest` entries
7. Cross-compiler: SEO checks align with `seo-metadata-spec` requirements

**Error Codes:**
- `CM300` — Checklist missing mandatory category (SEO/a11y/legal/metadata)
- `CM301` — Check has non-binary pass criterion
- `CM302` — Check has no source policy reference
- `CM303` — Published state reachable with failing non-waivable checks
- `CM304` — Legal check not linked to legal-approval-manifest

**Key Invariant:** Compiler must fail if any non-waivable checklist item has no binary pass criterion.

**Safe Default:** Without content-review-checklist, content publishes without a formal quality gate, allowing SEO failures, missing alt text, and unreviewed regulated content.

**Dependencies:**
- `seo-metadata-spec.json`
- `alt-text-policy.json`
- `compliance-disclaimer-policy.json`
- `legal-approval-manifest.json`
- `publishing-workflow-spec.json`

**Downstream Consumers:**
- `publishing-workflow-spec` (gate trigger)

---

### 32. `stale-content-audit-report`

**Frequency:** daily

**Input:**
- Content inventory (all published entries)
- Last-modified dates per entry
- Inbound link counts
- `archive-unpublish-policy.json`
- `internal-linking-map.json`
- `redirect-manifest.json`

**Output:**
- `stale-content-audit.json` — content health report: per-entry staleness score, staleness trigger (age / traffic / broken links / product change), broken internal links detected, orphaned content list (no inbound links), archived pages still linked from active pages, redirect chain detections, expiry flag (compliance-driven or time-limited content nearing expiry)

**Spec file:** `stale-content-audit.spec.json`

**Correctness Gates:**
1. Report covers 100% of published content entries
2. Every entry has a staleness classification: `fresh` | `aging` | `stale` | `critical`
3. Broken internal links are flagged per entry
4. Orphaned pages are identified and listed
5. Archived pages linked from active content are flagged as critical
6. Redirect chains (A→B→C where B is a redirect) are flagged
7. Content nearing compliance expiry (within 30 days) is flagged
8. Report timestamp is present

**Error Codes:**
- `CM310` — Entry not covered in report
- `CM311` — Staleness classification missing
- `CM312` — Archived page linked from active content not flagged
- `CM313` — Redirect chain not flagged
- `CM314` — Compliance-expiring content not flagged

**Key Invariant:** Compiler must fail if any published entry has no staleness classification in the report.

**Safe Default:** Without stale-content-audit-report, content rot accumulates undetected — broken links, archived-but-linked pages, and expired disclaimers remain in production.

**Dependencies:**
- `archive-unpublish-policy.json`
- `internal-linking-map.json`
- `redirect-manifest.json`
- `compliance-disclaimer-policy.json`

**Downstream Consumers:**
- `content-refresh-plan`
- Editorial team sprint planning

---

### 33. `content-refresh-plan`

**Frequency:** per-project

**Input:**
- `stale-content-audit-report.json`
- Content performance data (traffic, conversion, backlinks)
- Refresh effort estimates
- Editorial capacity

**Output:**
- `content-refresh-plan.json` — prioritized refresh queue: entry ID, current staleness classification, refresh type (`update` / `rewrite` / `merge` / `archive`), priority score, assigned author, deadline, success criteria (what makes it "refreshed"), estimated effort tier

**Spec file:** `content-refresh-plan.spec.json`

**Correctness Gates:**
1. Every `critical` staleness entry from the audit report has a refresh plan entry
2. Refresh type is one of: `update` | `rewrite` | `merge` | `archive`
3. Priority score is numeric (not "high" or "urgent")
4. Success criteria is binary (specific condition that marks it complete)
5. Assigned author references a valid `author-profile-spec` entry
6. Deadline is a valid ISO 8601 date in the future

**Error Codes:**
- `CM320` — Critical staleness entry has no refresh plan entry
- `CM321` — Refresh type is not a valid value
- `CM322` — Priority score is non-numeric
- `CM323` — Success criteria is non-binary
- `CM324` — Deadline is in the past

**Key Invariant:** Compiler must fail if any `critical`-classified entry from the stale audit report has no corresponding entry in the refresh plan.

**Safe Default:** Without content-refresh-plan, stale content identified in audits remains unaddressed, continuing to accumulate SEO and user experience debt.

**Dependencies:**
- `stale-content-audit-report.json`
- `author-profile-spec.json`

**Downstream Consumers:**
- `editorial-calendar`

---

### 34. `newsletter-distribution-manifest`

**Frequency:** per-campaign

**Input:**
- Recipient segment definitions
- Content block list (from `reusable-content-block-library`)
- `publish-schedule-manifest.json`
- UTM parameter schema (from `campaign-content-bundle`)
- Tracking requirements

**Output:**
- `newsletter-manifest.json` — newsletter distribution spec: issue ID, recipient segments, content block list (ordered), subject line copy, preview text copy, send datetime (ISO 8601), UTM parameters per link, unsubscribe link requirement, plain-text version requirement, CAN-SPAM/GDPR compliance flags

**Spec file:** `newsletter-manifest.spec.json`

**Correctness Gates:**
1. Every newsletter has an `issue_id`, subject line, and send datetime
2. Subject line length ≤ 60 characters
3. Preview text length ≤ 90 characters
4. Unsubscribe link is declared as `required: true`
5. CAN-SPAM compliance flag is `true` (or jurisdiction equivalent)
6. Plain-text version is declared (required or explicitly `waived` with justification)
7. All content block references resolve in `reusable-content-block-library`
8. UTM parameters are defined for every tracked link

**Error Codes:**
- `CM330` — Newsletter missing send datetime
- `CM331` — Subject line exceeds 60 characters
- `CM332` — Unsubscribe link not declared required
- `CM333` — Content block reference not found in block library
- `CM334` — Tracked link missing UTM parameters

**Key Invariant:** Compiler must fail if any newsletter does not have an unsubscribe link declared as required.

**Safe Default:** Without newsletter-distribution-manifest, newsletters are assembled ad-hoc without validated UTM coverage, unsubscribe compliance, or content block validation.

**Dependencies:**
- `reusable-content-block-library.json`
- `campaign-content-bundle.json`
- `cta-copy-manifest.json`

**Downstream Consumers:**
- Email delivery pipeline
- `content-analytics-mapping`

---

### 35. `content-migration-manifest`

**Frequency:** per-project

**Input:**
- Source content export (old CMS format)
- `content-type-schema.json` (target schema)
- `cms-field-mapping-spec.json`
- `slug-url-policy.json`
- Redirect requirements for migrated URLs

**Output:**
- `content-migration-manifest.json` — migration record: source entry ID, target entry ID, content type, field mapping (source field → target field), transformation rules applied, slug transformation, redirect created (old URL → new URL), migration status (pending / migrated / failed / skipped), validation results

**Spec file:** `content-migration-manifest.spec.json`

**Correctness Gates:**
1. Every source entry has a migration status declared
2. Field mapping covers all required fields in the target `content-type-schema`
3. Slug transformations follow `slug-url-policy` rules
4. Migrated entries have a corresponding redirect created from old URL to new URL
5. Failed entries have a failure reason recorded (not silently skipped)
6. Validation results include: schema compliance, required field completeness, duplicate slug check
7. No target slug is duplicated across migrated entries

**Error Codes:**
- `CM340` — Source entry missing migration status
- `CM341` — Field mapping incomplete for required target fields
- `CM342` — Migrated entry missing redirect from old URL
- `CM343` — Failed entry missing failure reason
- `CM344` — Duplicate target slug detected

**Key Invariant:** Compiler must fail if any migrated entry has a target slug that duplicates an existing slug in the content inventory.

**Safe Default:** Without content-migration-manifest, content migrations result in missing redirects, broken content, and slug conflicts that cause duplicate content indexing.

**Dependencies:**
- `content-type-schema.json`
- `cms-field-mapping-spec.json`
- `slug-url-policy.json`
- `redirect-manifest.json`

**Downstream Consumers:**
- `redirect-manifest` (new entries added)
- `stale-content-audit-report` (migrated content coverage)

---

### 36. `structured-faq-schema`

**Frequency:** per-feature

**Input:**
- Question and answer list
- `schema-org-mapping.json` (FAQPage type)
- `content-type-schema.json`
- Target pages (which pages the FAQ block appears on)

**Output:**
- `faq-schema.json` — structured FAQ definition: FAQ set ID, question list (question ID, question text, answer text, schema.org `acceptedAnswer` mapping), target page list, schema.org `FAQPage` validation results, rich result eligibility assessment

**Spec file:** `faq-schema.spec.json`

**Correctness Gates:**
1. Every FAQ entry has a non-empty `question` and `answer`
2. Question text ends with a question mark
3. Answer text is not a duplicate of another answer in the same FAQ set
4. schema.org `FAQPage` type is declared and `acceptedAnswer` is mapped for every question
5. Every target page has a corresponding `react-page` artifact
6. FAQ set does not exceed schema.org recommended limits (no formal limit, but > 50 FAQs flagged for review)
7. Rich result eligibility criteria met: no affiliate links in answers, no obscene content (basic content policy check)

**Error Codes:**
- `CM350` — FAQ entry missing question or answer
- `CM351` — Question text does not end with question mark
- `CM352` — Answer is duplicate of another in same FAQ set
- `CM353` — schema.org FAQPage mapping incomplete
- `CM354` — Target page not found in react-page artifact registry

**Key Invariant:** Compiler must fail if any FAQ entry has an empty `answer` field.

**Safe Default:** Without structured-faq-schema, FAQ content has no schema.org markup, missing FAQ rich result eligibility and losing SERP visibility.

**Dependencies:**
- `schema-org-mapping.json`
- `content-type-schema.json`

**Downstream Consumers:**
- `content-entry-manifest`
- `content-review-checklist`

---

### 37. `content-analytics-mapping`

**Frequency:** per-project

**Input:**
- Content type list
- Tracking field requirements (author, category, tags, content ID, publish date, word count)
- `analytics-event` shared compiler output
- Content performance KPI list

**Output:**
- `content-analytics-mapping.json` — per-content-type analytics metadata requirements: content type, required tracking fields (content ID, title, author, category, tags, publish date, word count, experiment variant), analytics event references, field-to-event property mapping

**Spec file:** `content-analytics-mapping.spec.json`

**Correctness Gates:**
1. Every content type has a tracking field list defined
2. Every tracking field maps to a property in the `analytics-event` shared compiler output
3. Content ID is a required tracking field for every content type
4. Event references resolve to valid entries in the `analytics-event` catalog
5. Experiment variant tracking is declared for content types used in experiments
6. No tracking field maps to PII data without explicit declaration and masking rule

**Error Codes:**
- `CM360` — Content type missing tracking field definition
- `CM361` — Tracking field not found in analytics-event output
- `CM362` — Content ID missing as required tracking field
- `CM363` — Experiment variant tracking not declared for experimental content type
- `CM364` — Tracking field maps to PII without masking declaration

**Key Invariant:** Compiler must fail if any tracking field maps to a PII-classified field without an explicit masking or anonymization rule.

**Safe Default:** Without content-analytics-mapping, content performance data is unstructured and inconsistent, making content attribution analysis impossible.

**Dependencies:**
- `content-type-schema.json`
- `analytics-event` (shared compiler)
- `taxonomy-tagging-policy.json`

**Downstream Consumers:**
- Analytics pipeline
- Content performance reporting

---

### 38. `moderation-policy`

**Frequency:** per-project

**Input:**
- User-generated content (UGC) types (comments, reviews, user posts, forum replies)
- Moderation strategy (`pre-moderation` / `post-moderation` / `hybrid`)
- Rule categories (spam, hate speech, NSFW, off-topic, personal attacks)
- Escalation path
- Automated moderation tool config (if applicable)

**Output:**
- `moderation-policy.json` — per-UGC-type moderation rules: content type, moderation strategy, rule list (rule ID, category, trigger definition, action: `approve` / `hold` / `reject` / `escalate`), automated filter config (keyword list, pattern list), escalation path, appeal mechanism, data retention for rejected content

**Spec file:** `moderation-policy.spec.json`

**Correctness Gates:**
1. Every UGC content type has a moderation strategy declared
2. Every rule has a binary trigger definition (not vague "inappropriate content")
3. Every rule has a defined action: `approve` | `hold` | `reject` | `escalate`
4. Automated filter config references a specific keyword/pattern list (not "common sense")
5. Escalation path is defined (who receives escalated content and in what timeframe)
6. Appeal mechanism is declared for `reject` actions
7. Data retention for rejected content is defined (cannot be undefined)

**Error Codes:**
- `CM370` — UGC type missing moderation strategy
- `CM371` — Rule has non-binary trigger definition
- `CM372` — Rule missing defined action
- `CM373` — Escalation path not defined
- `CM374` — Appeal mechanism not declared for reject action

**Key Invariant:** Compiler must fail if any UGC content type has no moderation strategy declared.

**Safe Default:** Without moderation-policy, UGC surfaces accept all content without review, creating legal and reputational risk.

**Dependencies:**
- `content-type-schema.json`
- `publishing-workflow-spec.json`

**Downstream Consumers:**
- CMS moderation queue config
- `stale-content-audit-report`

---

## Recommended Build Order

The dependency graph resolves into tiers. Content type and governance foundations must precede metadata, SEO, and publishing specs, which must precede entry-level and campaign compilers.

---

### Tier 0 — External Inputs (pre-conditions, not compilers)

These must exist before any Content Manager compiler can run.

```
- react-page               (already built — for page/route cross-checks)
- react-component          (already built — for content block/CTA surface checks)
- feature-flag             (shared — for experiment variants)
- analytics-event          (shared — for content analytics mapping)
- i18n                     (shared — for localization cross-checks)
- a11y-test                (shared — for alt text and accessibility alignment)
- pii-classification-policy (security compiler — for analytics and masking)
```

---

### Tier 1 — Structural Foundations (no Content Manager compiler dependencies)

```
1. content-type-schema            ← foundational content model
2. slug-url-policy                ← foundational URL governance
3. alt-text-policy                ← foundational accessibility for media
```

---

### Tier 2 — Governance & Taxonomy Compilers (depend on Tier 1)

```
4.  category-hierarchy-spec       ← depends on: slug-url-policy
5.  taxonomy-tagging-policy       ← depends on: content-type-schema, category-hierarchy-spec
6.  canonical-url-policy          ← depends on: slug-url-policy
7.  cms-field-mapping-spec        ← depends on: content-type-schema
8.  media-caption-credit-policy   ← depends on: alt-text-policy
9.  publishing-workflow-spec      ← depends on: compliance-disclaimer-policy (soft)
10. compliance-disclaimer-policy  ← depends on: content-type-schema
```

---

### Tier 3 — Asset & Identity Compilers (depend on Tier 2)

```
11. image-asset-manifest          ← depends on: alt-text-policy, media-caption-credit-policy
12. author-profile-spec           ← depends on: image-asset-manifest, slug-url-policy
13. reusable-content-block-library ← depends on: content-type-schema
```

---

### Tier 4 — Metadata & SEO Compilers (depend on Tier 3)

```
14. seo-metadata-spec             ← depends on: canonical-url-policy, content-type-schema, localization-content-spec
15. schema-org-mapping            ← depends on: content-type-schema, seo-metadata-spec, author-profile-spec
16. localization-content-spec     ← depends on: content-type-schema, slug-url-policy, i18n (shared)
17. content-versioning-policy     ← depends on: publishing-workflow-spec
```

---

### Tier 5 — URL, Linking & Redirect Compilers (depend on Tier 4)

```
18. redirect-manifest             ← depends on: slug-url-policy, canonical-url-policy
19. internal-linking-map          ← depends on: slug-url-policy, category-hierarchy-spec
20. archive-unpublish-policy      ← depends on: redirect-manifest, internal-linking-map
```

---

### Tier 6 — Content Specification Compilers (depend on Tier 5)

```
21. article-metadata-spec         ← depends on: seo-metadata-spec, canonical-url-policy, author-profile-spec, image-asset-manifest, taxonomy-tagging-policy
22. content-brief-spec            ← depends on: content-type-schema, author-profile-spec, internal-linking-map
23. cta-copy-manifest             ← depends on: slug-url-policy, feature-flag (shared)
24. structured-faq-schema         ← depends on: schema-org-mapping, content-type-schema
25. moderation-policy             ← depends on: content-type-schema, publishing-workflow-spec
```

---

### Tier 7 — Entry & Legal Compilers (depend on Tier 6)

```
26. content-entry-manifest        ← depends on: content-type-schema, cms-field-mapping-spec, publishing-workflow-spec, article-metadata-spec
27. legal-approval-manifest       ← depends on: compliance-disclaimer-policy, publishing-workflow-spec
28. landing-page-content-model    ← depends on: cta-copy-manifest, seo-metadata-spec, compliance-disclaimer-policy
```

---

### Tier 8 — Campaign & Schedule Compilers (depend on Tier 7)

```
29. publish-schedule-manifest     ← depends on: publishing-workflow-spec, content-entry-manifest
30. experiment-content-variant-spec ← depends on: content-type-schema, feature-flag (shared), analytics-event (shared)
31. campaign-content-bundle       ← depends on: landing-page-content-model, publish-schedule-manifest, experiment-content-variant-spec, legal-approval-manifest
32. newsletter-distribution-manifest ← depends on: reusable-content-block-library, campaign-content-bundle, cta-copy-manifest
33. editorial-calendar            ← depends on: publish-schedule-manifest, content-brief-spec, campaign-content-bundle
```

---

### Tier 9 — Analytics, Review & Reporting Compilers (depend on Tier 8)

```
34. content-analytics-mapping     ← depends on: content-type-schema, analytics-event (shared), taxonomy-tagging-policy
35. content-review-checklist      ← depends on: seo-metadata-spec, alt-text-policy, compliance-disclaimer-policy, legal-approval-manifest, publishing-workflow-spec
36. content-migration-manifest    ← depends on: content-type-schema, cms-field-mapping-spec, slug-url-policy, redirect-manifest
```

---

### Tier 10 — Operational / Audit Compilers (depend on full network)

```
37. stale-content-audit-report    ← depends on: archive-unpublish-policy, internal-linking-map, redirect-manifest, compliance-disclaimer-policy
38. content-refresh-plan          ← depends on: stale-content-audit-report, author-profile-spec
```

---

### Full Linear Build Order (safe DAG serialization)

```
1.  content-type-schema
2.  slug-url-policy
3.  alt-text-policy
4.  category-hierarchy-spec
5.  taxonomy-tagging-policy
6.  canonical-url-policy
7.  cms-field-mapping-spec
8.  media-caption-credit-policy
9.  compliance-disclaimer-policy
10. publishing-workflow-spec
11. image-asset-manifest
12. author-profile-spec
13. reusable-content-block-library
14. localization-content-spec
15. seo-metadata-spec
16. schema-org-mapping
17. content-versioning-policy
18. redirect-manifest
19. internal-linking-map
20. archive-unpublish-policy
21. article-metadata-spec
22. content-brief-spec
23. cta-copy-manifest
24. structured-faq-schema
25. moderation-policy
26. content-entry-manifest
27. legal-approval-manifest
28. landing-page-content-model
29. publish-schedule-manifest
30. experiment-content-variant-spec
31. campaign-content-bundle
32. newsletter-distribution-manifest
33. editorial-calendar
34. content-analytics-mapping
35. content-review-checklist
36. content-migration-manifest
37. stale-content-audit-report
38. content-refresh-plan
```

---

*Document generated for: Domain Compiler Network — Content Manager Role*
*Total compilers defined: 38*
*Excludes: already-built compilers (9) and shared/cross-role compilers (5)*
*Stack assumptions: Headless CMS (Sanity / Contentful / Strapi / Storyblok), MDX pipelines, WordPress headless*
*Cross-compiler checks defined against: react-page, react-component, feature-flag, analytics-event, i18n, a11y-test, pii-classification-policy, authz-policy*
