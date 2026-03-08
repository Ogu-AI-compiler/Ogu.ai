# Security Safe HTML Module — Implementation Prompt

You are implementing a component that renders trusted or sanitized HTML safely.

## Spec
Read `safe-html-spec.json` for:
- `component`: component name
- `allowed_tags`: array of HTML tags to allow
- `sanitizer`: `dompurify` | `sanitize-html`

## Requirements

### Never allowed
- `dangerouslySetInnerHTML={{ __html: rawUserInput }}` — ALWAYS sanitize first
- `.innerHTML = userContent` — use sanitizer or textContent
- `href="javascript:..."` — strip javascript: protocol
- Inline event handlers from user content

### Sanitization pattern
```typescript
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'];

export function SafeHtml({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'title'] });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### URL allowlist (if rendering links)
```typescript
const ALLOWED_ORIGINS = ['https://example.com', 'https://cdn.example.com'];
function isAllowedUrl(url: string): boolean {
  try { return ALLOWED_ORIGINS.includes(new URL(url).origin); } catch { return false; }
}
```

### Tests must include XSS payloads
```typescript
it('strips <script> tags', () => {
  render(<SafeHtml html='<script>alert(1)</script><p>hello</p>' />);
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText('hello')).toBeInTheDocument();
});
it('strips javascript: href', () => {
  render(<SafeHtml html='<a href="javascript:alert(1)">click</a>' />);
  expect(screen.getByRole('link')).not.toHaveAttribute('href', expect.stringContaining('javascript:'));
});
```

## Output
- `SafeHtml.tsx` (or spec component name)
- `SafeHtml.test.tsx` with XSS test vectors
