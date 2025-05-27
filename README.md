# Swimmer - Kubernetes Client

A modern, user-friendly Kubernetes client built with Tauri, React, and TypeScript.

## Features

### 🎯 Cluster Information Management

- **Resource Explorer**: Browse Kubernetes resources organized by categories (Workloads, Network, Storage, etc.)
- **Interactive Sidebar**: Expandable resource groups with icons for easy navigation
- **Resource List View**: Table-based display with namespace filtering and search capabilities
- **Detailed Resource View**: Comprehensive resource details with structured information display

### 🖥️ Terminal Integration

- **Real Terminal**: Integrated xterm.js terminal with actual shell functionality
- **Context Awareness**: Terminal automatically reflects the selected Kubernetes context
- **Command Execution**: Run kubectl commands and other CLI tools directly

### 🗂️ Context Management

- **Hierarchical Organization**: Organize contexts in folders for better management
- **Drag & Drop**: Reorder contexts and folders with intuitive drag-and-drop
- **Tagging System**: Add tags to contexts for easy filtering and organization
- **Search & Filter**: Quickly find contexts with text search and tag filters

### 🎨 Modern UI/UX

- **Responsive Design**: Clean, modern interface that adapts to different screen sizes
- **Dark Theme Support**: Eye-friendly dark theme with consistent color scheme
- **Smooth Animations**: Subtle animations and transitions for better user experience
- **Accessibility**: Keyboard navigation and screen reader support

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Backend**: Rust (Tauri)
- **Terminal**: xterm.js with real PTY support
- **UI Components**: Custom components with modern CSS
- **Layout**: react-resizable-panels for flexible layouts
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+
- kubectl (for Kubernetes functionality)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/swimmer.git
cd swimmer
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. In another terminal, start the Tauri app:

```bash
npm run tauri dev
```

### Building for Production

```bash
npm run build
npm run tauri build
```

## Project Structure

```
src/
├── cluster/                 # Cluster information components
│   ├── components/         # React components for cluster view
│   │   ├── ClusterInfoPane.tsx
│   │   ├── ResourceKindSidebar.tsx
│   │   ├── ResourceList.tsx
│   │   ├── ResourceDetailPane.tsx
│   │   └── TerminalPane.tsx
│   └── styles/            # Component-specific styles
├── kubeContexts/          # Context management
├── main/                  # Main layout and UI components
├── lib/                   # Utility functions and types
└── styles/               # Global styles

src-tauri/
├── src/
│   ├── lib.rs            # Main Tauri backend
│   └── main.rs           # Entry point
└── Cargo.toml           # Rust dependencies
```

## Key Improvements Made

### 1. Enhanced Terminal

- Replaced mock terminal with real xterm.js implementation
- Added PTY support for actual shell execution
- Improved terminal styling and user experience

### 2. Modern UI Design

- Implemented consistent design system with CSS variables
- Added loading states, error handling, and empty states
- Improved accessibility and keyboard navigation
- Added smooth animations and hover effects

### 3. Better Resource Management

- Organized resources by API groups (Workloads, Network, etc.)
- Added namespace filtering for namespaced resources
- Implemented proper loading and error states
- Enhanced resource detail view with structured information

### 4. Code Quality

- Fixed TypeScript errors and improved type safety
- Removed unused code and imports
- Added proper error handling throughout the application
- Implemented consistent coding patterns

### 5. User Experience

- Added intuitive icons for different resource types
- Implemented responsive design for different screen sizes
- Added helpful empty states and loading indicators
- Improved navigation with breadcrumbs and clear hierarchy

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run format
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) for the excellent desktop app framework
- [xterm.js](https://xtermjs.org/) for terminal emulation
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) for layout management
- [react-arborist](https://github.com/brimdata/react-arborist) for tree view functionality
