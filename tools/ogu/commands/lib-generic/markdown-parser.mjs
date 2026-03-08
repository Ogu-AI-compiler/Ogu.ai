/**
 * Markdown Parser — parse markdown to AST nodes.
 */

/**
 * @param {string} input
 * @returns {{ type: 'document', children: Array, frontmatter?: object }}
 */
export function parse(input) {
  const lines = input.split("\n");
  const children = [];
  let frontmatter = null;
  let i = 0;

  // Parse frontmatter
  if (lines[0] === "---") {
    i = 1;
    const fmLines = [];
    while (i < lines.length && lines[i] !== "---") {
      fmLines.push(lines[i]);
      i++;
    }
    i++; // skip closing ---
    frontmatter = {};
    for (const line of fmLines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        frontmatter[key] = val;
      }
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      children.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
        children: [],
      });
      i++;
      continue;
    }

    // Code block
    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      const lang = codeMatch[1] || null;
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      children.push({
        type: "code_block",
        lang,
        text: codeLines.join("\n"),
        children: [],
      });
      continue;
    }

    // Paragraph: collect consecutive non-empty lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^#{1,6}\s/) && !lines[i].startsWith("```")) {
      paraLines.push(lines[i]);
      i++;
    }
    children.push({
      type: "paragraph",
      text: paraLines.join("\n"),
      children: [],
    });
  }

  const doc = { type: "document", children };
  if (frontmatter) doc.frontmatter = frontmatter;
  return doc;
}
