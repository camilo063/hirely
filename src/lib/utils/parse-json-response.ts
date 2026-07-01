/**
 * Robust JSON parser for Claude API responses.
 * Handles: markdown code blocks, leading/trailing text, truncated responses.
 */
export function parseJsonResponse(text: string): any {
  let clean = text.trim();

  // Remove markdown code blocks
  clean = clean.replace(/^```(?:json)?\s*\n?/i, '');
  clean = clean.replace(/\n?```\s*$/i, '');
  clean = clean.trim();

  // Strip text before the first {
  const firstBrace = clean.indexOf('{');
  if (firstBrace > 0) {
    clean = clean.substring(firstBrace);
  }

  // Strip text after the last } (only when fully balanced — handled below)
  const lastBrace = clean.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < clean.length - 1) {
    clean = clean.substring(0, lastBrace + 1);
  }

  // 1st attempt: parse as-is
  try {
    return JSON.parse(clean);
  } catch (_) {}

  // 2nd attempt: remove trailing commas
  try {
    return JSON.parse(clean.replace(/,\s*([}\]])/g, '$1'));
  } catch (_) {}

  // 3rd attempt: repair truncated JSON (Claude hit its output-token limit)
  try {
    const repaired = repairTruncatedJson(clean);
    if (repaired !== null) return repaired;
  } catch (_) {}

  throw new Error(
    `Error parseando JSON de Claude: respuesta inválida o demasiado truncada. Respuesta: ${clean.substring(0, 300)}...`
  );
}

/**
 * Attempts to repair a JSON string that was cut off mid-way (e.g. due to max_tokens).
 * Strategy:
 *  1. If we're inside an unclosed string literal, cut back to before that string.
 *  2. Remove any dangling comma.
 *  3. Close all open arrays/objects in reverse order.
 *  4. Re-parse.
 */
function repairTruncatedJson(text: string): any {
  // Walk the text tracking structure state
  const stack: string[] = []; // expected closing chars, e.g. '}', ']'
  let inString = false;
  let escaped = false;
  let lastStringStart = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }

    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; lastStringStart = i; continue; }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack.length > 0) stack.pop();
  }

  // Fully balanced, no repair needed
  if (stack.length === 0 && !inString) return null;

  // Start with full text
  let safe = text;

  // If truncated inside a string, cut back to before that string opened
  if (inString && lastStringStart >= 0) {
    safe = text.substring(0, lastStringStart);
  }

  // Remove trailing comma and whitespace
  safe = safe.replace(/,\s*$/, '').trimEnd();

  // Recount what's still open in `safe`
  const safeStack: string[] = [];
  let si = false, se = false;
  for (const c of safe) {
    if (se) { se = false; continue; }
    if (si) { if (c === '\\') se = true; else if (c === '"') si = false; continue; }
    if (c === '"') { si = true; continue; }
    if (c === '{') safeStack.push('}');
    else if (c === '[') safeStack.push(']');
    else if ((c === '}' || c === ']') && safeStack.length > 0) safeStack.pop();
  }

  const repaired = safe + safeStack.reverse().join('');
  return JSON.parse(repaired);
}
