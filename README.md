<p align="center">
  <img src="src/assets/swimmer_icon.png" alt="Swimmer" width="256" />
</p>

<h1 align="center">Swimmer</h1>

<p align="center">
  A user-friendly Kubernetes GUI client built for the multi-cluster era.
</p>

<video src="https://github.com/user-attachments/assets/2948493f-1f50-4331-a5f7-9d2321358e83" autoplay loop muted playsinline width="100%"></video>

## Table of Contents

- [Table of Contents](#table-of-contents)
- [What is Swimmer?](#what-is-swimmer)
- [Why Swimmer?](#why-swimmer)
- [Features](#features)
  - [Multi-Cluster Context Management](#multi-cluster-context-management)
  - [Tabbed \& Split-Panel Workspaces](#tabbed--split-panel-workspaces)
  - [Resource Browser](#resource-browser)
  - [Cluster Overview](#cluster-overview)
  - [Integrated Terminal](#integrated-terminal)
- [Installation](#installation)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Project Structure](#project-structure)
- [License](#license)

## What is Swimmer?

Swimmer is a native desktop GUI for Kubernetes. From a single window you can:

- Browse and inspect 27+ resource types across any number of clusters
- Open multiple clusters side-by-side in tabbed, split-panel workspaces
- Organize contexts with a hierarchical tree, favorites, and color-coded tags
- Run kubectl and other commands in a built-in terminal scoped to each cluster
- View cluster dashboards with node health, pod status, and version info

Built with Tauri and Rust for fast startup, low memory usage, and native OS integration.

## Why Swimmer?

Modern infrastructure often spans dozens of Kubernetes clusters across multiple cloud providers and regions. Existing tools make you deal with them one at a time — switching contexts, losing your place, and repeating the same navigation for each cluster.

Swimmer treats multi-cluster as the default. Its context tree groups clusters by provider, region, and project so you can find the right cluster instantly. Favorites and tags let you bookmark the clusters you care about and filter out the rest. Split panels let you compare resources across clusters without switching windows. Each tab remembers its own terminal session and view state, so context-switching has zero overhead.

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

| Category         | Resources                                                                      |
| ---------------- | ------------------------------------------------------------------------------ |
| Workloads        | Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, HPAs |
| Network          | Services, Endpoints, Ingresses, NetworkPolicies                                |
| Storage          | PersistentVolumes, PersistentVolumeClaims, StorageClasses                      |
| Configuration    | ConfigMaps, Secrets, LimitRanges, ResourceQuotas                               |
| RBAC             | Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, ServiceAccounts        |
| Cluster          | Nodes, Namespaces, Events                                                      |
| Custom Resources | Dynamically discovered CRDs                                                    |

- Namespace filtering with autocomplete
- Real-time updates via Kubernetes watch API
- Detailed resource view with metadata, status, conditions, containers, and events
- Resource operations: delete resources, rollout restart deployments

### Cluster Overview

At-a-glance dashboard showing provider, region, cluster name, Kubernetes version, node readiness, pod status, and more.

### Integrated Terminal

- Full shell access (zsh, bash, fish, etc.) powered by a real PTY
- Each cluster tab gets its own independent terminal session
- Automatically configured with the selected cluster's kubeconfig context
- Customizable theme, font, and shell path via Preferences

## Installation

Download the latest release for your OS from the [Releases](https://github.com/teru01/swimmer/releases) page.

| OS | File |
|---|---|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows | `.msi` / `.exe` |
| Linux | `.deb` / `.AppImage` |

> **macOS users:** Since the app is not notarized, macOS may block it on first launch. Go to **System Settings > Privacy & Security**, scroll down and click **"Open Anyway"** to allow it.
>
> If you prefer to verify the source yourself, see [Getting Started](#getting-started) to build from source.

## Prerequisites

> The following are only needed if you want to build from source.

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
