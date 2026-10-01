/**
 * Fixed-code policy for diagnostic suggestions. It intentionally returns a
 * decision only; there is no executor and no command dispatch path here.
 */
const ALLOWED_PATTERNS = [
  /^(view|show|read|query|inspect|check|list|describe|status|ping)\b/i,
  /\b(metrics|logs?|status|processes|configuration diff|connection pool)\b/i,
];
const BLOCKED_PATTERNS = [
  /\b(delete|remove|rm\b|drop|truncate|restart|reboot|kill|rollback|deploy|apply|scale|write|update|insert|chmod|chown)\b/i,
  /(;|&&|\|\||\||`|\$\(|\$\{|base64|powershell|curl\s+.*\s+-[xdo])/i,
  /\b(ignore (previous|all) instructions|system prompt)\b/i,
];

function evaluateDiagnostic(suggestion) {
  const text = String(suggestion || '').trim();
  if (!text) return { decision: 'blocked', risk: 'high', reason: 'An empty diagnostic cannot be validated.' };
  if (BLOCKED_PATTERNS.some(pattern => pattern.test(text))) {
    return { decision: 'blocked', risk: 'high', reason: 'Contains a state-changing, hidden, chained, or prompt-injection pattern.' };
  }
  if (!ALLOWED_PATTERNS.every(pattern => pattern.test(text))) {
    return { decision: 'needs review', risk: 'medium', reason: 'Does not clearly match the read-only diagnostic allowlist.' };
  }
  return { decision: 'allowed', risk: 'low', reason: 'Matches the read-only diagnostic allowlist.' };
}

module.exports = { evaluateDiagnostic };
