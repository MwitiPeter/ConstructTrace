/**
 * PDF text extraction with real page numbers, using modern pdfjs-dist
 * (Mozilla's maintained PDF.js). Runs fully in Node — no browser, no network.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extract text from a PDF buffer while preserving page numbers.
 * Returns { pages: [{ page, text }], meta: { numPages } }.
 * Throws a readable Error when the PDF cannot be read (corrupt / image-only).
 */
export async function extractPdfPages(buffer) {
  // Copy into a plain Uint8Array — Node Buffers are rejected by pdf.js.
  const data = new Uint8Array(buffer);

  const task = getDocument({
    data,
    verbosity: 0, // silence warnings
    disableFontFace: true, // text extraction never needs rendered fonts
    isEvalSupported: false,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    throw new Error(err?.message || 'invalid PDF');
  }

  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = '';
      let lastY = null;

      for (const item of content.items) {
        if (typeof item.str !== 'string') continue; // marked content, not text
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        // Start a new line when the vertical position changes.
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += '\n';
        text += item.str;
        if (item.hasEOL) {
          text += '\n';
          lastY = null;
          continue;
        }
        lastY = y;
      }

      const cleaned = text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      pages.push({ page: pageNumber, text: cleaned });
      page.cleanup();
    }

    return { pages, meta: { numPages: doc.numPages } };
  } finally {
    await doc.destroy().catch(() => {});
  }
}
