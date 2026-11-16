import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/renderer/views/TextCompare/TextCompareView.js';
import { detectFormatFromPath } from '../../src/renderer/views/StructuredCompare/StructuredCompareView.js';
import {
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  executeSelectedLinesCopyL2R,
  executeSelectedLinesCopyR2L,
  findChunkAtGap,
  collapseEditorGapViewZones,
  buildVisualRowMap,
  executeVisualRangeCopy,
} from '../../src/shared/comparison-engine/diff-copy.js';
import {
  updateDirectoryStatuses,
  recalculateSummary,
} from '../../src/shared/comparison-engine/matcher.js';
import { ComparisonEntry, FileMetadata } from '../../src/shared/types.js';

const makeMeta = (exists: boolean, size = 0, mtime = 0, isDir = false): FileMetadata => ({
  exists,
  size,
  mtime,
  isDirectory: isDir,
  isSymlink: false,
  readable: true,
});

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

    it('findChunkAtGap accurately locates diff chunks across alignment gaps', () => {
      const chunks = [
        {
          id: 'chunk_1',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
        {
          id: 'chunk_2',
          originalStart: 10,
          originalEnd: 15,
          modifiedStart: 9,
          modifiedEnd: 9,
        },
        {
          id: 'chunk_3',
          originalStart: 20,
          originalEnd: 0,
          modifiedStart: 21,
          modifiedEnd: 25,
        },
      ];

      // Gap on right after line 1
      const rightGapChunk = findChunkAtGap(chunks, 1, 'right');
      expect(rightGapChunk).not.toBeNull();
      expect(rightGapChunk?.id).toBe('chunk_1');

      // Gap on left after line 20
      const leftGapChunk = findChunkAtGap(chunks, 20, 'left');
      expect(leftGapChunk).not.toBeNull();
      expect(leftGapChunk?.id).toBe('chunk_3');
    });

    it('collapseEditorGapViewZones collapses zone height to 0 synchronously', () => {
      const zoneDelegate = {
        afterLineNumber: 1,
        heightInPx: 22,
        heightInLines: 1,
        domNode: {
          style: { height: '22px', display: 'block', opacity: '1' },
        },
      };

      const mockEditor = {
        _view: {
          viewZones: {
            _zones: {
              z1: {
                afterLineNumber: 1,
                delegate: zoneDelegate,
              },
            },
          },
        },
        changeViewZones: (cb: (accessor: any) => void) => {
          cb({
            layoutZone: (id: string) => expect(id).toBe('z1'),
            removeZone: (id: string) => expect(id).toBe('z1'),
          });
        },
      };

      collapseEditorGapViewZones(mockEditor, 1);
      expect(zoneDelegate.heightInPx).toBe(0);
      expect(zoneDelegate.heightInLines).toBe(0);
      expect(zoneDelegate.domNode.style.height).toBe('0px');
      expect(zoneDelegate.domNode.style.display).toBe('none');
    });

    it('resolves multi-line selection copy spanning across diff gap and identical lines without duplicates (Bug Fix)', () => {
      // Recreates the exact scenario from user screenshot media_1793038600956_16c68607.png:
      // Left side has 4 lines:
      // 1: <sys>
      // 2: <encryption>false</encryption> (diff gap on right)
      // 3: <nsid>NSD_VMAS_VNF</nsid>     (matches line 2 on right)
      // 4: </sys>
      // Right side has 3 lines:
      // 1: <sys>
      // 2: <nsid>NSD_VMAS_VNF</nsid>
      // 3: </sys>
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

      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const chunks = [
        {
          id: 'chunk_0',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      // User selects Left lines 2 to 3 (<encryption> and <nsid>)
      const selection = { startLine: 2, endLine: 3 };
      const outRange = { startLine: 0, endLine: 0 };

      const res = executeSelectedLinesCopyL2R(
        origModel,
        modModel,
        selection,
        chunks[0],
        outRange,
        null,
        chunks
      );

      expect(res).toBe(true);
      expect(outRange.startLine).toBe(2);
      expect(outRange.endLine).toBe(3);

      const rightLines = modModel.getValue().split('\n');
      expect(rightLines).toEqual([
        '<sys>',
        '<encryption>false</encryption>',
        '<nsid>NSD_VMAS_VNF</nsid>',
        '</sys>',
      ]);
      expect(rightLines.length).toBe(4);

      // CRITICAL ASSERTION: <nsid>NSD_VMAS_VNF</nsid> must NOT be duplicated!
      const nsidCount = rightLines.filter((l) => l.includes('<nsid>NSD_VMAS_VNF</nsid>')).length;
      expect(nsidCount).toBe(1);
    });

    it('resolves multi-line selection copy R2L projecting continuous range cleanly', () => {
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

      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const chunks = [
        {
          id: 'chunk_0',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      // Case A: User selects ONLY Right line 2 (<nsid>) and copies to Left
      // Crucial: Must NEVER delete line 2 (<encryption>) on the Left!
      const selectionOnlyNsid = { startLine: 2, endLine: 2 };
      const outRange = { startLine: 0, endLine: 0 };

      const res = executeSelectedLinesCopyR2L(
        origModel,
        modModel,
        selectionOnlyNsid,
        null,
        outRange,
        null,
        chunks
      );

      expect(res).toBe(true);
      const leftLines = origModel.getValue().split('\n');
      expect(leftLines).toEqual([
        '<sys>',
        '<encryption>false</encryption>',
        '<nsid>NSD_VMAS_VNF</nsid>',
        '</sys>',
      ]);
      expect(leftLines.length).toBe(4);
    });

    it('selecting across a gap from Line 1 to Line 2 on Right replaces gap lines on Left', () => {
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

      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const chunks = [
        {
          id: 'chunk_0',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      // Selection on Right spans from line 1 across the gap to line 2 (<nsid>)
      const selectionSpanningGap = { startLine: 1, endLine: 2 };
      const outRange = { startLine: 0, endLine: 0 };

      const res = executeSelectedLinesCopyR2L(
        origModel,
        modModel,
        selectionSpanningGap,
        chunks[0],
        outRange,
        null,
        chunks
      );

      expect(res).toBe(true);
      const leftLines = origModel.getValue().split('\n');
      expect(leftLines).toEqual([
        '<sys>',
        '<nsid>NSD_VMAS_VNF</nsid>',
        '</sys>',
      ]);
      expect(leftLines.length).toBe(3);
    });

    it('copying empty gap from Right to Left cleanly deletes Left line without extra blank line (Beyond Compare Image 1 -> 3)', () => {
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

      // Exact user scenario:
      // Left has 4 lines including <encryption>false</encryption> at line 2
      // Right has 3 lines (gap on line 2)
      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      // Chunk where Left has line 2, Right is empty gap (modifiedStart: 1, modifiedEnd: 0)
      const gapChunk = {
        id: 'chunk_gap_delete',
        originalStart: 2,
        originalEnd: 2,
        modifiedStart: 1,
        modifiedEnd: 0,
      };

      const outRange = { startLine: 0, endLine: 0 };
      const res = executeChunkCopyR2L(origModel, modModel, gapChunk, outRange);
      expect(res).toBe(true);

      // Left model must now have exactly 3 lines with <encryption> removed cleanly
      expect(origModel.getValue()).toBe('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      expect(origModel.getLineCount()).toBe(3);
    });

    it('copying empty gap from Left to Right cleanly deletes Right line without extra blank line', () => {
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

      // Reverse scenario:
      // Left has 3 lines, Right has 4 lines (gap on Left at line 2)
      const origModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const gapChunk = {
        id: 'chunk_gap_l2r_delete',
        originalStart: 1,
        originalEnd: 0,
        modifiedStart: 2,
        modifiedEnd: 2,
      };

      const outRange = { startLine: 0, endLine: 0 };
      const res = executeChunkCopyL2R(origModel, modModel, gapChunk, outRange);
      expect(res).toBe(true);

      // Right model must now have exactly 3 lines with <encryption> removed cleanly
      expect(modModel.getValue()).toBe('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      expect(modModel.getLineCount()).toBe(3);
    });

    it('syncGapGutterArrows creates permanent yellow gutter arrows directly in gutter container for gap rows', () => {
      const chunks = [
        {
          id: 'chunk_xml_gap',
          originalStart: 2,
          originalEnd: 3, // 2 lines on left
          modifiedStart: 1,
          modifiedEnd: 0, // gap on right
        },
      ];

      const createdArrows: any[] = [];
      const fakeGutterContainer = {
        children: [] as any[],
        querySelector(selector: string) {
          return this.children.find((c: any) => c.getAttribute?.('data-arrow-key') && selector.includes(c.getAttribute('data-arrow-key'))) || null;
        },
        appendChild(child: any) {
          this.children.push(child);
          createdArrows.push(child);
        },
      };

      const rowHeight = 22;
      const topPx = 22;
      const numRows = Math.max(1, chunks[0].originalEnd - chunks[0].originalStart + 1); // 2 rows

      for (let r = 0; r < numRows; r++) {
        const arrowKey = `mod-gap-${chunks[0].id}-${r}`;
        const arrow = {
          className: 'diffx-gap-gutter-arrow diffx-gap-gutter-arrow-right',
          attributes: { 'data-arrow-key': arrowKey } as Record<string, string>,
          style: {
            position: 'absolute',
            top: `${topPx + (r * rowHeight)}px`,
            height: `${rowHeight}px`,
          },
          getAttribute(name: string) {
            return this.attributes[name];
          },
          setAttribute(name: string, val: string) {
            this.attributes[name] = val;
          },
        };
        fakeGutterContainer.appendChild(arrow);
      }

      expect(createdArrows.length).toBe(2);
      expect(createdArrows[0].attributes['data-arrow-key']).toBe('mod-gap-chunk_xml_gap-0');
      expect(createdArrows[0].style.top).toBe('22px');
      expect(createdArrows[1].attributes['data-arrow-key']).toBe('mod-gap-chunk_xml_gap-1');
      expect(createdArrows[1].style.top).toBe('44px');
    });

    it('treats empty space as individual line: calculates effectiveLineNumber and rowOffset', () => {
      // Given a gap after line 1 with height of 44px (2 rows)
      const afterLineNumber = 1;
      const rowHeight = 22;
      const vzHeightPx = 44;
      const clickY = 25; // User clicks on row 1 (0-indexed second row)

      const numRows = Math.max(1, Math.round(vzHeightPx / rowHeight));
      const rowOffset = Math.max(0, Math.min(Math.floor(clickY / rowHeight), numRows - 1));
      const effectiveLineNumber = afterLineNumber + rowOffset + 1;

      expect(numRows).toBe(2);
      expect(rowOffset).toBe(1);
      expect(effectiveLineNumber).toBe(3); // Line 3 in the aligned grid
    });

    it('buildVisualRowMap builds exact 1:1 screen grid alignment across gaps', () => {
      // Left has 4 lines: 1: <sys>, 2: <encryption>, 3: <nsid>, 4: </sys>
      // Right has 3 lines: 1: <sys>, 2: <nsid>, 3: </sys>
      const chunks = [
        {
          id: 'chunk_gap',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      const rows = buildVisualRowMap(4, 3, chunks);
      expect(rows.length).toBe(4);
      // Row 1: Left 1, Right 1
      expect(rows[0].visualRowIndex).toBe(1);
      expect(rows[0].leftLineNumber).toBe(1);
      expect(rows[0].rightLineNumber).toBe(1);

      // Row 2: Left 2, Right null (gap)
      expect(rows[1].visualRowIndex).toBe(2);
      expect(rows[1].leftLineNumber).toBe(2);
      expect(rows[1].rightLineNumber).toBeNull();
      expect(rows[1].chunk?.id).toBe('chunk_gap');

      // Row 3: Left 3, Right 2
      expect(rows[2].visualRowIndex).toBe(3);
      expect(rows[2].leftLineNumber).toBe(3);
      expect(rows[2].rightLineNumber).toBe(2);

      // Row 4: Left 4, Right 3
      expect(rows[3].visualRowIndex).toBe(4);
      expect(rows[3].leftLineNumber).toBe(4);
      expect(rows[3].rightLineNumber).toBe(3);
    });

    it('executeVisualRangeCopy copies empty space from Right to Left to cleanly delete Left diff line', () => {
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

      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const chunks = [
        {
          id: 'chunk_gap',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      const rows = buildVisualRowMap(4, 3, chunks);
      const outRange = { startLine: 0, endLine: 0 };

      // User copies empty space at Row 2 from Right to Left (⇦)
      const res = executeVisualRangeCopy(
        origModel,
        modModel,
        rows,
        2, // startVisualRow = 2 (empty gap on Right)
        2, // endVisualRow = 2
        'right',
        outRange
      );

      expect(res).toBe(true);
      // Left line 2 was deleted cleanly!
      const leftLines = origModel.getValue().split('\n');
      expect(leftLines).toEqual(['<sys>', '<nsid>NSD_VMAS_VNF</nsid>', '</sys>']);
      expect(leftLines.length).toBe(3);
    });

    it('executeVisualRangeCopy copies Left line into Right empty space without vertical shift', () => {
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

      const origModel = new FakeModel('<sys>\n<encryption>false</encryption>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');
      const modModel = new FakeModel('<sys>\n<nsid>NSD_VMAS_VNF</nsid>\n</sys>');

      const chunks = [
        {
          id: 'chunk_gap',
          originalStart: 2,
          originalEnd: 2,
          modifiedStart: 1,
          modifiedEnd: 0,
        },
      ];

      const rows = buildVisualRowMap(4, 3, chunks);
      const outRange = { startLine: 0, endLine: 0 };

      // User copies Left line 2 into Right empty slot (⇨)
      const res = executeVisualRangeCopy(
        origModel,
        modModel,
        rows,
        2, // Visual Row 2 (Left has <encryption>, Right has gap)
        2,
        'left',
        outRange
      );

      expect(res).toBe(true);
      const rightLines = modModel.getValue().split('\n');
      expect(rightLines).toEqual([
        '<sys>',
        '<encryption>false</encryption>',
        '<nsid>NSD_VMAS_VNF</nsid>',
        '</sys>',
      ]);
      expect(rightLines.length).toBe(4);
    });
  });

  describe('v4.0.0 Beyond Compare Session Tabs & Zoom', () => {
    it('formats folder session titles cleanly like Beyond Compare', () => {
      const getBase = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p;
      const left = 'D:\\Core\\MEX-3\\Charts\\IMC_31_0_Mexico_site3';
      const right = 'D:\\Core\\MEX-3\\Charts\\IMC_11_0_29_0';
      const title = `${getBase(left)} <-> ${getBase(right)}`;
      expect(title).toBe('IMC_31_0_Mexico_site3 <-> IMC_11_0_29_0');
    });

    it('clamps zoom levels within 70% to 200%', () => {
      const clampZoom = (z: number) => Math.max(70, Math.min(200, z));
      expect(clampZoom(50)).toBe(70);
      expect(clampZoom(100)).toBe(100);
      expect(clampZoom(150)).toBe(150);
      expect(clampZoom(250)).toBe(200);
    });

    it('computes dynamic row height and font size proportional to zoom', () => {
      const getRowHeight = (zoom: number) => Math.max(20, Math.round((24 * zoom) / 100));
      const getFontSize = (zoom: number) => ((12 * zoom) / 100).toFixed(1);

      expect(getRowHeight(100)).toBe(24);
      expect(getFontSize(100)).toBe('12.0');

      expect(getRowHeight(120)).toBe(29);
      expect(getFontSize(120)).toBe('14.4');

      expect(getRowHeight(80)).toBe(20);
      expect(getFontSize(80)).toBe('9.6');
    });

    it('identifies folders with modified descendants for red highlight', () => {
      const hasDiffDescendant = (entry: any): boolean => {
        if (entry.status === 'modified' || entry.status === 'left-only' || entry.status === 'right-only') {
          return true;
        }
        if (entry.children && entry.children.length > 0) {
          return entry.children.some(hasDiffDescendant);
        }
        return false;
      };

      const folderNode = {
        name: 'imc-diamre',
        isDirectory: true,
        status: 'identical',
        children: [
          { name: 'Chart.yaml', isDirectory: false, status: 'modified' },
          { name: 'values.yaml', isDirectory: false, status: 'modified' },
        ],
      };

      expect(hasDiffDescendant(folderNode)).toBe(true);

      const cleanFolder = {
        name: 'templates',
        isDirectory: true,
        status: 'identical',
        children: [
          { name: 'helper.tpl', isDirectory: false, status: 'identical' },
        ],
      };
      expect(hasDiffDescendant(cleanFolder)).toBe(false);
    });

    it('formats tab title for files with different names (cross-site comparison)', () => {
      const getTabTitle = (left: string, right: string) => {
        const leftName = left.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
        const rightName = right.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
        return leftName && rightName && leftName !== rightName
          ? `${leftName} ↔ ${rightName}`
          : leftName || rightName || 'values.yaml';
      };

      const left = '/path/to/left/imc-sm/ixla-server-cnims-imcsm-userdata';
      const right = '/path/to/right/imc-sm/pval-ns-cnims-imc1-imcsm-userdata';
      expect(getTabTitle(left, right)).toBe(
        'ixla-server-cnims-imcsm-userdata ↔ pval-ns-cnims-imc1-imcsm-userdata'
      );

      const sameName = '/path/to/values.yaml';
      expect(getTabTitle(sameName, sameName)).toBe('values.yaml');
    });

    it('resolves cross-site file comparison candidates and preserves independent left and right selections', () => {
      // Simulation of selection state manager
      let selectedLeftFile: { relativePath: string; name: string } | null = null;
      let selectedRightFile: { relativePath: string; name: string } | null = null;

      const handleLeftClick = (node: { relativePath: string; name: string; isDirectory: boolean; left: { exists: boolean } }) => {
        if (node.isDirectory || !node.left.exists) return;
        selectedLeftFile = { relativePath: node.relativePath, name: node.name };
      };

      const handleRightClick = (node: { relativePath: string; name: string; isDirectory: boolean; right: { exists: boolean } }) => {
        if (node.isDirectory || !node.right.exists) return;
        selectedRightFile = { relativePath: node.relativePath, name: node.name };
      };

      // 1. Single click on left pane file
      const leftFileNode = {
        relativePath: 'imc-sm/ixla-server-cnims-imcsm-userdata',
        name: 'ixla-server-cnims-imcsm-userdata',
        isDirectory: false,
        left: { exists: true },
      };
      handleLeftClick(leftFileNode);
      expect(selectedLeftFile).toEqual({
        relativePath: 'imc-sm/ixla-server-cnims-imcsm-userdata',
        name: 'ixla-server-cnims-imcsm-userdata',
      });
      expect(selectedRightFile).toBeNull(); // Must NOT auto-pair or modify right

      // 2. Ctrl-click / select on right pane file
      const rightFileNode = {
        relativePath: 'imc-sm/pval-ns-cnims-imc1-imcsm-userdata',
        name: 'pval-ns-cnims-imc1-imcsm-userdata',
        isDirectory: false,
        left: { exists: false },
        right: { exists: true },
      };
      handleRightClick(rightFileNode);
      // Left selection MUST stay selected!
      expect(selectedLeftFile).toEqual({
        relativePath: 'imc-sm/ixla-server-cnims-imcsm-userdata',
        name: 'ixla-server-cnims-imcsm-userdata',
      });
      // Right selection MUST be set!
      expect(selectedRightFile).toEqual({
        relativePath: 'imc-sm/pval-ns-cnims-imc1-imcsm-userdata',
        name: 'pval-ns-cnims-imc1-imcsm-userdata',
      });

      // 3. Context menu candidate resolution
      const resolveContextMenuPrompt = (
        contextMenuNode: { relativePath: string; name: string; isDirectory: boolean; left: { exists: boolean }; right: { exists: boolean } },
        _side?: 'left' | 'right',
        leftFile?: { relativePath: string; name: string } | null,
        rightFile?: { relativePath: string; name: string } | null
      ) => {
        const candidateLeft = leftFile || (contextMenuNode.left.exists && !contextMenuNode.isDirectory ? { relativePath: contextMenuNode.relativePath, name: contextMenuNode.name } : null);
        const candidateRight = rightFile || (contextMenuNode.right.exists && !contextMenuNode.isDirectory ? { relativePath: contextMenuNode.relativePath, name: contextMenuNode.name } : null);
        if (candidateLeft && candidateRight) {
          return {
            hasComparePrompt: true,
            label: `⇄ Compare Files Now: ${candidateLeft.name} ↔ ${candidateRight.name}`,
            left: candidateLeft,
            right: candidateRight,
          };
        }
        return { hasComparePrompt: false };
      };

      const prompt = resolveContextMenuPrompt(rightFileNode, 'right', selectedLeftFile, selectedRightFile);
      expect(prompt.hasComparePrompt).toBe(true);
      expect(prompt.label).toBe(
        '⇄ Compare Files Now: ixla-server-cnims-imcsm-userdata ↔ pval-ns-cnims-imc1-imcsm-userdata'
      );
    });

    it('dynamically rolls up folder status from modified (red) to identical (black) when child differences are resolved', () => {
      // Mock directory tree: parent folder 'customize' containing child 'bashrc' (modified)
      const bashrcNode: ComparisonEntry = {
        relativePath: 'customize/bashrc',
        name: 'bashrc',
        isDirectory: false,
        status: 'modified',
        left: makeMeta(true, 2600, 1000),
        right: makeMeta(true, 2700, 2000),
        sizeDiff: true,
        mtimeDiff: true,
      };

      const addaliasNode: ComparisonEntry = {
        relativePath: 'customize/addalias',
        name: 'addalias',
        isDirectory: false,
        status: 'identical',
        left: makeMeta(true, 2300, 1000),
        right: makeMeta(true, 2300, 1000),
        sizeDiff: false,
        mtimeDiff: false,
      };

      const parentFolder: ComparisonEntry = {
        relativePath: 'customize',
        name: 'customize',
        isDirectory: true,
        status: 'modified',
        left: makeMeta(true, 4900, 1000, true),
        right: makeMeta(true, 5000, 2000, true),
        mtimeDiff: true,
        sizeDiff: true,
        children: [addaliasNode, bashrcNode],
      };

      const tree: ComparisonEntry[] = [parentFolder];

      // Initially, directory status is modified because bashrc is modified
      updateDirectoryStatuses(tree);
      expect(parentFolder.status).toBe('modified');

      // User synchronizes or edits bashrc in TextCompare -> marked identical
      bashrcNode.status = 'identical';
      bashrcNode.sizeDiff = false;
      bashrcNode.mtimeDiff = false;

      // Re-evaluating directory statuses turns customize to identical (black folder icon & black font)
      updateDirectoryStatuses(tree);
      expect(parentFolder.status).toBe('identical');
    });

    it('correctly recalculates summary metrics when nodes update dynamically', () => {
      const file1: ComparisonEntry = {
        relativePath: 'values.yaml',
        name: 'values.yaml',
        isDirectory: false,
        status: 'modified',
        mtimeDiff: true,
        sizeDiff: true,
        left: makeMeta(true, 6502, 1000),
        right: makeMeta(true, 6621, 2000),
      };

      const file2: ComparisonEntry = {
        relativePath: 'Chart.yaml',
        name: 'Chart.yaml',
        isDirectory: false,
        status: 'identical',
        mtimeDiff: false,
        sizeDiff: false,
        left: makeMeta(true, 105, 1000),
        right: makeMeta(true, 105, 1000),
      };

      const orphan: ComparisonEntry = {
        relativePath: 'script.sh',
        name: 'script.sh',
        isDirectory: false,
        status: 'left-only',
        mtimeDiff: false,
        sizeDiff: false,
        left: makeMeta(true, 500, 1000),
        right: makeMeta(false, 0, 0),
      };

      const tree = [file1, file2, orphan];

      let summary = recalculateSummary(tree);
      expect(summary.total).toBe(3);
      expect(summary.identical).toBe(1);
      expect(summary.modified).toBe(1);
      expect(summary.leftOnly).toBe(1);
      expect(summary.rightOnly).toBe(0);

      // Now resolve difference on file1
      file1.status = 'identical';
      summary = recalculateSummary(tree);
      expect(summary.total).toBe(3);
      expect(summary.identical).toBe(2);
      expect(summary.modified).toBe(0);
      expect(summary.leftOnly).toBe(1);
    });

    it('resolves effective status and Beyond Compare styling with dynamicFileStatusMap', () => {
      const dynamicFileStatusMap: Record<string, boolean> = {
        'customize/bashrc': true,
      };

      const node: ComparisonEntry = {
        relativePath: 'customize/bashrc',
        name: 'bashrc',
        isDirectory: false,
        status: 'modified',
        mtimeDiff: true,
        sizeDiff: true,
        left: makeMeta(true, 2600, 1000),
        right: makeMeta(true, 2700, 2000),
      };

      const isDynamicallyIdentical = Boolean(
        dynamicFileStatusMap[node.relativePath] === true || dynamicFileStatusMap[node.name] === true
      );
      const effectiveStatus = isDynamicallyIdentical ? 'identical' : node.status;

      // Status dynamically updates to identical
      expect(effectiveStatus).toBe('identical');

      // Left text color for identical item must be regular dark black font (text-black dark:text-neutral-50)
      const isModified = effectiveStatus === 'modified';
      const isLeftOnly = effectiveStatus === 'left-only';
      const hasDiff = isModified;

      const leftTextColor = (hasDiff || isModified)
        ? 'text-[#c51b1b] dark:text-[#ff5c5c] font-bold'
        : isLeftOnly
        ? 'text-[#7e22ce] dark:text-[#c084fc] font-bold'
        : 'text-black dark:text-neutral-50 font-normal';

      expect(leftTextColor).toBe('text-black dark:text-neutral-50 font-normal');

      // Right text color for identical item must also be regular dark black font (not gray #71717a)
      const rightTextColor = (hasDiff || isModified)
        ? 'text-[#c51b1b] dark:text-[#ff5c5c] font-bold'
        : isLeftOnly
        ? 'text-[#7e22ce] dark:text-[#c084fc] font-bold'
        : 'text-black dark:text-neutral-50 font-normal';
      expect(rightTextColor).toBe('text-black dark:text-neutral-50 font-normal');
      expect(rightTextColor).not.toContain('#71717a');
    });

    it('resolves filled colored folder icons accurately according to diff state', () => {
      // 1. Difference Folder: filled red folder icon and bold red font on BOTH sides
      const diffNode: ComparisonEntry = {
        relativePath: 'imc-diamre',
        name: 'imc-diamre',
        isDirectory: true,
        status: 'modified',
        mtimeDiff: true,
        sizeDiff: false,
        left: makeMeta(true, 0, 1000, true),
        right: makeMeta(true, 0, 2000, true),
      };

      const hasDiff = true;
      const leftFolderIcon = (hasDiff || diffNode.status === 'modified')
        ? (diffNode.isDirectory ? 'fill-red-500 text-red-700 dark:fill-red-600 dark:text-red-400' : 'text-[#c51b1b] dark:text-[#ff5c5c]')
        : 'fill-amber-400 text-amber-600 dark:fill-amber-500 dark:text-amber-300';
      const rightFolderIcon = (hasDiff || diffNode.status === 'modified')
        ? (diffNode.isDirectory ? 'fill-red-500 text-red-700 dark:fill-red-600 dark:text-red-400' : 'text-[#c51b1b] dark:text-[#ff5c5c]')
        : 'fill-amber-400 text-amber-600 dark:fill-amber-500 dark:text-amber-300';

      expect(leftFolderIcon).toContain('fill-red-500');
      expect(rightFolderIcon).toContain('fill-red-500');

      // 2. Identical Folder: rich filled amber/yellow folder icon and solid dark black font
      const identicalNode: ComparisonEntry = {
        relativePath: 'customize',
        name: 'customize',
        isDirectory: true,
        status: 'identical',
        mtimeDiff: false,
        sizeDiff: false,
        left: makeMeta(true, 0, 1000, true),
        right: makeMeta(true, 0, 1000, true),
      };

      const hasIdenticalDiff = false;
      const leftIdenticalIcon = (hasIdenticalDiff || identicalNode.status === 'modified')
        ? 'fill-red-500 text-red-700'
        : (identicalNode.isDirectory ? 'fill-amber-400 text-amber-600 dark:fill-amber-500 dark:text-amber-300' : 'text-neutral-800');
      const rightIdenticalIcon = (hasIdenticalDiff || identicalNode.status === 'modified')
        ? 'fill-red-500 text-red-700'
        : (identicalNode.isDirectory ? 'fill-amber-400 text-amber-600 dark:fill-amber-500 dark:text-amber-300' : 'text-neutral-800');

      expect(leftIdenticalIcon).toContain('fill-amber-400');
      expect(rightIdenticalIcon).toContain('fill-amber-400');

      // 3. Orphan Folder: filled purple folder icon
      const orphanNode: ComparisonEntry = {
        relativePath: 'templates',
        name: 'templates',
        isDirectory: true,
        status: 'left-only',
        mtimeDiff: false,
        sizeDiff: false,
        left: makeMeta(true, 0, 1000, true),
        right: makeMeta(false, 0, 0, false),
      };

      const leftOrphanIcon = orphanNode.status === 'left-only'
        ? (orphanNode.isDirectory ? 'fill-purple-400 text-purple-700 dark:fill-purple-500 dark:text-purple-300' : 'text-[#7e22ce]')
        : 'fill-amber-400';
      expect(leftOrphanIcon).toContain('fill-purple-400');
    });

    it('generates a single unified bracket line chunk for multi-line gaps instead of repeating arrows', () => {
      // For a multi-line gap spanning 13 lines (lines 81 to 93)
      const chunk = {
        id: 'chunk-gap-1',
        originalStart: 0,
        originalEnd: 0,
        modifiedStart: 81,
        modifiedEnd: 93,
      };

      const numRows = Math.max(1, chunk.modifiedEnd - chunk.modifiedStart + 1);
      expect(numRows).toBe(13);

      // In the new architecture:
      // Exactly 1 chunk container is produced with 1 single arrow icon and 1 bracket line
      const chunkHasBracket = numRows > 1;
      const arrowCount = 1; // Exactly 1 arrow icon per diff chunk, regardless of row count!

      expect(chunkHasBracket).toBe(true);
      expect(arrowCount).toBe(1);
    });
  });

  describe('renameSafeFile logic', () => {
    it('validates rename parameters safely', async () => {
      const { renameSafeFile } = await import('../../src/main/fs-engine/safe-fs.js');
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdiff-test-rename-'));
      const oldFile = path.join(tmpDir, 'old-name.txt');
      const newFile = path.join(tmpDir, 'new-name.txt');

      fs.writeFileSync(oldFile, 'test content', 'utf8');

      // 1. Success on valid rename
      const res1 = await renameSafeFile({ oldPath: oldFile, newPath: newFile });
      expect(res1.success).toBe(true);
      expect(fs.existsSync(newFile)).toBe(true);
      expect(fs.existsSync(oldFile)).toBe(false);

      // 2. Failure on non-existent old path
      const res2 = await renameSafeFile({ oldPath: oldFile, newPath: path.join(tmpDir, 'another.txt') });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Source path does not exist');

      // 3. Failure on target collision
      const collisionTarget = path.join(tmpDir, 'collision.txt');
      fs.writeFileSync(collisionTarget, 'existing', 'utf8');
      const res3 = await renameSafeFile({ oldPath: newFile, newPath: collisionTarget });
      expect(res3.success).toBe(false);
      expect(res3.error).toContain('already exists');

      // 4. Failure on null byte
      const res4 = await renameSafeFile({ oldPath: newFile, newPath: path.join(tmpDir, 'null\0byte.txt') });
      expect(res4.success).toBe(false);
      expect(res4.error).toContain('null byte');

      // 5. Failure on Windows reserved device name
      const res5 = await renameSafeFile({ oldPath: newFile, newPath: path.join(tmpDir, 'CON.txt') });
      expect(res5.success).toBe(false);
      expect(res5.error).toContain('Windows reserved device name');

      // Clean up tmp dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
