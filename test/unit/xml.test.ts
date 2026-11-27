import { describe, it, expect } from 'vitest';
import { parseXml, normalizeXml, formatUnstructuredXml } from '../../src/shared/comparison-engine/xml.js';
import { compareStructuredData, detectFormatFromContent } from '../../src/shared/comparison-engine/structured.js';

describe('XML Comparison Engine', () => {
  it('parses valid XML structure into AST', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <!-- Telecom config -->
      <SiteConfiguration id="site-101" region="us-east">
        <Cell tower="alpha" freq="2100MHz">
          <Power max="40W" default="20W" />
        </Cell>
        <Network gateway="10.0.0.1" />
      </SiteConfiguration>
    `;

    const ast = parseXml(xml);
    expect(ast.tag).toBe('SiteConfiguration');
    expect(ast.attributes.id).toBe('site-101');
    expect(ast.attributes.region).toBe('us-east');
    expect(ast.children.length).toBe(2);
  });

  it('normalizes and beautifies XML deterministically', () => {
    const xml1 = `<Site   region="us-east"   id="site-101" ><Cell   freq="2100MHz"  tower="alpha" /></Site>`;
    const { formatted } = normalizeXml(xml1);

    expect(formatted).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(formatted).toContain('<Site id="site-101" region="us-east">');
    expect(formatted).toContain('<Cell freq="2100MHz" tower="alpha" />');
  });

  it('compares site1.xml and site2.xml and detects precise attribute differences', () => {
    const site1 = `<?xml version="1.0" encoding="UTF-8"?>
<SiteConfiguration id="site-101">
  <Cell tower="alpha" frequency="2100MHz">
    <Power max="40W" default="20W" />
    <Antenna azimuth="120" tilt="4" />
  </Cell>
  <Network gateway="10.0.0.1" subnet="255.255.255.0" />
</SiteConfiguration>`;

    const site2 = `<?xml version="1.0" encoding="UTF-8"?>
<SiteConfiguration id="site-101">
  <Cell tower="alpha" frequency="2600MHz">
    <Power max="50W" default="20W" />
    <Antenna azimuth="180" tilt="4" />
  </Cell>
  <Network gateway="10.0.0.2" subnet="255.255.255.0" />
</SiteConfiguration>`;

    const result = compareStructuredData({
      leftContent: site1,
      rightContent: site2,
      format: 'xml',
      ignoreKeys: [],
      filterKubernetesNoise: false,
    });

    expect(result.identical).toBe(false);
    expect(result.items.length).toBeGreaterThan(0);

    // Should detect frequency change (2100MHz -> 2600MHz)
    const freqDiff = result.items.find((item) => item.keyPath.includes('frequency'));
    expect(freqDiff).toBeDefined();
    expect(freqDiff?.leftValue).toBe('2100MHz');
    expect(freqDiff?.rightValue).toBe('2600MHz');

    // Should detect power max change (40W -> 50W)
    const powerDiff = result.items.find((item) => item.keyPath.includes('max'));
    expect(powerDiff).toBeDefined();
    expect(powerDiff?.leftValue).toBe('40W');
    expect(powerDiff?.rightValue).toBe('50W');

    // Should detect gateway change (10.0.0.1 -> 10.0.0.2)
    const gwDiff = result.items.find((item) => item.keyPath.includes('gateway'));
    expect(gwDiff).toBeDefined();
    expect(gwDiff?.leftValue).toBe('10.0.0.1');
    expect(gwDiff?.rightValue).toBe('10.0.0.2');
  });

  it('detects identical XML files with different whitespace/formatting', () => {
    const xmlA = `<Site id="site-1"><Cell freq="2100"/></Site>`;
    const xmlB = `
      <Site id="site-1">
        <Cell freq="2100" />
      </Site>
    `;

    const result = compareStructuredData({
      leftContent: xmlA,
      rightContent: xmlB,
      format: 'xml',
      ignoreKeys: [],
      filterKubernetesNoise: false,
    });

    expect(result.identical).toBe(true);
    expect(result.items.length).toBe(0);
  });

  it('safely discards prototype-polluting XML tags and attributes', () => {
    const maliciousXml = `<root __proto__="polluted"><__proto__ test="123">Content</__proto__><safe>OK</safe></root>`;
    const ast = parseXml(maliciousXml);
    const { parsed } = normalizeXml(maliciousXml);

    expect(ast.attributes.__proto__).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(ast.attributes, '__proto__')).toBe(false);
    expect((({} as any).polluted)).toBeUndefined();
    expect(parsed.root).toBeDefined();
    expect((({} as any).test)).toBeUndefined();
  });

  it('formats continuous unstructured XML with 2-space indentation and compact leaf nodes', () => {
    const raw = `<?xml version="1.0"?><sys xmlns="urn:mavenir"><appcommon><AppSelector><name>0</name><eCurrentApp>APP_TYPE_SIP_ROUTER</eCurrentApp></AppSelector></appcommon></sys>`;
    const formatted = formatUnstructuredXml(raw);

    expect(formatted).toContain('<?xml version="1.0"?>');
    expect(formatted).toContain('<sys xmlns="urn:mavenir">');
    expect(formatted).toContain('  <appcommon>');
    expect(formatted).toContain('    <AppSelector>');
    expect(formatted).toContain('      <name>0</name>');
    expect(formatted).toContain('      <eCurrentApp>APP_TYPE_SIP_ROUTER</eCurrentApp>');
    expect(formatted).toContain('    </AppSelector>');
    expect(formatted).toContain('  </appcommon>');
    expect(formatted).toContain('</sys>');
  });

  it('handles unescaped ampersands and custom CMS symbols resiliently without crashing', () => {
    const cmsRaw = `<?xml version="1.0"?><data>&lt;CLDPN_DIGITS&gt;^3321299901$&lt;/CLDPN_DIGITS&gt;<item attr="val & more">test & demo</item></data>`;
    const formatted = formatUnstructuredXml(cmsRaw);

    expect(formatted).toContain('<data>');
    expect(formatted).toContain('&lt;CLDPN_DIGITS&gt;^3321299901$&lt;/CLDPN_DIGITS&gt;');
    expect(formatted).toContain('<item attr="val & more">');
    expect(formatted).toContain('</data>');
  });

  it('detectFormatFromContent accurately detects XML on snapshot files without extension', () => {
    const xmlSnapshot = `<?xml version="1.0"?>\n<sys xmlns="urn:mavenir:ns:yang:vmas:6.0.2.0"><appcommon></appcommon></sys>`;
    const detected = detectFormatFromContent(xmlSnapshot, 'Snapshot-Merged_Snapshot-H2S_AZ1_VMAS_R_6_0_2_4_v26_17Nov_Tia');
    expect(detected).toBe('xml');
  });
});
