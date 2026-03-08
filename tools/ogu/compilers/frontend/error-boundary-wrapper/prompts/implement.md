# Error Boundary Wrapper — Implementation Prompt

You are implementing a React Error Boundary component.

## Spec
Read `error-boundary-spec.json` for:
- `component`: boundary name
- `fallback_component`: fallback UI component name
- `scope`: what subtree this wraps
- `error_service`: optional error reporting service

## Requirements

### Implementation options (choose one)
1. Class component with `getDerivedStateFromError` + `componentDidCatch`
2. `react-error-boundary` library with `<ErrorBoundary FallbackComponent={...}>`

### Fallback UI
- Must define `FallbackComponent` that renders safe UI
- Fallback must NOT throw, use hooks that can throw, or make network calls
- Fallback receives `{ error, resetErrorBoundary }` props

### Error reporting (if error_service provided)
- `componentDidCatch` must call structured sink: `Sentry.captureException`, `logger.error`, or `errorService.report`
- Not just `console.log`

### Pattern (class)
```typescript
export class ProductErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    errorService.report({ error, info, scope: 'ProductSection' });
  }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
```

## Output
- `[Name]ErrorBoundary.tsx`
- `[Name]ErrorFallback.tsx`
- `[Name]ErrorBoundary.test.tsx`
