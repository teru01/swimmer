import { ClusterContext } from '../../lib/contextTree';

/**
 * Unique identifier for a ClusterOperationPanel
 */
export type ClusterOperationPanelId = string;

/**
 * ClusterContextTab represents a tab in ClusterOperationPanel
 * Contains ClusterContext and the panel ID it belongs to
 */
export interface ClusterContextTab {
  id: string; // Format: panelId-clusterContextId
  panelId: ClusterOperationPanelId;
  clusterContext: ClusterContext;
}

/**
 * ClusterOperationPanel contains tabs, resource sidebar, details, and terminal
 */
export interface ClusterOperationPanel {
  id: ClusterOperationPanelId;
  tabs: ClusterContextTab[];
  activeContextId: string | undefined;
}

/**
 * Creates a composite key for identifying resources within a specific panel
 */
export function createCompositeKey(panelId: ClusterOperationPanelId, contextId: string): string {
  return `${panelId}:${contextId}`;
}

/**
 * Parses a composite key into panel ID and context ID
 */
export function parseCompositeKey(compositeKey: string): {
  panelId: ClusterOperationPanelId;
  contextId: string;
} {
  const [panelId, contextId] = compositeKey.split(':');
  return { panelId, contextId };
}

/**
 * Generates a new unique ClusterOperationPanel ID
 */
export function generatePanelId(): ClusterOperationPanelId {
  return `panel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a new ClusterContextTab
 */
export function newClusterContextTab(
  panelId: ClusterOperationPanelId,
  clusterContext: ClusterContext
): ClusterContextTab {
  return {
    id: `${panelId}-${clusterContext.id}`,
    panelId,
    clusterContext,
  };
}
