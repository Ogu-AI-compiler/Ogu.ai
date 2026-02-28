/**
 * Span Collector — collect distributed tracing spans with timing.
 */

let nextId = 1;

export function createSpanCollector() {
  const spans = [];

  function startSpan({ name, traceId, parentSpanId }) {
    const span = {
      spanId: `span-${nextId++}`,
      traceId,
      parentSpanId: parentSpanId || null,
      name,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
    };
    spans.push(span);
    return { spanId: span.spanId, name: span.name, parentSpanId: span.parentSpanId };
  }

  function endSpan(spanId) {
    const span = spans.find(s => s.spanId === spanId);
    if (!span) throw new Error(`Unknown span: ${spanId}`);
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
  }

  function getSpans() {
    return spans.map(s => ({ ...s }));
  }

  return { startSpan, endSpan, getSpans };
}
