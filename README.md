<p align="center">
  <img src="src/assets/swimmer_icon.png" alt="Swimmer" width="256" />
</p>

<h1 align="center">Swimmer</h1>

<p align="center">
  A user-friendly Kubernetes GUI client built for the multi-cluster era.
</p>

## Table of Contents

- [What is Swimmer?](#what-is-swimmer)
- [Why Swimmer?](#why-swimmer)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Project Structure](#project-structure)
- [License](#license)

## What is Swimmer?

Swimmer is a native desktop application for managing multiple Kubernetes clusters from a single window. It provides an intuitive hierarchical context tree, tabbed workspaces with split-panel layouts, a built-in resource browser covering 27+ resource types, and an integrated terminal — all powered by Tauri and Rust for fast, lightweight performance.

## Why Swimmer?

Modern infrastructure often spans many Kubernetes clusters across multiple cloud providers and regions. Swimmer is designed from the ground up for this reality: its hierarchical context tree, favorites, tags, and split-panel workspaces let you navigate and compare clusters as naturally as browsing folders in a file manager.

## Features

### Multi-Cluster Context Management

- **Hierarchical context tree** — Contexts are automatically organized by cloud provider:
  - **GKE**: Project > Region > Cluster
  - **EKS**: Account > Region > Cluster
  - **Others**: Docker Desktop, minikube, kind, and any custom context
- **Favorites** — Pin frequently used clusters for instant access
- **Tags** — Attach color-coded tags to contexts and filter by them
- **Search** — Find any context instantly across all providers

### Tabbed & Split-Panel Workspaces

- Open multiple cluster contexts as tabs within a panel
- Split panels side-by-side (up to 10) to compare resources across clusters
- Drag-to-resize panes throughout the UI
- Per-tab terminal sessions and view states

### Resource Browser

Browse and inspect 27+ built-in resource types organized by category:

| Category | Resources |
|---|---|
| Workloads | Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, HPAs |
| Network | Services, Endpoints, Ingresses, NetworkPolicies |
| Storage | PersistentVolumes, PersistentVolumeClaims, StorageClasses |
| Configuration | ConfigMaps, Secrets, LimitRanges, ResourceQuotas |
| RBAC | Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, ServiceAccounts |
| Cluster | Nodes, Namespaces, Events |
| Custom Resources | Dynamically discovered CRDs |

- Namespace filtering with autocomplete
- Real-time updates via Kubernetes watch API
- Detailed resource view with metadata, status, conditions, containers, and events
- Resource operations: delete resources, rollout restart deployments

### Cluster Overview

At-a-glance dashboard showing provider, region, cluster name, Kubernetes version, node readiness, pod status, and more. Auto-refreshes every 30 seconds.

### Integrated Terminal

- Full shell access (zsh, bash, fish, etc.) powered by a real PTY
- Each cluster tab gets its own independent terminal session
- Automatically configured with the selected cluster's kubeconfig context
- Customizable theme, font, and shell path via Preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Runtime | [Tauri 2](https://tauri.app/) |
| Frontend | React 18, TypeScript, Vite |
| Backend | Rust, [kube-rs](https://kube.rs/), tokio |
| Terminal | xterm.js, portable-pty |
| Layout | react-resizable-panels |

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- A valid `~/.kube/config` with one or more contexts

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Development

```bash
# Type-check
npx tsc --noEmit

# Lint
npm run lint

# Format
npm run format

# Test
npm run test
```

## Project Structure

```
src/                          # Frontend (React / TypeScript)
├── main/                     # Main layout, panel logic
├── cluster/components/       # Resource sidebar, list, detail, overview, terminal
├── kubeContexts/components/  # Context tree, modals
├── preferences/              # Settings page
├── lib/                      # Utilities, providers, tags, favorites
├── api/                      # Tauri command wrappers
└── contexts/                 # React context providers

src-tauri/src/                # Backend (Rust)
├── lib.rs                    # Tauri setup & command registration
├── k8s_api.rs                # Kubernetes API client & watch
└── terminal.rs               # PTY terminal session management
```

## License

MIT
