import YAML from 'yaml';
import { formatUnstructuredXml } from './xml.js';

export type DetectedLanguageType =
  | 'sql-embedded-xml'
  | 'sql-embedded-json'
  | 'xml'
  | 'json'
  | 'yaml'
  | 'html'
  | 'plaintext';

export interface IntelligentFormatResult {
  formatted: string;
  detectedLanguage: DetectedLanguageType;
  description: string;
  wasFormatted: boolean;
}

/**
 * Strips comments and trailing commas for tolerant/relaxed JSON parsing
 */
function sanitizeRelaxedJson(input: string): string {
  // Remove single line comments // ... and multi-line comments /* ... */
  let cleaned = input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\\:])\/\/.*$/gm, '$1');
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned.trim();
}

/**
 * Checks if a string inside quotes is a valid JSON payload
 */
function tryParseJson(text: string): Record<string, unknown> | unknown[] | null {
  const trimmed = text.trim();
  if ((!trimmed.startsWith('{') || !trimmed.endsWith('}')) &&
      (!trimmed.startsWith('[') || !trimmed.endsWith(']'))) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(sanitizeRelaxedJson(trimmed));
    } catch {
      return null;
    }
  }
}

/**
 * Detects whether content contains SQL statements with embedded XML or JSON
 */
export function detectSqlEmbeddedFormat(content: string): 'xml' | 'json' | null {
  if (!content) return null;
  // Check for common SQL keywords
  const hasSqlKeywords = /(?:REPLACE\s+INTO|INSERT\s+INTO|UPDATE\s+|SET\s+|VALUES\s*\(|SELECT\s+)/i.test(content);
  if (!hasSqlKeywords) return null;

  // Check for embedded XML literal in quotes
  if (/'(?:<\?xml|<[a-zA-Z0-9_:\-.]+[\s\S]*?>)[\s\S]*?<\/[a-zA-Z0-9_:\-.]+>'/i.test(content)) {
    return 'xml';
  }

  // Check for embedded JSON literal in quotes
  const jsonQuoteMatch = content.match(/'(\s*[\{\[][\s\S]*?[\}\]]\s*)'/);
  if (jsonQuoteMatch && tryParseJson(jsonQuoteMatch[1])) {
    return 'json';
  }

  return null;
}

/**
 * Intelligently detects the underlying language and format of content
 */
export function detectIntelligentLanguage(
  content: string,
  filePath?: string
): { detectedLanguage: DetectedLanguageType; description: string } {
  if (!content || !content.trim()) {
    return { detectedLanguage: 'plaintext', description: 'Plain Text' };
  }

  const trimmed = content.trim();
  const lowerPath = (filePath || '').toLowerCase();
  const ext = lowerPath.split('.').pop() || '';

  // 1. SQL with embedded XML or JSON
  const sqlEmbedded = detectSqlEmbeddedFormat(content);
  if (sqlEmbedded === 'xml') {
    return { detectedLanguage: 'sql-embedded-xml', description: 'SQL with Embedded XML' };
  }
  if (sqlEmbedded === 'json') {
    return { detectedLanguage: 'sql-embedded-json', description: 'SQL with Embedded JSON' };
  }

  // 2. Pure XML
  const hasXmlDecl = trimmed.startsWith('<?xml');
  const hasXmlTags = /^<([a-zA-Z0-9_:\-.]+)(?:\s+[^>]*?)?>[\s\S]*<\/\1>$/i.test(trimmed) ||
                     /^<[a-zA-Z0-9_:\-.]+(?:\s+[^>]*?)?\/>$/i.test(trimmed) ||
                     (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'));

  if (hasXmlDecl || (hasXmlTags && !/^<!DOCTYPE\s+html/i.test(trimmed) && !/^<html/i.test(trimmed))) {
    return { detectedLanguage: 'xml', description: 'XML Document' };
  }
  if (['xml', 'xsd', 'wsdl', 'scxml', 'svg', 'pom', 'config'].includes(ext) && trimmed.startsWith('<')) {
    return { detectedLanguage: 'xml', description: 'XML Document' };
  }

  // 3. HTML
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || ['html', 'htm'].includes(ext)) {
    return { detectedLanguage: 'html', description: 'HTML Document' };
  }

  // 4. JSON
  if (tryParseJson(trimmed) !== null) {
    return { detectedLanguage: 'json', description: 'JSON Document' };
  }
  if (ext === 'json') {
    return { detectedLanguage: 'json', description: 'JSON Document' };
  }

  // 5. YAML
  if (['yaml', 'yml'].includes(ext)) {
    try {
      const parsed = YAML.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return { detectedLanguage: 'yaml', description: 'YAML Document' };
      }
    } catch {
      // not valid yaml
    }
  } else if (!trimmed.startsWith('<') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Check if looks like YAML key-value syntax
    if (/^[a-zA-Z0-9_.\-]+:\s+[^\n]+/m.test(trimmed) || /^-\s+[a-zA-Z0-9_.\-]+:/m.test(trimmed)) {
      try {
        const parsed = YAML.parse(trimmed);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return { detectedLanguage: 'yaml', description: 'YAML Document' };
        }
      } catch {
        // ignore
      }
    }
  }

  // 6. Generic embedded XML fallback (e.g. log files or config strings with <root>...</root>)
  if (/<[a-zA-Z0-9_:\-.]+[\s\S]*?<\/[a-zA-Z0-9_:\-.]+>/.test(trimmed)) {
    return { detectedLanguage: 'xml', description: 'Embedded XML' };
  }

  return { detectedLanguage: 'plaintext', description: 'Plain Text' };
}

