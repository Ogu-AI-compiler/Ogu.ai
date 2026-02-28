/**
 * Trace Context Propagator — propagate trace context across boundaries.
 */

export function createTraceContext() {
  let traceId = null;
  let spanId = null;
  let parentSpanId = null;

  function setTraceId(id) { traceId = id; }
  function setSpanId(id) { spanId = id; }
  function getTraceId() { return traceId; }
  function getSpanId() { return spanId; }
  function getParentSpanId() { return parentSpanId; }

  function inject(headers) {
    if (traceId) headers["x-trace-id"] = traceId;
    if (spanId) headers["x-span-id"] = spanId;
    if (parentSpanId) headers["x-parent-span-id"] = parentSpanId;
  }

  function extract(headers) {
    if (headers["x-trace-id"]) traceId = headers["x-trace-id"];
    if (headers["x-span-id"]) spanId = headers["x-span-id"];
    if (headers["x-parent-span-id"]) parentSpanId = headers["x-parent-span-id"];
  }

  function propagate() {
    const child = createTraceContext();
    child.setTraceId(traceId);
    child._setParentSpanId(spanId);
    child.setSpanId(`span-child-${Math.random().toString(36).slice(2, 8)}`);
    return child;
  }

  function _setParentSpanId(id) { parentSpanId = id; }

  return {
    setTraceId, setSpanId,
    getTraceId, getSpanId, getParentSpanId,
    inject, extract, propagate,
    _setParentSpanId,
  };
}
