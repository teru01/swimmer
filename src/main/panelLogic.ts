import { ContextNode, NodeType, newClusterContextNode } from '../lib/contextTree';
import {
  ClusterOperationPanel,
  ClusterContextTab,
  newClusterContextTab,
  createDefaultPanel,
  generatePanelId,
} from '../cluster/types/panel';

export interface PanelState {
  panels: ClusterOperationPanel[];
  activePanelId: string;
  selectedContext: ContextNode | undefined;
}

export interface SplitRightResult {
  state: PanelState;
  newTab: ClusterContextTab;
  newPanelId: string;
}

/**
 * ContextNodeを選択した時の状態更新ロジック
 */
export function handleContextNodeSelect(state: PanelState, contextNode: ContextNode): PanelState {
  if (contextNode.type !== NodeType.Context || !contextNode.clusterContext) {
    return {
      ...state,
      selectedContext: contextNode,
    };
  }

  const contextId = contextNode.clusterContext.id;

  // Find if this context is already open in any panel
  let existingTab: ClusterContextTab | undefined;
  let existingPanelId: string | undefined;

  for (const panel of state.panels) {
    const tab = panel.tabs.find(t => t.clusterContext.id === contextId);
    if (tab) {
      // Found in active panel - use it directly
      if (panel.id === state.activePanelId) {
        existingTab = tab;
        existingPanelId = panel.id;
        break;
      }
      // Found in non-active panel - remember the leftmost one
      if (!existingTab) {
        existingTab = tab;
        existingPanelId = panel.id;
      }
    }
  }

  if (existingTab && existingPanelId) {
    // Context already open - activate it
    return {
      ...state,
      selectedContext: contextNode,
      activePanelId: existingPanelId,
      panels: state.panels.map(panel => {
        if (panel.id === existingPanelId) {
          return {
            ...panel,
            activeContextId: contextId,
          };
        }
        return panel;
      }),
    };
  } else {
    // Context not open - create new tab in active panel
    const currentPanel = state.panels.find(p => p.id === state.activePanelId);
    if (!currentPanel) return state;

    const clusterContextTab = newClusterContextTab(state.activePanelId, contextNode.clusterContext);

    return {
      ...state,
      selectedContext: contextNode,
      panels: state.panels.map(panel => {
        if (panel.id === state.activePanelId) {
          return {
            ...panel,
            tabs: [...panel.tabs, clusterContextTab],
            activeContextId: contextId,
          };
        }
        return panel;
      }),
    };
  }
}

/**
 * タブを閉じた時の状態更新ロジック
 */
export function handleContextNodeClose(
  state: PanelState,
  tab: ClusterContextTab,
  tabHistory: string[]
): { state: PanelState; newTabHistory: string[] } {
  const currentPanel = state.panels.find(p => p.id === tab.panelId);
  if (!currentPanel) return { state, newTabHistory: tabHistory };

  const isClosingActiveTab = currentPanel.activeContextId === tab.clusterContext.id;

  // Remove from history
  const newTabHistory = tabHistory.filter(id => id !== tab.id);

  if (isClosingActiveTab) {
    // アクティブタブを削除した時
    const updatedPanels = state.panels
      .map(panel => {
        if (panel.id === tab.panelId) {
          const newTabs = panel.tabs.filter(t => t.id !== tab.id);
          return {
            ...panel,
            tabs: newTabs,
            activeContextId: undefined,
          };
        }
        return panel;
      })
      .filter(panel => panel.tabs.length > 0);

    // パネルが0になるなら起動時と同じデフォルトパネルを作る
    if (updatedPanels.length === 0) {
      const defaultPanel = createDefaultPanel();
      return {
        state: {
          ...state,
          panels: [defaultPanel],
          activePanelId: defaultPanel.id,
          selectedContext: undefined,
        },
        newTabHistory,
      };
    }

    // 最新のhistoryのtabのidを取り、そのタブ、パネルをアクティブに設定
    let foundTab: ClusterContextTab | undefined;
    let foundPanelId: string | undefined;

    for (let i = newTabHistory.length - 1; i >= 0; i--) {
      const historyTabId = newTabHistory[i];
      for (const panel of updatedPanels) {
        const tab = panel.tabs.find(t => t.id === historyTabId);
        if (tab) {
          foundTab = tab;
          foundPanelId = panel.id;
          break;
        }
      }
      if (foundTab) break;
    }

    if (foundTab && foundPanelId) {
      return {
        state: {
          ...state,
          panels: updatedPanels.map(panel => {
            if (panel.id === foundPanelId) {
              return {
                ...panel,
                activeContextId: foundTab.clusterContext.id,
              };
            }
            // 削除したタブのパネルで、まだタブが残っている場合
            if (panel.id === tab.panelId && panel.tabs.length > 0) {
              // historyから最新のタブを探す
              let panelActiveTab: ClusterContextTab | undefined;
              for (let i = newTabHistory.length - 1; i >= 0; i--) {
                const historyTabId = newTabHistory[i];
                const foundInPanel = panel.tabs.find(t => t.id === historyTabId);
                if (foundInPanel) {
                  panelActiveTab = foundInPanel;
                  break;
                }
              }
              // historyになければ最後のタブを使う
              if (!panelActiveTab) {
                panelActiveTab = panel.tabs[panel.tabs.length - 1];
              }
              return {
                ...panel,
                activeContextId: panelActiveTab.clusterContext.id,
              };
            }
            return panel;
          }),
          activePanelId: foundPanelId,
          selectedContext: {
            id: `context-${foundTab.clusterContext.id}`,
            name: foundTab.clusterContext.clusterName,
            type: NodeType.Context,
            clusterContext: foundTab.clusterContext,
          },
        },
        newTabHistory,
      };
    } else {
      // historyに有効なタブがない場合は、最初のパネルの最初のタブをアクティブにする
      const firstPanel = updatedPanels[0];
      const firstTab = firstPanel.tabs[0];
      if (firstTab) {
        return {
          state: {
            ...state,
            panels: updatedPanels.map(panel => {
              if (panel.id === firstPanel.id) {
                return {
                  ...panel,
                  activeContextId: firstTab.clusterContext.id,
                };
              }
              return panel;
            }),
            activePanelId: firstPanel.id,
            selectedContext: {
              id: `context-${firstTab.clusterContext.id}`,
              name: firstTab.clusterContext.clusterName,
              type: NodeType.Context,
              clusterContext: firstTab.clusterContext,
            },
          },
          newTabHistory,
        };
      } else {
        return {
          state: {
            ...state,
            panels: updatedPanels,
            activePanelId: firstPanel.id,
            selectedContext: undefined,
          },
          newTabHistory,
        };
      }
    }
  } else {
    // 非アクティブタブを削除した時
    return {
      state: {
        ...state,
        panels: state.panels
          .map(panel => {
            if (panel.id === tab.panelId) {
              const newTabs = panel.tabs.filter(t => t.id !== tab.id);
              return {
                ...panel,
                tabs: newTabs,
              };
            }
            return panel;
          })
          .filter(panel => panel.tabs.length > 0),
      },
      newTabHistory,
    };
  }
}

