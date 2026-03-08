# Unit Test Module — Implementation Prompt

You are writing unit/integration tests using Testing Library and Vitest.

## Spec
Read `unit-test-spec.json` for:
- `component`: component name to test
- `test_scenarios`: array of scenario descriptions
- `coverage_target`: minimum coverage %

## Requirements

### Query priority (Testing Library)
1. `getByRole` — semantic HTML role
2. `getByLabelText` — form labels
3. `getByPlaceholderText` — inputs
4. `getByText` — visible text
Never use: `getByTestId`, `querySelector`, `getElementsBy*`

### Test isolation
- Each test must be independent
- Use `beforeEach` to reset state, not `beforeAll` with shared mutation
- No real network calls — use `vi.fn()` or MSW

### Assertion quality
- Use `toHaveTextContent`, `toBeInTheDocument`, `toHaveValue` — not `toBeTruthy()`
- Every `it` block must have at least one `expect()`

### Pattern
```typescript
describe('ProductCard', () => {
  it('renders product name and price', () => {
    render(<ProductCard name="Widget" price={9.99} />);
    expect(screen.getByRole('heading', { name: 'Widget' })).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('calls onAddToCart when button clicked', async () => {
    const onAddToCart = vi.fn();
    render(<ProductCard name="Widget" price={9.99} onAddToCart={onAddToCart} />);
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledWith('Widget');
  });
});
```

## Output
- `[ComponentName].test.tsx`
