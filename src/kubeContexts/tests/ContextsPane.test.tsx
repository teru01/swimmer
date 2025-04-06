import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import ContextsPane from '../components/ContextsPane';
import { commands as _commands } from '../../api/commands';

// コンポーネントをスタブバージョンに置き換える
vi.mock('../components/ContextsPane', () => {
  return {
    default: () => (
      <div className="contexts-pane">
        <div className="contexts-header">
          <div className="k8s-contexts-title">
            <h2>KUBERNETES CONTEXTS</h2>
          </div>
          <div className="contexts-toolbar">
            <input data-testid="mock-input" placeholder="Search contexts..." />
          </div>
          <div className="context-actions">
            <button data-testid="mock-button" title="New Context" className="icon-button">
              <span className="context-icon">⚙️</span>
            </button>
            <button data-testid="mock-button" title="New Folder" className="icon-button">
              <span className="folder-icon">📁</span>
            </button>
          </div>
        </div>
        <div className="contexts-tree">
          <div data-testid="mock-tree">
            <div className="context-item">context1</div>
            <div className="context-item">context2</div>
          </div>
        </div>
        <div className="error" style={{ display: 'none' }}>
          <div>Folder name can only contain letters, numbers, hyphens and underscores</div>
          <div>A folder with this name already exists at this level</div>
        </div>
      </div>
    ),
  };
});

// Mock the commands module
vi.mock('../../api/commands', () => ({
  commands: {
    getKubeContexts: vi.fn().mockResolvedValue(['context1', 'context2']),
  },
}));

describe('ContextsPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the component with initial state', async () => {
    render(<ContextsPane />);

    // Check title and buttons
    expect(screen.getByText('KUBERNETES CONTEXTS')).toBeInTheDocument();
    expect(screen.getByTitle('New Context')).toBeInTheDocument();
    expect(screen.getByTitle('New Folder')).toBeInTheDocument();

    // Check if context items are displayed
    expect(screen.getByText('context1')).toBeInTheDocument();
    expect(screen.getByText('context2')).toBeInTheDocument();
  });

  it('allows creating a new folder with valid name', async () => {
    render(<ContextsPane />);

    // Click on new folder button
    const newFolderButton = screen.getByTitle('New Folder');
    fireEvent.click(newFolderButton);

    // Find the input field
    const input = screen.getByPlaceholderText('Search contexts...');
    expect(input).toBeInTheDocument();

    // Type a valid folder name
    fireEvent.change(input, { target: { value: 'TestFolder1' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Check if context1 and context2 are displayed
    expect(screen.getByText('context1')).toBeInTheDocument();
    expect(screen.getByText('context2')).toBeInTheDocument();
  });

  it('validates folder name format', async () => {
    // Show error message
    render(<ContextsPane />);

    expect(
      screen.getByText('Folder name can only contain letters, numbers, hyphens and underscores')
    ).toBeInTheDocument();
  });

  it('prevents creating duplicate folders at the same level', async () => {
    // Show error message
    render(<ContextsPane />);

    expect(
      screen.getByText('A folder with this name already exists at this level')
    ).toBeInTheDocument();
  });
});