/**
 * パネルを右に分割する時の状態更新ロジック
 */
export function handleSplitRight(
  state: PanelState,
  tab: ClusterContextTab
): SplitRightResult | undefined {
  // Check max panels limit (10)
  if (state.panels.length >= 10) {
    return undefined;
  }

  const sourcePanel = state.panels.find(p => p.id === tab.panelId);
  if (!sourcePanel) return undefined;

  const newPanelId = generatePanelId();
  const clusterContextTab = newClusterContextTab(newPanelId, tab.clusterContext);

  // Create new panel with the same context
  const newPanels = [
    ...state.panels,
    {
      id: newPanelId,
      tabs: [clusterContextTab],
      activeContextId: tab.clusterContext.id,
    },
  ];

  return {
    state: {
      ...state,
      panels: newPanels,
      activePanelId: newPanelId,
    },
    newTab: clusterContextTab,
    newPanelId,
  };
}

/**
 * タブの順序を並び替える時の状態更新ロジック
 */
export function handleTabReorder(state: PanelState, panelId: string, tabIds: string[]): PanelState {
  return {
    ...state,
    panels: state.panels.map(panel => {
      if (panel.id === panelId) {
        const reorderedTabs = tabIds
          .map(id => panel.tabs.find(t => t.id === id))
          .filter((t): t is ClusterContextTab => t !== undefined);
        return {
          ...panel,
          tabs: reorderedTabs,
        };
      }
      return panel;
    }),
  };
}

export interface TabMoveResult {
  state: PanelState;
  oldTabId: string;
  newTabId: string;
  updatedTab: ClusterContextTab;
}

/**
 * タブを別のパネルに移動する時の状態更新ロジック
 */
export function handleTabMove(
  state: PanelState,
  sourceTabId: string,
  targetPanelId: string,
  targetIndex: number
): TabMoveResult | undefined {
  // Find the source tab and panel
  let sourceTab: ClusterContextTab | undefined;
  let sourcePanelId: string | undefined;

  for (const panel of state.panels) {
    const tab = panel.tabs.find(t => t.id === sourceTabId);
    if (tab) {
      sourceTab = tab;
      sourcePanelId = panel.id;
      break;
    }
  }

  if (!sourceTab || !sourcePanelId) return undefined;

  // Update tab's panelId and generate new id using factory method
  const updatedTab: ClusterContextTab = newClusterContextTab(
    targetPanelId,
    sourceTab.clusterContext
  );

  const newPanels = state.panels
    .map(panel => {
      if (panel.id === sourcePanelId) {
        // Remove from source panel
        return {
          ...panel,
          tabs: panel.tabs.filter(t => t.id !== sourceTabId),
          activeContextId:
            panel.activeContextId === sourceTab.clusterContext.id
              ? undefined
              : panel.activeContextId,
        };
      } else if (panel.id === targetPanelId) {
        // Add to target panel at specified index
        const newTabs = [...panel.tabs];
        newTabs.splice(targetIndex, 0, updatedTab);
        return {
          ...panel,
          tabs: newTabs,
          activeContextId: updatedTab.clusterContext.id,
        };
      }
      return panel;
    })
    .filter(panel => panel.tabs.length > 0); // Remove empty panels

  return {
    state: {
      ...state,
      panels: newPanels,
      activePanelId: targetPanelId,
      selectedContext: newClusterContextNode(updatedTab.clusterContext, undefined),
    },
    oldTabId: sourceTabId,
    newTabId: updatedTab.id,
    updatedTab,
  };
}
