/**
 * Google Contacts (CSV & vCard / VCF) and Whitelist Parser for AI Auto-Reply rules.
 * Runs 100% in browser memory for privacy, speed, and zero backend overhead.
 */

export interface ParsedRuleContact {
  id: string;
  name: string;
  phone: string;
  formattedPhone: string;
  rawPhone?: string;
  type?: string;
  selected?: boolean;
}

let contactCounter = 0;
export function generateContactId(): string {
  contactCounter += 1;
  return `rc_${Date.now()}_${contactCounter}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Standardize and clean a phone number string into clean digits.
 * If 10-digit number and defaultCountryCode is provided (e.g. '91'), prefixes country code.
 */
export function cleanPhoneNumber(raw: string, defaultCountryCode = '91'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Strip all non-digit characters except leading '+'
  const hasLeadingPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) return '';

  // If number starts with 0 and has 11 digits (e.g. 09373395000 in India), strip the 0
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Common contact export glitch: accidentally prepending country code twice (e.g. +91 919373395000 -> 14 digits)
  if (digits.length === 14 && digits.startsWith('9191')) {
    digits = digits.slice(2);
  }

  // If already had leading '+' (e.g. +1 555 123 4567 -> 15551234567), keep digits
  if (hasLeadingPlus) {
    return digits;
  }

  // If standard 10-digit national number and country code provided, prepend country code
  if (digits.length === 10 && defaultCountryCode) {
    const cleanCc = defaultCountryCode.replace(/\D/g, '');
    return `${cleanCc}${digits}`;
  }

  return digits;
}

/**
 * Format clean phone number for friendly UI display (e.g. "+91 93733 95000")
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;

  // Indian numbers (starts with 91, 12 digits total)
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // North American numbers (starts with 1, 11 digits total)
  if (digits.startsWith('1') && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // UK numbers (starts with 44, 12 digits total)
  if (digits.startsWith('44') && digits.length === 12) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  return `+${digits}`;
}

/**
 * Robust CSV parser that correctly handles quoted strings with commas, quotes, and newlines.
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  const n = csvText.length;

  while (i < n) {
    const char = csvText[i];
    const nextChar = i + 1 < n ? csvText[i + 1] : '';

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: ""
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse Google Contacts CSV export (or generic CSV contact export).
 */
export function parseGoogleContactsCSV(csvText: string, defaultCountryCode = '91'): ParsedRuleContact[] {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());

  // Identify column indices
  let nameIdx = headers.findIndex(
    (h) => h === 'name' || h === 'full name' || h === 'display name' || h === 'contact name'
  );
  const givenNameIdx = headers.findIndex((h) => h === 'given name' || h === 'first name');
  const familyNameIdx = headers.findIndex((h) => h === 'family name' || h === 'last name');

  // Find all phone column indices (Google Contacts exports "Phone 1 - Value", "Phone 2 - Value", etc.)
  const phoneIndices: Array<{ idx: number; typeIdx?: number }> = [];
  headers.forEach((h, idx) => {
    if (
      h.includes('phone') ||
      h.includes('mobile') ||
      h.includes('cell') ||
      h.includes('tel') ||
      h === 'whatsapp'
    ) {
      if (h.includes('type')) {
        // Skip type column itself
        return;
      }
      // If it's a value column or general phone header
      phoneIndices.push({ idx });
    }
  });

  const contacts: ParsedRuleContact[] = [];
  const seenPhones = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let contactName = '';
    if (nameIdx !== -1 && row[nameIdx]) {
      contactName = row[nameIdx].trim();
    } else {
      const first = givenNameIdx !== -1 && row[givenNameIdx] ? row[givenNameIdx].trim() : '';
      const last = familyNameIdx !== -1 && row[familyNameIdx] ? row[familyNameIdx].trim() : '';
      contactName = `${first} ${last}`.trim();
    }

    // Extract all phone numbers in this row
    for (const p of phoneIndices) {
      const rawVal = row[p.idx];
      if (!rawVal) continue;

      // Some exports separate multiple numbers in a cell with " ::: " or " / " or ";"
      const splitNumbers = rawVal.split(/:::|\/|;/).map((s) => s.trim()).filter(Boolean);

      for (const numStr of splitNumbers) {
        const clean = cleanPhoneNumber(numStr, defaultCountryCode);
        if (clean.length >= 7 && !seenPhones.has(clean)) {
          seenPhones.add(clean);
          contacts.push({
            id: generateContactId(),
            name: contactName,
            phone: clean,
            formattedPhone: formatPhoneDisplay(clean),
            rawPhone: numStr,
            selected: true,
          });
        }
      }
    }
  }

  return contacts;
}

/**
 * Parse standard vCard (.vcf / .vcard) files, supporting version 2.1, 3.0, 4.0.
 */
export function parseVCard(vcfText: string, defaultCountryCode = '91'): ParsedRuleContact[] {
  // Normalize CRLF to LF
  const text = vcfText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Unfold multi-line folded vCard properties (line starting with space or tab)
  const unfolded = text.replace(/\n[ \t]/g, '');

  const cards = unfolded.split(/BEGIN:VCARD/i).filter((c) => c.trim().length > 0);
  const contacts: ParsedRuleContact[] = [];
  const seenPhones = new Set<string>();

  for (const card of cards) {
    const lines = card.split('\n').map((l) => l.trim()).filter(Boolean);

    let contactName = '';
    const phoneList: Array<{ raw: string; type?: string }> = [];

    for (const line of lines) {
      if (/^END:VCARD/i.test(line)) break;

      // Formatted Name: FN:...
      if (/^FN/i.test(line)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          contactName = line.slice(colonIdx + 1).trim();
        }
      }

      // Name parts: N:Family;Given;Additional;Prefix;Suffix
      if (!contactName && /^N[:;]/i.test(line)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const parts = line.slice(colonIdx + 1).split(';');
          const family = parts[0] ? parts[0].trim() : '';
          const given = parts[1] ? parts[1].trim() : '';
          contactName = `${given} ${family}`.trim();
        }
      }

      // Phone lines: TEL;...:+91... or TEL:+91...
      if (/^TEL/i.test(line)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const rawNum = line.slice(colonIdx + 1).trim();
          phoneList.push({ raw: rawNum });
        }
      }
    }

    for (const p of phoneList) {
      const clean = cleanPhoneNumber(p.raw, defaultCountryCode);
      if (clean.length >= 7 && !seenPhones.has(clean)) {
        seenPhones.add(clean);
        contacts.push({
          id: generateContactId(),
          name: contactName,
          phone: clean,
          formattedPhone: formatPhoneDisplay(clean),
          rawPhone: p.raw,
          type: p.type,
          selected: true,
        });
      }
    }
  }

  return contacts;
}

/**
 * Parse manual pasted text, accommodating comma/newline separation,
 * formats like "Name: Phone", "Phone (Name)", or "Phone | Name".
 */
export function parsePastedContacts(text: string, defaultCountryCode = '91'): ParsedRuleContact[] {
  if (!text) return [];

  // Split on newlines or commas (while being careful with parens)
  const items = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const contacts: ParsedRuleContact[] = [];
  const seenPhones = new Set<string>();

  for (const item of items) {
    // If the line contains comma-separated numbers without parens, split them
    let subItems: string[] = [item];
    if (item.includes(',') && !item.includes('(')) {
      subItems = item.split(',').map((s) => s.trim()).filter(Boolean);
    }

    for (const sub of subItems) {
      let name = '';
      let rawPhone = sub;

      if (sub.includes('|')) {
        const [p, ...nameParts] = sub.split('|');
        rawPhone = p.trim();
        name = nameParts.join('|').trim();
      } else if (sub.includes(':')) {
        const [nPart, ...pParts] = sub.split(':');
        name = nPart.trim();
        rawPhone = pParts.join(':').trim();
      } else {
        const parenMatch = sub.match(/^([^\(]+)\((.+)\)$/);
        if (parenMatch) {
          const partA = parenMatch[1].trim();
          const partB = parenMatch[2].trim();
          // Check which part has digits
          if (partA.replace(/\D/g, '').length >= 7) {
            rawPhone = partA;
            name = partB;
          } else {
            rawPhone = partB;
            name = partA;
          }
        }
      }

      const clean = cleanPhoneNumber(rawPhone, defaultCountryCode);
      if (clean.length >= 7 && !seenPhones.has(clean)) {
        seenPhones.add(clean);
        contacts.push({
          id: generateContactId(),
          name,
          phone: clean,
          formattedPhone: formatPhoneDisplay(clean),
          rawPhone,
          selected: true,
        });
      }
    }
  }

  return contacts;
}

/**
 * Convert backend rule.specificNumbers string array into parsed ContactEntry objects.
 */
export function deserializeRuleNumbers(entries: string[]): ParsedRuleContact[] {
  if (!Array.isArray(entries)) return [];

  return entries.map((entry) => {
    const raw = (entry || '').trim();
    let name = '';
    let phoneDigits = '';

    if (raw.includes('|')) {
      const [p, ...rest] = raw.split('|');
      phoneDigits = p.replace(/\D/g, '');
      name = rest.join('|').trim();
    } else {
      const match = raw.match(/^([^\(]+)\((.+)\)$/);
      if (match) {
        phoneDigits = match[1].replace(/\D/g, '');
        name = match[2].trim();
      } else {
        phoneDigits = raw.replace(/\D/g, '');
      }
    }

    // Fallback if somehow empty
    if (!phoneDigits) {
      phoneDigits = raw;
    }

    return {
      id: generateContactId(),
      name,
      phone: phoneDigits,
      formattedPhone: formatPhoneDisplay(phoneDigits),
      selected: true,
    };
  });
}

/**
 * Serialize parsed contacts back into string array for rule.specificNumbers payload.
 */
export function serializeRuleContacts(contacts: ParsedRuleContact[]): string[] {
  return contacts
    .map((c) => {
      const cleanPhone = c.phone.replace(/\D/g, '');
      if (!cleanPhone) return '';
      const cleanName = (c.name || '').trim();
      if (cleanName) {
        return `${cleanPhone} (${cleanName})`;
      }
      return cleanPhone;
    })
    .filter(Boolean);
}
