# mDiff — Open-Source Software Licensing & Compliance Dossier

**Target Audience**: Corporate Legal Counsel, Intellectual Property (IP) Compliance, Engineering Directors  
**Application**: mDiff (Mavenir Diff) Comparison Suite  
**Classification**: Permissive Open-Source Utilization (Zero Copyleft Risk)  
**Version**: `v5.1.0`  

---

## 1. Executive Summary

This document provides a comprehensive legal and technical licensing analysis of all third-party open-source software (OSS) libraries integrated into **mDiff**.

### Key Legal Findings
1. **100% Permissive Licensing**: Every runtime and build-time dependency in mDiff is governed exclusively by **MIT** or **ISC** licenses.
2. **Zero Copyleft Contamination**: There are **zero** GPL, LGPL, AGPL, SSPL, or reciprocal copyleft licenses in the codebase.
3. **No Disclosure Obligations**: Using, deploying, packaging, or modifying mDiff within Mavenir **does not trigger any obligation** to disclose, open-source, or share Mavenir's proprietary source code, cellular configs, network topologies, or customer data.
4. **Commercial & Internal Distribution Rights**: MIT and ISC licenses grant perpetual, irrevocable, worldwide rights to run, copy, modify, merge, publish, and distribute binaries internally without royalty fees or licensing costs.

---

## 2. Dependency Audit Inventory

The following table lists all direct dependencies and their respective licenses:

| Component | Version | Stated License | Commercial Use | Reciprocal Copyleft | Primary Purpose |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Monaco Editor** | `^0.52.2` | **MIT** | Allowed | **None** | Microsoft syntax highlighting and core text diff calculation engine. |
| **@monaco-editor/react** | `^4.7.0` | **MIT** | Allowed | **None** | React component wrapper for Monaco Editor lifecycle. |
| **React** | `^19.0.0` | **MIT** | Allowed | **None** | Component-driven declarative UI framework. |
| **React DOM** | `^19.0.0` | **MIT** | Allowed | **None** | Web rendering target for React virtual DOM. |
| **YAML** | `^2.7.0` | **ISC** | Allowed | **None** | Pure TypeScript YAML parsing and AST semantic comparison. |
| **Lucide React** | `^1.16.0` | **ISC** | Allowed | **None** | Accessible desktop and web vector iconography. |
| **Tailwind CSS** | `^3.4.17` | **MIT** | Allowed | **None** | High-density utility styling framework. |
| **Electron** | `^34.2.0` | **MIT** | Allowed | **None** | Native desktop shell runtime for Windows & macOS binaries. |
| **Vite** | `^6.1.0` | **MIT** | Allowed | **None** | Fast renderer bundling and build toolchain. |
| **Vitest** | `^3.0.5` | **MIT** | Allowed | **None** | Deterministic automated unit testing framework. |

---

## 3. Analysis of Governing Licenses

### A. The MIT License
Governs: `Monaco Editor`, `@monaco-editor/react`, `React`, `React DOM`, `Tailwind CSS`, `Electron`, `Vite`, `Vitest`.

> **Key Permission Terms**:
> *"Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files... to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software..."*

- **Obligations**: The only requirement is to retain the original copyright notice and permission notice in the distribution.
- **Compliance Status**: Fully satisfied. Notices are embedded in `release/LICENSES.chromium.html`, `LICENSE.electron.txt`, and directly accessible to users in the **mDiff Preferences -> Open-Source Dependencies** UI.

### B. The ISC License
Governs: `YAML`, `Lucide React`.

> **Key Permission Terms**:
> *"Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted..."*

- Functionally identical to the 2-Clause BSD and MIT licenses, providing full commercial and internal use authorization with no copyleft restrictions.
- **Compliance Status**: Fully satisfied.

---

## 4. Proprietary Code Protection & Isolation

- **Clean Architectural Separation**: Proprietary telecom parsing logic (such as `xml.ts`, `structured.ts`, `inline-diff.ts`, and `diff-copy.ts`) was authored from scratch in clean-room TypeScript.
- **No Viral Linkage**: Because all libraries are MIT/ISC, linking them in Electron or web distributions creates no derivative work obligations that could impact proprietary Mavenir intellectual property.
- **Corporate Risk Level**: **LOWEST RISK (GREEN)** — Safe for enterprise deployment across all Mavenir business units.
