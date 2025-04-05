import { describe, it, expect } from 'vitest';
import { ContextNode, findParentFolderId, NodeType } from '../lib/contextTree';

describe('findParentFolderId', () => {
  // Create a test tree structure
  const setupTestTree = (): ContextNode[] => {
    // Root folder
    const rootFolder: ContextNode = {
      id: 'folder-root',
      name: 'Root',
      type: NodeType.Folder,
      children: [],
    };

    // Provider folder
    const gkeFolder: ContextNode = {
      id: 'folder-gke',
      name: 'GKE',
      type: NodeType.Folder,
      children: [],
      parent: rootFolder,
    };

    // Project folder
    const projectFolder: ContextNode = {
      id: 'folder-project1',
      name: 'project-1',
      type: NodeType.Folder,
      children: [],
      parent: gkeFolder,
    };

    // Region folders
    const usRegionFolder: ContextNode = {
      id: 'folder-region1',
      name: 'us-central1',
      type: NodeType.Folder,
      children: [],
      parent: projectFolder,
    };
    const jpRegionFolder: ContextNode = {
      id: 'folder-region2',
      name: 'jp-central1',
      type: NodeType.Folder,
      children: [],
      parent: projectFolder,
    };

    // Context nodes
    const cluster1ContextNode: ContextNode = {
      id: 'context-cluster1',
      name: 'cluster-1',
      type: NodeType.Context,
      path: 'gke_project1_us-central1_cluster1',
      parent: usRegionFolder,
    };
    const cluster2ContextNode: ContextNode = {
      id: 'context-cluster2',
      name: 'cluster-2',
      type: NodeType.Context,
      path: 'gke_project1_jp-central1_cluster2',
      parent: usRegionFolder,
    };

    // Build the tree structure
    usRegionFolder.children = [cluster1ContextNode, cluster2ContextNode];
    projectFolder.children = [usRegionFolder, jpRegionFolder];
    gkeFolder.children = [projectFolder];
    rootFolder.children = [gkeFolder];

    // Return the array of root level nodes
    return [rootFolder];
  };

  it('returns null when null is passed', () => {
    const tree = setupTestTree();
    expect(findParentFolderId(tree, null)).toBeNull();
  });

  it('returns null when non-existent node ID is passed', () => {
    const tree = setupTestTree();
    expect(findParentFolderId(tree, 'non-existent-id')).toBeNull();
  });

  it('returns null for root node parent', () => {
    const tree = setupTestTree();
    expect(findParentFolderId(tree, 'folder-root')).toBeNull();
  });

  it('correctly returns parent folder ID for context node', () => {
    const tree = setupTestTree();
    expect(findParentFolderId(tree, 'context-cluster1')).toBe('folder-region1');
  });

  it('correctly returns parent folder ID for intermediate folder', () => {
    const tree = setupTestTree();
    expect(findParentFolderId(tree, 'folder-project1')).toBe('folder-gke');
  });

  it('works correctly with multiple root nodes', () => {
    const tree = setupTestTree();

    // Add another root node
    const otherFolder: ContextNode = {
      id: 'folder-other',
      name: 'Other',
      type: NodeType.Folder,
      children: [],
    };

    const localContext: ContextNode = {
      id: 'context-local',
      name: 'local',
      type: NodeType.Context,
      path: 'local-context',
      parent: otherFolder,
    };

    otherFolder.children = [localContext];
    tree.push(otherFolder);

    expect(findParentFolderId(tree, 'context-local')).toBe('folder-other');
  });
});
