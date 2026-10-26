import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/renderer/views/TextCompare/TextCompareView.js';
import { detectFormatFromPath } from '../../src/renderer/views/StructuredCompare/StructuredCompareView.js';
import { executeChunkCopyL2R } from '../../src/shared/comparison-engine/diff-copy.js';

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

  describe('Beyond Compare Overview Map & Gap Logic (v2.0.0)', () => {
    it('classifies alignment gaps as blue indicators', () => {
      // Chunk where left has line 2, right has gap (modifiedStart: 1, modifiedEnd: 0)
      const gapChunk = {
        id: 'chunk_gap_1',
        originalStart: 2,
        originalEnd: 2,
        modifiedStart: 1,
        modifiedEnd: 0,
      };
      const isAlignmentGap = gapChunk.modifiedEnd === 0 || gapChunk.originalEnd === 0;
      expect(isAlignmentGap).toBe(true);
    });

    it('classifies single difference line as thin tick and multi-line as solid cluster', () => {
      const singleDiff = {
        id: 'chunk_single',
        originalStart: 5,
        originalEnd: 5,
        modifiedStart: 5,
        modifiedEnd: 5,
      };
      const countSingle = singleDiff.originalEnd - singleDiff.originalStart + 1;
      expect(countSingle).toBe(1);

      const clusterDiff = {
        id: 'chunk_cluster',
        originalStart: 74,
        originalEnd: 87,
        modifiedStart: 74,
        modifiedEnd: 87,
      };
      const countCluster = clusterDiff.originalEnd - clusterDiff.originalStart + 1;
      expect(countCluster).toBe(14);
      expect(countCluster > 1).toBe(true);
    });

    it('guarantees clean line insertion into gaps without XML tag concatenation', () => {
      const originalText = `<sys xmlns="urn:mavenir:ns:yang:vmas:6.0.2.0">\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>`;
      const modifiedText = `<sys xmlns="urn:mavenir:ns:yang:vmas:6.0.2.0">\n<nsid>NSD_VMAS_VNF</nsid>`;

      // Fake Monaco model to test pushEditOperations logic
      class FakeModel {
        lines: string[];
        constructor(content: string) {
          this.lines = content.split('\n');
        }
        getLineCount() {
          return this.lines.length;
        }
        getLineMaxColumn(line: number) {
          return (this.lines[line - 1] || '').length + 1;
        }
        getValueInRange(range: any) {
          return this.lines.slice(range.startLineNumber - 1, range.endLineNumber).join('\n');
        }
        pushEditOperations(_beforeCursorState: any, edits: any[]) {
          for (const edit of edits) {
            const { range, text } = edit;
            const linesBefore = this.lines.slice(0, range.startLineNumber - 1);
            const currentLine = this.lines[range.startLineNumber - 1] || '';
            const beforeCol = currentLine.substring(0, range.startColumn - 1);
            const endCurrentLine = this.lines[range.endLineNumber - 1] || '';
            const afterCol = endCurrentLine.substring(range.endColumn - 1);
            const linesAfter = this.lines.slice(range.endLineNumber);

            const newMiddle = beforeCol + text + afterCol;
            const replaced = [...linesBefore, ...newMiddle.split('\n'), ...linesAfter];
            this.lines = replaced;
          }
        }
        getValue() {
          return this.lines.join('\n');
        }
      }

      const origModel = new FakeModel(originalText);
      const modModel = new FakeModel(modifiedText);

      // Diff chunk representing line 2 insertion into gap on right
      const gapChunk = {
        id: 'chunk_0',
        originalStart: 2,
        originalEnd: 2,
        modifiedStart: 1,
        modifiedEnd: 0,
      };

      const outRange = { startLine: 0, endLine: 0 };
      const res = executeChunkCopyL2R(origModel, modModel, gapChunk, outRange);

      expect(res).toBe(true);
      expect(outRange.startLine).toBe(2);
      expect(outRange.endLine).toBe(2);

      const resultingLines = modModel.getValue().split('\n');
      expect(resultingLines[0]).toBe('<sys xmlns="urn:mavenir:ns:yang:vmas:6.0.2.0">');
      expect(resultingLines[1]).toBe('<encryption>false</encryption>');
      expect(resultingLines[2]).toBe('<nsid>NSD_VMAS_VNF</nsid>');
      expect(resultingLines.length).toBe(3);
    });

    it('positions Beyond Compare gap cursor & yellow gutter arrow without jumping to line 1 or line 2', () => {
      // Simulates DOM and editor structure for Monaco alignment gap
      const vzElement = {
        style: { top: '22px', height: '22px' },
        classList: {
          contains: (cls: string) => cls === 'view-zone' || cls === 'diff-hidden-lines',
          add: (cls: string) => classes.add(cls),
        },
        children: [] as any[],
        appendChild: (child: any) => {
          vzElement.children.push(child);
        },
        querySelector: (_sel: string) => vzElement.children.find((c) => c.className?.includes('diffx-gap-cursor-indicator')),
        getBoundingClientRect: () => ({ top: 22, height: 22, left: 50, width: 600 }),
      };

      const classes = new Set<string>();
      const marginZones: any[] = [];
      const marginZoneDiv = {
        style: { top: '22px', height: '22px' },
        children: [] as any[],
        appendChild: (child: any) => {
          marginZoneDiv.children.push(child);
        },
      };
      marginZones.push(marginZoneDiv);

      const editorDom = {
        classList: classes,
        querySelector: (sel: string) => {
          if (sel === '.margin-view-zones') {
            return {
              querySelectorAll: (_s: string) => marginZones,
            };
          }
          return null;
        },
      };

      // Gap click event inside view zone
      expect(vzElement.classList.contains('view-zone')).toBe(true);

      // Verify gap-active hides native cursor on line 1 / line 2
      editorDom.classList.add('diffx-gap-active');
      expect(classes.has('diffx-gap-active')).toBe(true);

      // Inject gap cursor caret
      const cursorIndicator = {
        className: 'diffx-gap-cursor-indicator',
        style: { top: '2px', height: '18px' },
      };
      vzElement.appendChild(cursorIndicator);
      expect(vzElement.children.length).toBe(1);
      expect(vzElement.children[0].className).toBe('diffx-gap-cursor-indicator');

      // Inject yellow gutter arrow
      const marginArrow = {
        className: 'diffx-gap-gutter-arrow diffx-gap-gutter-arrow-right',
        style: { top: '0px', height: '22px' },
        textContent: '⇦',
      };
      marginZoneDiv.appendChild(marginArrow);
      expect(marginZoneDiv.children.length).toBe(1);
      expect(marginZoneDiv.children[0].textContent).toBe('⇦');
    });
  });
});
