/**
 * DiffX — Pure TypeScript XML Parser, Serializer, and Normalizer
 * Designed for offline, zero-dependency configuration file comparison (e.g., site1.xml vs site2.xml)
 */

export interface XmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: (XmlNode | string)[];
}

/**
 * Strips XML comments and declarations for semantic parsing
 */
function cleanXmlInput(xml: string): string {
  return xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .trim();
}

/**
 * Decodes standard XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Encodes standard XML entities
 */
function encodeXmlEntities(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parses XML attribute string: foo="bar" baz='123'
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = Object.create(null);
  const attrRegex = /([a-zA-Z0-9_:\-.]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1];
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const val = match[2] !== undefined ? match[2] : match[3];
    attrs[key] = decodeXmlEntities(val);
  }

  return attrs;
}

/**
 * Parses raw XML string into an AST
 */
export function parseXml(xml: string): XmlNode {
  const cleaned = cleanXmlInput(xml);
  if (!cleaned) {
    throw new Error('Empty XML document');
  }

  // Tokenize tags and text
  const tagRegex = /<(\/)?([a-zA-Z0-9_:\-.]+)([\s\S]*?)(\/?)>|([^<]+)/g;
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const [_, isClosing, tagName, attrString, isSelfClosing, textContent] = match;

    if (textContent !== undefined) {
      const trimmed = textContent.trim();
      if (trimmed && stack.length > 0) {
        stack[stack.length - 1].children.push(decodeXmlEntities(trimmed));
      }
      continue;
    }

    if (isClosing) {
      if (stack.length === 0) {
        throw new Error(`Unexpected closing tag: </${tagName}>`);
      }
      const top = stack.pop()!;
      if (top.tag !== tagName) {
        throw new Error(`Mismatched closing tag: expected </${top.tag}>, found </${tagName}>`);
      }
      continue;
    }

    // Opening or self-closing tag
    const attributes = attrString ? parseAttributes(attrString) : Object.create(null);
    const node: XmlNode = {
      tag: tagName,
      attributes,
      children: [],
    };

    if (stack.length === 0) {
      if (root) {
        // Multi-root handling: create synthetic container root
        root = {
          tag: 'root',
          attributes: {},
          children: [root, node],
        };
      } else {
        root = node;
      }
    } else {
      stack[stack.length - 1].children.push(node);
    }

    if (!isSelfClosing) {
      stack.push(node);
    }
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed XML tag: <${stack[stack.length - 1].tag}>`);
  }

  if (!root) {
    throw new Error('Invalid or unparseable XML structure');
  }

  return root;
}

/**
 * Converts XML AST node into a clean JavaScript object for semantic diffing
 */
export function xmlNodeToObject(node: XmlNode): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Sort and add attributes with @ prefix
  const sortedAttrKeys = Object.keys(node.attributes).sort();
  for (const key of sortedAttrKeys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    result[`@${key}`] = node.attributes[key];
  }

  // Collect child nodes and text
  const childMap = new Map<string, unknown[]>();
  const textPieces: string[] = [];

  for (const child of node.children) {
    if (typeof child === 'string') {
      textPieces.push(child);
    } else {
      if (child.tag === '__proto__' || child.tag === 'constructor' || child.tag === 'prototype') {
        continue;
      }
      const childObj = xmlNodeToObject(child);
      if (!childMap.has(child.tag)) {
        childMap.set(child.tag, []);
      }
      childMap.get(child.tag)!.push(childObj);
    }
  }

  if (textPieces.length > 0) {
    const combinedText = textPieces.join(' ').trim();
    if (Object.keys(result).length === 0 && childMap.size === 0) {
      // If it's a leaf node with only text, return the text directly
      return { '#text': combinedText };
    }
    result['#text'] = combinedText;
  }

  // Add child elements (single element as object, multiple as array)
  for (const [tag, elements] of childMap.entries()) {
    if (tag === '__proto__' || tag === 'constructor' || tag === 'prototype') {
      continue;
    }
    if (elements.length === 1) {
      result[tag] = elements[0];
    } else {
      result[tag] = elements;
    }
  }

  return result;
}

/**
 * Formats a clean JavaScript object back into standard formatted XML
 */
export function objectToXml(obj: unknown, rootTag: string = 'root', indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);

  if (obj === null || obj === undefined) {
    return `${indent}<${rootTag} />\n`;
  }

  if (typeof obj !== 'object') {
    return `${indent}<${rootTag}>${encodeXmlEntities(String(obj))}</${rootTag}>\n`;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => objectToXml(item, rootTag, indentLevel)).join('');
  }

  const record = obj as Record<string, unknown>;
  const attrs: string[] = [];
  const children: { key: string; val: unknown }[] = [];
  let textContent: string | null = null;

  for (const [key, val] of Object.entries(record)) {
    if (key.startsWith('@')) {
      attrs.push(`${key.slice(1)}="${encodeXmlEntities(String(val))}"`);
    } else if (key === '#text') {
      textContent = String(val);
    } else {
      children.push({ key, val });
    }
  }

  const attrStr = attrs.length > 0 ? ` ${attrs.sort().join(' ')}` : '';

  if (children.length === 0 && !textContent) {
    return `${indent}<${rootTag}${attrStr} />\n`;
  }

  if (children.length === 0 && textContent !== null) {
    return `${indent}<${rootTag}${attrStr}>${encodeXmlEntities(textContent)}</${rootTag}>\n`;
  }

  let xml = `${indent}<${rootTag}${attrStr}>\n`;

  if (textContent) {
    xml += `${indent}  ${encodeXmlEntities(textContent)}\n`;
  }

  for (const child of children) {
    if (Array.isArray(child.val)) {
      for (const item of child.val) {
        xml += objectToXml(item, child.key, indentLevel + 1);
      }
    } else {
      xml += objectToXml(child.val, child.key, indentLevel + 1);
    }
  }

  xml += `${indent}</${rootTag}>\n`;
  return xml;
}

/**
 * Normalizes and beautifies XML content with deterministic structure and sorting
 */
export function normalizeXml(xml: string): { parsed: Record<string, unknown>; formatted: string } {
  const ast = parseXml(xml);
  const obj = xmlNodeToObject(ast);
  const formatted = `<?xml version="1.0" encoding="UTF-8"?>\n${objectToXml(obj, ast.tag, 0)}`.trim();
  return {
    parsed: { [ast.tag]: obj },
    formatted,
  };
}

/**
 * Formats unstructured, minified, or continuous XML into structured, readable, indented XML.
 * Splits continuous tags onto clean separate lines with 2-space hierarchy indentation.
 * Intelligently preserves leaf elements with simple text content on single lines (e.g. <name>0</name>).
 * Handles unescaped ampersands, custom entities, and malformed tags gracefully without throwing.
 */
export function formatUnstructuredXml(rawXml: string): string {
  if (!rawXml || typeof rawXml !== 'string') return '';

  // 1. Separate XML declaration if present
  let text = rawXml.trim();
  let xmlDeclaration = '';
  const declMatch = text.match(/^\s*(<\?xml[\s\S]*?\?>)/i);
  if (declMatch) {
    xmlDeclaration = declMatch[1].trim();
    text = text.substring(declMatch[0].length).trim();
  }

  // 2. Tokenize tags and content (CDATA, comments, tags, or text between tags)
  const tokenRegex = /(<!\[CDATA\[[\s\S]*?\]\]>)|(<!--[\s\S]*?-->)|(<[\s\S]*?>)|([^<]+)/g;
  const rawTokens: { type: 'cdata' | 'comment' | 'tag' | 'text'; value: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(text)) !== null) {
    if (m[1]) {
      rawTokens.push({ type: 'cdata', value: m[1] });
    } else if (m[2]) {
      rawTokens.push({ type: 'comment', value: m[2] });
    } else if (m[3]) {
      rawTokens.push({ type: 'tag', value: m[3] });
    } else if (m[4]) {
      const trimmed = m[4].trim();
      if (trimmed) {
        rawTokens.push({ type: 'text', value: trimmed });
      }
    }
  }

  // 3. Format tokens into indented lines
  const lines: string[] = [];
  if (xmlDeclaration) {
    lines.push(xmlDeclaration);
  }

  let indentLevel = 0;
  const getIndent = (lvl: number) => '  '.repeat(Math.max(0, lvl));

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];

    if (token.type === 'cdata' || token.type === 'comment') {
      lines.push(`${getIndent(indentLevel)}${token.value}`);
      continue;
    }

    if (token.type === 'tag') {
      const val = token.value.trim();
      const isClosing = /^<\/[\s\S]*>$/.test(val);
      const isSelfClosing = /^<[\s\S]*\/>$/.test(val) || /^<![\s\S]*>$/.test(val);

      if (isClosing) {
        indentLevel = Math.max(0, indentLevel - 1);
        lines.push(`${getIndent(indentLevel)}${val}`);
        continue;
      }

      if (isSelfClosing) {
        lines.push(`${getIndent(indentLevel)}${val}`);
        continue;
      }

      // Check if this opening tag is immediately followed by a text token and the matching closing tag
      // e.g.: <name> followed by "0" followed by </name>
      const tagNameMatch = val.match(/^<([a-zA-Z0-9_:\-.]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : '';

      if (
        tagName &&
        i + 2 < rawTokens.length &&
        rawTokens[i + 1].type === 'text' &&
        rawTokens[i + 2].type === 'tag'
      ) {
        const nextClosing = rawTokens[i + 2].value.trim();
        const expectedClosing = `</${tagName}>`;
        if (nextClosing.toLowerCase() === expectedClosing.toLowerCase()) {
          // Compact inline element: <name>0</name>
          const inlineText = rawTokens[i + 1].value;
          lines.push(`${getIndent(indentLevel)}${val}${inlineText}${nextClosing}`);
          i += 2; // skip text and closing tag
          continue;
        }
      }

      // Opening tag with child nodes
      lines.push(`${getIndent(indentLevel)}${val}`);
      indentLevel++;
      continue;
    }

    if (token.type === 'text') {
      lines.push(`${getIndent(indentLevel)}${token.value}`);
    }
  }

  return lines.join('\n');
}
