import { Injectable } from '@nestjs/common';

export interface ScanResult {
  flagged: boolean;
  redacted: string;
  categories: string[];
  severity: 'low' | 'medium' | 'high';
}

// Patterns that indicate an attempt to take the relationship off-platform.
const PATTERNS: Array<{ category: string; re: RegExp }> = [
  { category: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi },
  { category: 'url', re: /\b(?:https?:\/\/|www\.)[^\s]+/gi },
  { category: 'phone', re: /(?<!\d)\+?\d[\d\s().-]{7,}\d(?!\d)/g },
  { category: 'social_handle', re: /(?:^|\s)@[a-z0-9._]{2,}/gi },
  { category: 'offplatform_invite', re: /\b(whats\s?app|telegram|signal|snapchat|venmo|cash\s?app|paypal|dm me|email me|text me|call me|reach me (?:at|on)|off[\s-]?platform|my (?:cell|number|email))\b/gi },
];

const HIGH = new Set(['email', 'phone', 'url']);

@Injectable()
export class ContactScannerService {
  scan(text: string): ScanResult {
    let redacted = text;
    const categories = new Set<string>();

    for (const { category, re } of PATTERNS) {
      // Fresh RegExp per scan — a module-level /g regex keeps stateful lastIndex.
      const detect = new RegExp(re.source, re.flags);
      if (detect.test(text)) {
        categories.add(category);
        redacted = redacted.replace(new RegExp(re.source, re.flags), (m) =>
          // keep any leading whitespace captured by some patterns, redact the rest
          m.replace(/\S/g, '').concat('[redacted]'),
        );
      }
    }

    const cats = [...categories];
    const severity: ScanResult['severity'] = cats.some((c) => HIGH.has(c))
      ? 'high'
      : cats.length > 0
        ? 'medium'
        : 'low';

    return { flagged: cats.length > 0, redacted, categories: cats, severity };
  }
}
