import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContextsPane from '../components/ContextsPane';
import { describe, it, vi, expect } from 'vitest';
vi.mock('../lib/fs', () => ({
  STORAGE_KEY: 'swimmer.contextTree.test',
  mockFs: {
    readTextFile: vi.fn().mockRejectedValue(new Error('not found')),
    writeTextFile: vi.fn(),
    createDir: vi.fn(),
  },
  saveConfig: vi.fn(),
}));

vi.mock('../../api', () => ({
  commands: {
    getKubeContexts: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-arborist', () => ({
  Tree: ({ children }: any) => (
    <div data-testid="mock-tree">
      {children({
        node: {
          id: 'folder-123',
          data: {
            id: 'folder-123',
            name: 'NewFolder',
            type: 'folder',
          },
          isOpen: true,
          edit: () => {},
          toggle: () => {},
        },
        style: {},
        dragHandle: null,
      })}
    </div>
  ),
}));

describe('ContextsPane UI', () => {
  it('New Folder ボタンを押すとフォルダが追加される', async () => {
    render(<ContextsPane />);

    const folderButton = await screen.findByTitle('New Folder');
    fireEvent.click(folderButton);

    await waitFor(() => {
      expect(screen.getByText('NewFolder')).toBeInTheDocument();
    });
  });
});
