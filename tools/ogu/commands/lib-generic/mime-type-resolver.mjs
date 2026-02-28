/**
 * MIME Type Resolver — resolve MIME types for file extensions.
 */
const defaultTypes = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.zip': 'application/zip'
};

export function createMimeTypeResolver(extra = {}) {
  const types = { ...defaultTypes, ...extra };
  function resolve(ext) { return types[ext.startsWith('.') ? ext : `.${ext}`] || 'application/octet-stream'; }
  function add(ext, mimeType) { types[ext.startsWith('.') ? ext : `.${ext}`] = mimeType; }
  function getExtension(mimeType) {
    for (const [ext, mime] of Object.entries(types)) { if (mime === mimeType) return ext; }
    return null;
  }
  function list() { return { ...types }; }
  return { resolve, add, getExtension, list };
}
