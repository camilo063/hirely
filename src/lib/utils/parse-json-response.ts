/**
 * Robust JSON parser for Claude API responses.
 * Handles common issues: markdown code blocks, leading/trailing text,
 * partial responses, etc.
 */
export function parseJsonResponse(text: string): any {
  let clean = text.trim();

  // Remove markdown code blocks
  clean = clean.replace(/^```(?:json)?\s*\n?/i, '');
  clean = clean.replace(/\n?```\s*$/i, '');
  clean = clean.trim();

  // If there's text before the first {, strip it
  const firstBrace = clean.indexOf('{');
  if (firstBrace > 0) {
    clean = clean.substring(firstBrace);
  }

  // Find the last } and strip trailing text
  const lastBrace = clean.lastIndexOf('}');
  if (lastBrace > 0 && lastBrace < clean.length - 1) {
    clean = clean.substring(0, lastBrace + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (error) {
    // Try one more thing: sometimes Claude adds trailing commas
    try {
      const noTrailingCommas = clean.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(noTrailingCommas);
    } catch {
      throw new Error(
        `Error parseando JSON de Claude: ${error}. Respuesta: ${clean.substring(0, 300)}...`
      );
    }
  }
}
