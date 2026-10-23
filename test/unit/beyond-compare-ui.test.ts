import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/renderer/views/TextCompare/TextCompareView.js';
import { detectFormatFromPath } from '../../src/renderer/views/StructuredCompare/StructuredCompareView.js';

describe('Beyond Compare UI Utilities', () => {
  describe('detectLanguage', () => {
    it('detects XML files accurately', () => {
      expect(detectLanguage('site1.xml')).toBe('xml');
      expect(detectLanguage('/path/to/Snapshot-TEF_MEX_ASBC2_DRE_08102026_v1.xml')).toBe('xml');
    });

    it('detects YAML files accurately', () => {
      expect(detectLanguage('values.yaml')).toBe('yaml');
      expect(detectLanguage('deployment.yml')).toBe('yaml');
    });

    it('detects JSON, Python, and Shell files', () => {
      expect(detectLanguage('package.json')).toBe('json');
      expect(detectLanguage('script.py')).toBe('python');
      expect(detectLanguage('deploy.sh')).toBe('shell');
    });

    it('falls back to plaintext for unknown files', () => {
      expect(detectLanguage('notes.unknown')).toBe('plaintext');
      expect(detectLanguage('')).toBe('plaintext');
    });
  });

  describe('detectFormatFromPath', () => {
    it('detects XML format from path', () => {
      expect(detectFormatFromPath('site1.xml')).toBe('xml');
      expect(detectFormatFromPath('config.XML')).toBe('xml');
    });

    it('detects YAML format from path', () => {
      expect(detectFormatFromPath('values.yaml')).toBe('yaml');
      expect(detectFormatFromPath('chart.yml')).toBe('yaml');
    });

    it('detects JSON format from path', () => {
      expect(detectFormatFromPath('config.json')).toBe('json');
    });
  });
});