/**
 * Formats SQL files containing embedded XML string literals:
 * Keeps the SQL statement prefix on line 1 with the XML declaration (if present).
 * Expands all XML tags with 2-space indentation across clean lines.
 * Re-attaches the closing quote and SQL suffix (e.g. ');') to the last line of the XML.
 */
export function formatSqlWithEmbeddedXml(sqlText: string): string {
  if (!sqlText) return '';

  // Matches any string literal enclosed in ' that contains XML
  const xmlLiteralRegex = /'((?:<\?xml[\s\S]*?\?>)?\s*<[a-zA-Z0-9_:\-.]+[\s\S]*?<\/[a-zA-Z0-9_:\-.]+>)'/g;

  return sqlText.replace(xmlLiteralRegex, (match, xmlContent) => {
    // Separate declaration if present
    const declMatch = xmlContent.match(/^\s*(<\?xml[\s\S]*?\?>)/i);
    let xmlDecl = '';
    let xmlBody = xmlContent;
    if (declMatch) {
      xmlDecl = declMatch[1].trim();
      xmlBody = xmlContent.substring(declMatch[0].length).trim();
    }

    const formattedXml = formatUnstructuredXml(xmlBody);
    const xmlLines = formattedXml.split('\n');

    if (xmlLines.length === 0) return match;

    if (xmlDecl) {
      // Line 1: ' + xmlDecl
      // Following lines: indented XML elements
      // Last line: last line + '
      const res: string[] = ["'" + xmlDecl];
      for (let i = 0; i < xmlLines.length; i++) {
        if (i === xmlLines.length - 1) {
          res.push(xmlLines[i] + "'");
        } else {
          res.push(xmlLines[i]);
        }
      }
      return res.join('\n');
    } else {
      // No XML declaration: Line 1 starts with '
      const res: string[] = [];
      for (let i = 0; i < xmlLines.length; i++) {
        if (i === 0) {
          res.push("'\n" + xmlLines[i]);
        } else if (i === xmlLines.length - 1) {
          res.push(xmlLines[i] + "'");
        } else {
          res.push(xmlLines[i]);
        }
      }
      return res.join('\n');
    }
  });
}

/**
 * Formats SQL files containing embedded JSON string literals
 */
export function formatSqlWithEmbeddedJson(sqlText: string): string {
  if (!sqlText) return '';

  return sqlText.replace(/'(\s*[\{\[][\s\S]*?[\}\]]\s*)'/g, (match, jsonContent) => {
    const parsed = tryParseJson(jsonContent);
    if (!parsed) return match;
    try {
      const prettyJson = JSON.stringify(parsed, null, 2);
      return "'\n" + prettyJson + "'";
    } catch {
      return match;
    }
  });
}

/**
 * Main Intelligent Multi-Language Formatter Entrypoint
 * Formats XML, JSON, YAML, HTML, SQL with embedded XML/JSON into clean, structured, readable format.
 */
export function formatIntelligentContent(
  rawContent: string,
  filePath?: string
): IntelligentFormatResult {
  if (!rawContent || !rawContent.trim()) {
    return {
      formatted: rawContent || '',
      detectedLanguage: 'plaintext',
      description: 'Plain Text',
      wasFormatted: false,
    };
  }

  const { detectedLanguage, description } = detectIntelligentLanguage(rawContent, filePath);

  try {
    switch (detectedLanguage) {
      case 'sql-embedded-xml': {
        const formatted = formatSqlWithEmbeddedXml(rawContent);
        return {
          formatted,
          detectedLanguage,
          description,
          wasFormatted: formatted !== rawContent,
        };
      }

      case 'sql-embedded-json': {
        const formatted = formatSqlWithEmbeddedJson(rawContent);
        return {
          formatted,
          detectedLanguage,
          description,
          wasFormatted: formatted !== rawContent,
        };
      }

      case 'xml':
      case 'html': {
        const formatted = formatUnstructuredXml(rawContent);
        return {
          formatted,
          detectedLanguage,
          description,
          wasFormatted: formatted !== rawContent,
        };
      }

      case 'json': {
        const parsed = tryParseJson(rawContent);
        if (parsed !== null) {
          const formatted = JSON.stringify(parsed, null, 2);
          return {
            formatted,
            detectedLanguage,
            description,
            wasFormatted: formatted !== rawContent,
          };
        }
        break;
      }

      case 'yaml': {
        try {
          const parsed = YAML.parse(rawContent);
          if (parsed && typeof parsed === 'object') {
            const formatted = YAML.stringify(parsed, { indent: 2 });
            return {
              formatted: formatted.trimEnd(),
              detectedLanguage,
              description,
              wasFormatted: true,
            };
          }
        } catch {
          // Keep raw if unparseable
        }
        break;
      }

      default: {
        // Fallback: check if rawContent contains unformatted XML tags even without headers
        if (/<[a-zA-Z0-9_:\-.]+[\s\S]*?<\/[a-zA-Z0-9_:\-.]+>/.test(rawContent)) {
          const formatted = formatUnstructuredXml(rawContent);
          if (formatted !== rawContent) {
            return {
              formatted,
              detectedLanguage: 'xml',
              description: 'XML Document (Auto-Structured)',
              wasFormatted: true,
            };
          }
        }
        break;
      }
    }
  } catch {
    // If formatting fails for any reason, safely fall back to raw content
  }

  return {
    formatted: rawContent,
    detectedLanguage,
    description,
    wasFormatted: false,
  };
}
