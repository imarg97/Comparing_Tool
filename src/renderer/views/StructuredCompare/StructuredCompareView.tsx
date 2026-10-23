import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  Boxes,
  Play,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Filter,
  FileEdit,
} from 'lucide-react';
import {
  StructuredDiffItem,
  StructuredDiffRequest,
  StructuredDiffResult,
  StructuredFormat,
} from '@shared/types.js';
import { compareStructuredData } from '@shared/comparison-engine/structured.js';

interface StructuredCompareViewProps {
  theme?: 'dark' | 'light';
  onUpdateStatus: (text: string) => void;
}

export const StructuredCompareView: React.FC<StructuredCompareViewProps> = ({
  theme = 'dark',
  onUpdateStatus,
}) => {
  const [format, setFormat] = useState<StructuredFormat>('yaml');
  const [filterKubernetes, setFilterKubernetes] = useState(true);
  const [ignoreKeysInput, setIgnoreKeysInput] = useState('metadata.resourceVersion, metadata.uid, status');

  const [leftContent, setLeftContent] = useState<string>(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: telecom-core-gateway
  namespace: production
  resourceVersion: "1893420"
  uid: "7e92ab01-445a-4b62-9e0c-03ef4d193a02"
  creationTimestamp: "2026-08-12T04:20:00Z"
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
  template:
    spec:
      containers:
        - name: gateway
          image: registry.telecom.internal/core/gateway:v2.4.1
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
status:
  availableReplicas: 4
  readyReplicas: 4
`);

  const [rightContent, setRightContent] = useState<string>(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: telecom-core-gateway
  namespace: production
  resourceVersion: "1940124"
  uid: "8b12ca99-999a-4c12-8888-12aa9900bb11"
  creationTimestamp: "2026-09-01T08:15:30Z"
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
  template:
    spec:
      containers:
        - name: gateway
          image: registry.telecom.internal/core/gateway:v2.5.0
          resources:
            requests:
              cpu: 1000m
              memory: 2Gi
status:
  availableReplicas: 6
  readyReplicas: 6
`);

  const [result, setResult] = useState<StructuredDiffResult | null>(null);

  const handleRunStructuredCompare = () => {
    onUpdateStatus('Analyzing structured semantics...');
    const ignoreKeys = ignoreKeysInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const request: StructuredDiffRequest = {
      leftContent,
      rightContent,
      format,
      ignoreKeys,
      filterKubernetesNoise: filterKubernetes,
    };

    const res = compareStructuredData(request);
    setResult(res);
    onUpdateStatus(res.identical ? 'Structured entities are semantically identical' : `${res.items.length} semantic changes detected`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {/* 1. Configuration Toolbar */}
      <div className="bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 p-2 flex items-center justify-between flex-shrink-0 text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-medium">
            <Boxes className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Structured Mode:</span>
          </div>

          <div className="flex items-center bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded p-0.5">
            <button
              onClick={() => setFormat('yaml')}
              className={`px-2.5 py-0.5 rounded text-xs transition ${
                format === 'yaml'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              YAML
            </button>
            <button
              onClick={() => setFormat('json')}
              className={`px-2.5 py-0.5 rounded text-xs transition ${
                format === 'json'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              JSON
            </button>
          </div>

          {/* Kubernetes Preset toggle */}
          <label className="flex items-center space-x-2 cursor-pointer bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 px-2.5 py-1 rounded">
            <input
              type="checkbox"
              checked={filterKubernetes}
              onChange={(e) => setFilterKubernetes(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-blue-600 w-3.5 h-3.5"
            />
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Kubernetes / OpenShift Noise Filter</span>
            </span>
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (format === 'yaml') {
                setLeftContent('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  mode: development');
                setRightContent('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  mode: production');
              } else {
                setLeftContent(JSON.stringify({ name: "app", version: "1.0.0", port: 8080 }, null, 2));
                setRightContent(JSON.stringify({ name: "app", version: "1.1.0", port: 9090 }, null, 2));
              }
              setResult(null);
            }}
            title="Load Sample ConfigMap / JSON"
            className="flex items-center space-x-1 px-3 py-1 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs border border-neutral-300 dark:border-neutral-800 transition"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Load Sample</span>
          </button>

          <button
            onClick={handleRunStructuredCompare}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Analyze Semantic Differences</span>
          </button>
        </div>
      </div>

      {/* 2. Ignore Keys Bar */}
      <div className="bg-neutral-100/60 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 px-3 py-1 flex items-center space-x-2 text-xs flex-shrink-0">
        <Filter className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        <span className="text-neutral-500 dark:text-neutral-400 text-[11px] whitespace-nowrap">Ignored Object Keys:</span>
        <input
          type="text"
          value={ignoreKeysInput}
          onChange={(e) => setIgnoreKeysInput(e.target.value)}
          placeholder="metadata.resourceVersion, status, managedFields..."
          className="flex-1 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-2 py-0.5 font-mono text-[11px] focus:outline-none focus:border-blue-500 text-neutral-900 dark:text-neutral-100"
        />
      </div>

      {/* 3. Semantic Results Summary Table (if compared) */}
      {result && (
        <div className="bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 p-2.5 max-h-48 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {result.identical ? (
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Semantically Identical (All meaningful configuration properties match!)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-medium text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{result.items.length} Semantic Structural Differences Found:</span>
                </div>
              )}
            </div>
            {result.parseError && (
              <span className="text-rose-600 dark:text-rose-400 text-xs font-mono">{result.parseError}</span>
            )}
          </div>

          {result.items.length > 0 && (
            <div className="space-y-1">
              {result.items.map((item: StructuredDiffItem, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs font-mono bg-white dark:bg-black px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.status === 'added'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : item.status === 'removed'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{item.keyPath}</span>
                  </div>
                  <span className="text-neutral-500 text-[11px]">{item.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Side-by-Side Monaco Editor with Raw or Clean Data */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
        <DiffEditor
          height="100%"
          language={format}
          original={result ? result.cleanLeft : leftContent}
          modified={result ? result.cleanRight : rightContent}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            renderSideBySide: true,
            readOnly: false,
            originalEditable: true,
            fontSize: 12,
            fontFamily: "'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
};
