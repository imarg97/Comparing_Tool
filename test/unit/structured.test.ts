import { describe, it, expect } from 'vitest';
import {
  cleanObject,
  compareStructuredData,
  diffObjects,
} from '../../src/shared/comparison-engine/structured.js';

describe('Structured Comparison Engine (YAML / JSON & Kubernetes)', () => {
  it('detects structural value changes in nested objects', () => {
    const left = { app: { port: 8080, name: 'api' } };
    const right = { app: { port: 9090, name: 'api' } };

    const diffs = diffObjects(left, right);
    expect(diffs.length).toBe(1);
    expect(diffs[0].keyPath).toBe('app.port');
    expect(diffs[0].status).toBe('modified');
  });

  it('filters Kubernetes noisy runtime fields when enabled', () => {
    const k8sManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'core',
        resourceVersion: '12345',
        uid: 'abc-123',
        creationTimestamp: '2026-01-01T00:00:00Z',
      },
      spec: { replicas: 3 },
      status: { availableReplicas: 3 },
    };

    const cleaned = cleanObject(k8sManifest, [], true) as any;
    expect(cleaned.metadata.name).toBe('core');
    expect(cleaned.spec.replicas).toBe(3);
    expect(cleaned.metadata.resourceVersion).toBeUndefined();
    expect(cleaned.metadata.uid).toBeUndefined();
    expect(cleaned.status).toBeUndefined();
  });

  it('correctly compares YAML documents and identifies semantic equivalence', () => {
    const yaml1 = `
metadata:
  name: telecom-service
  resourceVersion: "100"
spec:
  ports:
    - 80
`;

    const yaml2 = `
metadata:
  name: telecom-service
  resourceVersion: "999"
spec:
  ports:
    - 80
`;

    // Strict comparison should show difference in resourceVersion
    const strictRes = compareStructuredData({
      leftContent: yaml1,
      rightContent: yaml2,
      format: 'yaml',
      ignoreKeys: [],
      filterKubernetesNoise: false,
    });
    expect(strictRes.identical).toBe(false);
    expect(strictRes.items[0].keyPath).toBe('metadata.resourceVersion');

    // With Kubernetes filter, noisy resourceVersion is ignored -> semantically identical!
    const cleanRes = compareStructuredData({
      leftContent: yaml1,
      rightContent: yaml2,
      format: 'yaml',
      ignoreKeys: [],
      filterKubernetesNoise: true,
    });
    expect(cleanRes.identical).toBe(true);
    expect(cleanRes.items.length).toBe(0);
  });

  it('safely ignores __proto__ and prototype properties to prevent pollution', () => {
    const maliciousJson = JSON.parse('{"__proto__": {"polluted": true}, "app": "diffx"}');
    const cleaned = cleanObject(maliciousJson, [], false) as any;

    expect(cleaned.__proto__.polluted).toBeUndefined();
    expect((({} as any).polluted)).toBeUndefined();
    expect(cleaned.app).toBe('diffx');

    const diffs = diffObjects(maliciousJson, { app: 'diffx' });
    expect((({} as any).polluted)).toBeUndefined();
    expect(diffs.length).toBe(0);
  });
});
