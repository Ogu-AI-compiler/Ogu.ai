/**
 * Archive Extractor — extract files from archives (in-memory).
 */
export function extractArchive(archive) {
  const files = [];
  for (const [path, content] of Object.entries(archive.files || {})) {
    files.push({ path, content });
  }
  return { metadata: archive.metadata, files };
}

export function getFileFromArchive(archive, path) {
  return archive.files ? archive.files[path] || null : null;
}

export function listArchiveFiles(archive) {
  return Object.keys(archive.files || {});
}
