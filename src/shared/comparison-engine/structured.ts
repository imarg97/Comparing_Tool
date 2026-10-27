/**
 * Comparison Engine — Structured Comparison (YAML / JSON & Kubernetes Manifests)
 */

import * as YAML from 'yaml';
import { StructuredDiffItem, StructuredDiffRequest, StructuredDiffResult } from '../types.js';
import { normalizeXml, objectToXml } from './xml.js';

export const KUBERNETES_NOISY_PATHS = [
  'metadata.resourceVersion',
  'metadata.uid',
  'metadata.generation',
  'metadata.creationTimestamp',
  'metadata.managedFields',
  'metadata.selfLink',
  'status',
];

export function cleanObject(
  obj: unknown,
  ignoreKeys: string[],
  filterK8s: boolean,
  currentPath: string = ''
): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      cleanObject(item, ignoreKeys, filterK8s, `${currentPath}[${index}]`)
    );
  }

  const record = obj as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    // Security: Protect against prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const fullPath = currentPath ? `${currentPath}.${key}` : key;

    // Check ignore list
    if (ignoreKeys.includes(key) || ignoreKeys.includes(fullPath)) {
      continue;
    }

    // Check Kubernetes noise
    if (filterK8s) {
      const isK8sNoise = KUBERNETES_NOISY_PATHS.some(
        (noisy) => fullPath === noisy || fullPath.startsWith(`${noisy}.`)
      );
      if (isK8sNoise) {
        continue;
      }
    }

    cleaned[key] = cleanObject(val, ignoreKeys, filterK8s, fullPath);
  }

  return cleaned;
}

export function diffObjects(
  left: unknown,
  right: unknown,
  currentPath: string = ''
): StructuredDiffItem[] {
  const diffs: StructuredDiffItem[] = [];

  // Base types comparison
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    if (left !== right) {
      diffs.push({
        keyPath: currentPath || 'root',
        status: left === undefined ? 'added' : right === undefined ? 'removed' : 'modified',
        leftValue: left,
        rightValue: right,
        message:
          left === undefined
            ? `Property added: ${formatValue(right)}`
            : right === undefined
            ? `Property removed: ${formatValue(left)}`
            : `Value changed from ${formatValue(left)} to ${formatValue(right)}`,
      });
    }
    return diffs;
  }

  // Arrays
  if (Array.isArray(left) && Array.isArray(right)) {
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${currentPath}[${i}]`;
      if (i >= left.length) {
        diffs.push({
          keyPath: itemPath,
          status: 'added',
          leftValue: undefined,
          rightValue: right[i],
          message: `Array element [${i}] added`,
        });
      } else if (i >= right.length) {
        diffs.push({
          keyPath: itemPath,
          status: 'removed',
          leftValue: left[i],
          rightValue: undefined,
          message: `Array element [${i}] removed`,
        });
      } else {
        diffs.push(...diffObjects(left[i], right[i], itemPath));
      }
    }
    return diffs;
  }

  // If one is array and other is object
  if (Array.isArray(left) !== Array.isArray(right)) {
    diffs.push({
      keyPath: currentPath || 'root',
      status: 'modified',
      leftValue: left,
      rightValue: right,
      message: 'Type changed between Array and Object',
    });
    return diffs;
  }

  // Key-value records
  const leftObj = left as Record<string, unknown>;
  const rightObj = right as Record<string, unknown>;
  const allKeys = Array.from(new Set([...Object.keys(leftObj), ...Object.keys(rightObj)])).sort();

  for (const key of allKeys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (!(key in leftObj)) {
      diffs.push({
        keyPath: nextPath,
        status: 'added',
        leftValue: undefined,
        rightValue: rightObj[key],
        message: `Field '${key}' added: ${formatValue(rightObj[key])}`,
      });
    } else if (!(key in rightObj)) {
      diffs.push({
        keyPath: nextPath,
        status: 'removed',
        leftValue: leftObj[key],
        rightValue: undefined,
        message: `Field '${key}' removed: ${formatValue(leftObj[key])}`,
      });
    } else {
      diffs.push(...diffObjects(leftObj[key], rightObj[key], nextPath));
    }
  }

  return diffs;
}

function formatValue(v: unknown): string {
  if (v === undefined) return '<undefined>';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function compareStructuredData(request: StructuredDiffRequest): StructuredDiffResult {
  let parsedLeft: unknown;
  let parsedRight: unknown;

  try {
    if (request.format === 'yaml') {
      parsedLeft = YAML.parse(request.leftContent);
      parsedRight = YAML.parse(request.rightContent);
    } else if (request.format === 'json') {
      parsedLeft = JSON.parse(request.leftContent);
      parsedRight = JSON.parse(request.rightContent);
    } else if (request.format === 'xml') {
      const normL = normalizeXml(request.leftContent);
      const normR = normalizeXml(request.rightContent);
      parsedLeft = normL.parsed;
      parsedRight = normR.parsed;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      identical: false,
      items: [],
      cleanLeft: request.leftContent,
      cleanRight: request.rightContent,
      parseError: `Failed to parse structured format (${request.format}): ${msg}`,
    };
  }

  // Clean objects with ignore rules
  const cleanL = cleanObject(parsedLeft, request.ignoreKeys, request.filterKubernetesNoise);
  const cleanR = cleanObject(parsedRight, request.ignoreKeys, request.filterKubernetesNoise);

  const diffItems = diffObjects(cleanL, cleanR, '');

  let cleanLeftFormatted = '';
  let cleanRightFormatted = '';

  if (request.format === 'yaml') {
    cleanLeftFormatted = YAML.stringify(cleanL, { indent: 2 });
    cleanRightFormatted = YAML.stringify(cleanR, { indent: 2 });
  } else if (request.format === 'json') {
    cleanLeftFormatted = JSON.stringify(cleanL, null, 2);
    cleanRightFormatted = JSON.stringify(cleanR, null, 2);
  } else if (request.format === 'xml') {
    // If parsedLeft is an object with a root key, use that tag
    const rootTagL = typeof cleanL === 'object' && cleanL !== null ? Object.keys(cleanL)[0] || 'root' : 'root';
    const rootTagR = typeof cleanR === 'object' && cleanR !== null ? Object.keys(cleanR)[0] || 'root' : 'root';
    const rootValL = typeof cleanL === 'object' && cleanL !== null ? (cleanL as Record<string, unknown>)[rootTagL] : cleanL;
    const rootValR = typeof cleanR === 'object' && cleanR !== null ? (cleanR as Record<string, unknown>)[rootTagR] : cleanR;

    cleanLeftFormatted = `<?xml version="1.0" encoding="UTF-8"?>\n${objectToXml(rootValL, rootTagL, 0)}`.trim();
    cleanRightFormatted = `<?xml version="1.0" encoding="UTF-8"?>\n${objectToXml(rootValR, rootTagR, 0)}`.trim();
  }

  return {
    identical: diffItems.length === 0,
    items: diffItems,
    cleanLeft: cleanLeftFormatted,
    cleanRight: cleanRightFormatted,
  };
}
