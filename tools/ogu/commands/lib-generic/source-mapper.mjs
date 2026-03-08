/**
 * Source Mapper — map generated positions back to source positions.
 */
export function createSourceMapper() {
  const mappings = [];
  function addMapping(generated, source) {
    mappings.push({ generated, source });
  }
  function getSource(genLine, genCol) {
    for (const m of mappings) {
      if (m.generated.line === genLine && m.generated.col === genCol) return m.source;
    }
    return null;
  }
  function getGenerated(srcLine, srcCol) {
    for (const m of mappings) {
      if (m.source.line === srcLine && m.source.col === srcCol) return m.generated;
    }
    return null;
  }
  function getMappings() { return [...mappings]; }
  function count() { return mappings.length; }
  return { addMapping, getSource, getGenerated, getMappings, count };
}
