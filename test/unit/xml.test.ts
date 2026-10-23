import { describe, it, expect } from 'vitest';
import { parseXml, normalizeXml } from '../../src/shared/comparison-engine/xml.js';
import { compareStructuredData } from '../../src/shared/comparison-engine/structured.js';

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
});
