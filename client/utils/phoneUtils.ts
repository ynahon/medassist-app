export type PhoneNormalizeResult =
  | { ok: true; value: string; type: "IL" | "US516" }
  | { ok: false; error: string };

export function normalizePhone(input: string): PhoneNormalizeResult {
  const cleaned = input.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+972")) {
    const rest = cleaned.slice(4);
    const localNumber = "0" + rest;
    if (/^05\d{8}$/.test(localNumber)) {
      const formatted = localNumber.slice(0, 3) + "-" + localNumber.slice(3);
      return { ok: true, value: formatted, type: "IL" };
    }
    return { ok: false, error: "Invalid Israel phone format" };
  }
  
  if (cleaned.startsWith("972") && cleaned.length >= 12) {
    const rest = cleaned.slice(3);
    const localNumber = "0" + rest;
    if (/^05\d{8}$/.test(localNumber)) {
      const formatted = localNumber.slice(0, 3) + "-" + localNumber.slice(3);
      return { ok: true, value: formatted, type: "IL" };
    }
    return { ok: false, error: "Invalid Israel phone format" };
  }
  
  if (cleaned.startsWith("+1")) {
    const digits = cleaned.slice(2);
    if (digits.length === 10 && digits.startsWith("516")) {
      const formatted = "516-" + digits.slice(3);
      return { ok: true, value: formatted, type: "US516" };
    }
    return { ok: false, error: "Invalid US phone format (only area code 516 supported)" };
  }
  
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    const digits = cleaned.slice(1);
    if (digits.startsWith("516")) {
      const formatted = "516-" + digits.slice(3);
      return { ok: true, value: formatted, type: "US516" };
    }
    return { ok: false, error: "Invalid US phone format (only area code 516 supported)" };
  }
  
  if (/^05\d{8}$/.test(cleaned)) {
    const formatted = cleaned.slice(0, 3) + "-" + cleaned.slice(3);
    return { ok: true, value: formatted, type: "IL" };
  }
  
  if (/^516\d{7}$/.test(cleaned)) {
    const formatted = "516-" + cleaned.slice(3);
    return { ok: true, value: formatted, type: "US516" };
  }
  
  return { ok: false, error: "Invalid phone format" };
}
