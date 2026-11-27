import { describe, it, expect } from 'vitest';
import {
  detectIntelligentLanguage,
  formatIntelligentContent,
  formatSqlWithEmbeddedXml,
} from '../../src/shared/comparison-engine/intelligent-formatter.js';

describe('Intelligent Content Formatter & Language Understanding', () => {
  const sampleSqlXml =
    "REPLACE INTO 'normalization' VALUES (0,'APP_TYPE_SCSCF',0,'<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><TRN><ProfileName>TRN</ProfileName><Rules><Ruleset id=\"11\" name=\"modify_PAI_Towards_VMAS\"><Priority>11</Priority><TriggerPoint><ConditionTypeCNF>true</ConditionTypeCNF><SPT id=\"0\"><ConditionNegated>false</ConditionNegated><Group>0</Group></SPT></TriggerPoint></Ruleset></Rules></TRN>');";

  it('detects SQL with embedded XML correctly', () => {
    const detection = detectIntelligentLanguage(sampleSqlXml, 'Normalization_Changes_Remove_617_Completely.sql');
    expect(detection.detectedLanguage).toBe('sql-embedded-xml');
    expect(detection.description).toBe('SQL with Embedded XML');
  });

  it('formats SQL with embedded XML across indented lines matching Notepad++ XML Tools', () => {
    const res = formatIntelligentContent(sampleSqlXml, 'test.sql');
    expect(res.wasFormatted).toBe(true);
    expect(res.detectedLanguage).toBe('sql-embedded-xml');

    const lines = res.formatted.split('\n');
    // Line 1 contains SQL prefix and XML declaration
    expect(lines[0]).toBe("REPLACE INTO 'normalization' VALUES (0,'APP_TYPE_SCSCF',0,'<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
    // Line 2 starts root XML tag
    expect(lines[1]).toBe('<TRN>');
    // Child elements are indented with 2 spaces
    expect(lines[2]).toBe('  <ProfileName>TRN</ProfileName>');
    expect(lines[3]).toBe('  <Rules>');
    expect(lines[4]).toBe('    <Ruleset id="11" name="modify_PAI_Towards_VMAS">');
    // Closing tag has SQL suffix attached
    expect(lines[lines.length - 1]).toBe("</TRN>');");
  });

  it('handles multiple SQL statements in a single file', () => {
    const multiSql =
      "INSERT INTO t1 VALUES (1, '<config><name>Alpha</name></config>');\n" +
      "INSERT INTO t2 VALUES (2, '<config><name>Beta</name></config>');";
    const formatted = formatSqlWithEmbeddedXml(multiSql);
    expect(formatted).toContain('<name>Alpha</name>');
    expect(formatted).toContain('<name>Beta</name>');
    expect(formatted).toContain("</config>');");
  });

  it('detects and formats SQL with embedded JSON', () => {
    const sqlJson = "INSERT INTO sys_config VALUES (10, '{\"port\": 8080, \"debug\": true, \"hosts\": [\"a\", \"b\"]}');";
    const res = formatIntelligentContent(sqlJson, 'config.sql');
    expect(res.detectedLanguage).toBe('sql-embedded-json');
    expect(res.wasFormatted).toBe(true);
    expect(res.formatted).toContain('"port": 8080');
    expect(res.formatted).toContain("  \"debug\": true");
  });

  it('detects and formats standalone unformatted XML', () => {
    const rawXml = '<root><user id="42"><name>Alice</name><role>Admin</role></user></root>';
    const res = formatIntelligentContent(rawXml, 'users.xml');
    expect(res.detectedLanguage).toBe('xml');
    expect(res.wasFormatted).toBe(true);
    expect(res.formatted).toBe(
      '<root>\n  <user id="42">\n    <name>Alice</name>\n    <role>Admin</role>\n  </user>\n</root>'
    );
  });

  it('detects and formats standalone minified JSON', () => {
    const rawJson = '{"name":"mDiff","version":"8.0.0","active":true,"tags":["diff","xml"]}';
    const res = formatIntelligentContent(rawJson, 'app.json');
    expect(res.detectedLanguage).toBe('json');
    expect(res.wasFormatted).toBe(true);
    expect(res.formatted).toContain('  "name": "mDiff"');
    expect(res.formatted).toContain('  "version": "8.0.0"');
  });

  it('detects and formats YAML documents', () => {
    const rawYaml = 'server:\n  port: 8080\n  host: localhost\nlogging: true\n';
    const res = formatIntelligentContent(rawYaml, 'application.yaml');
    expect(res.detectedLanguage).toBe('yaml');
    expect(res.formatted).toContain('port: 8080');
  });

  it('detects HTML content', () => {
    const html = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
    const res = formatIntelligentContent(html, 'index.html');
    expect(res.detectedLanguage).toBe('html');
    expect(res.formatted).toContain('  <head>');
    expect(res.formatted).toContain('  <body>');
  });

  it('falls back safely on plain text without breaking', () => {
    const plain = 'Just some log message line 1\nJust some log message line 2';
    const res = formatIntelligentContent(plain, 'server.log');
    expect(res.detectedLanguage).toBe('plaintext');
    expect(res.wasFormatted).toBe(false);
    expect(res.formatted).toBe(plain);
  });
});
