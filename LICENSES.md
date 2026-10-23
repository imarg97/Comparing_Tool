# DiffX Third-Party Dependency & License Inventory

All direct and transitive dependencies used by DiffX are under permissive, enterprise-compliant open-source licenses (MIT, ISC, Apache-2.0, BSD-3-Clause). No copyleft or proprietary licenses are incorporated.

## Production Dependencies

| Package | Version | License | Primary Purpose | Repository / Source |
| :--- | :--- | :--- | :--- | :--- |
| **@monaco-editor/react** | ^4.7.0 | MIT | React wrapper for Microsoft Monaco Diff Editor | [GitHub](https://github.com/suren-atoyan/monaco-react) |
| **monaco-editor** | ^0.52.2 | MIT | Industry-standard syntax highlighting & diff view | [GitHub](https://github.com/microsoft/monaco-editor) |
| **react** | ^19.0.0 | MIT | Component architecture & reactive UI rendering | [GitHub](https://github.com/facebook/react) |
| **react-dom** | ^19.0.0 | MIT | DOM mounting for React components | [GitHub](https://github.com/facebook/react) |
| **lucide-react** | ^1.16.0 | ISC | High-legibility UI iconography | [GitHub](https://github.com/lucide-icons/lucide) |
| **yaml** | ^2.7.0 | ISC | YAML parsing, serialization, and AST comparison | [GitHub](https://github.com/eemeli/yaml) |

## Development & Build Tooling

| Package | Version | License | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **electron** | ^34.2.0 | MIT | Cross-platform desktop runtime (macOS / Windows) |
| **electron-builder** | ^25.1.8 | MIT | Standalone application packaging & distribution |
| **vite** | ^6.1.0 | MIT | Next-generation frontend bundler & HMR server |
| **@vitejs/plugin-react** | ^4.3.4 | MIT | Vite plugin for React JSX / Fast Refresh |
| **typescript** | ^5.7.3 | Apache-2.0 | Static typing & strict compile-time checks |
| **tailwindcss** | ^3.4.17 | MIT | High-density styling & design tokens |
| **postcss** | ^8.5.2 | MIT | CSS transformations & processing |
| **autoprefixer** | ^10.4.20 | MIT | Cross-browser CSS prefix injection |
| **vitest** | ^3.0.5 | MIT | Fast, deterministic unit testing framework |
| **@types/node** | ^22.13.4 | MIT | TypeScript type declarations for Node.js runtime |
| **@types/react** | ^19.0.10 | MIT | TypeScript type definitions for React |
| **@types/react-dom** | ^19.0.4 | MIT | TypeScript type definitions for ReactDOM |

## License Compliance Policy

1. **Local-First & Offline**: DiffX does not make outbound network connections to any licensing server or telemetry endpoint.
2. **Commercial & Internal Use**: All dependencies permit commercial, internal, and open distribution without royalty requirements.
3. **Attribution Preservation**: All copyright notices of original authors are preserved in third-party bundle metadata.
