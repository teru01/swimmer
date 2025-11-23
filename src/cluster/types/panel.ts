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

/**
 * Creates a default empty ClusterOperationPanel
 */
export function createDefaultPanel(): ClusterOperationPanel {
  return {
    id: generatePanelId(),
    tabs: [],
    activeContextId: undefined,
  };
}
