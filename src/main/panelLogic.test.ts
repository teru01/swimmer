import { describe, it, expect } from 'vitest';
import {
  handleContextNodeSelect,
  handleContextNodeClose,
  handleSplitRight,
  PanelState,
} from './panelLogic';
import { ClusterContext, ContextNode, NodeType } from '../lib/contextTree';
import { createDefaultPanel } from '../cluster/types/panel';

describe('panelLogic', () => {
  describe('handleContextNodeClose', () => {
    it('open ctx1, ctx2, ctx3, close tab1 → tab2,3 remain with tab3 active', () => {
      // Initial state: one empty panel
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const context2: ClusterContext = {
        id: 'context2',
        clusterName: 'cluster2',
        provider: 'AWS',
        region: 'us-west-2',
      };

      const context3: ClusterContext = {
        id: 'context3',
        clusterName: 'cluster3',
        provider: 'GKE',
        region: 'us-east-1',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      const node2: ContextNode = {
        id: 'context-context2',
        name: 'cluster2',
        type: NodeType.Context,
        clusterContext: context2,
      };

      const node3: ContextNode = {
        id: 'context-context3',
        name: 'cluster3',
        type: NodeType.Context,
        clusterContext: context3,
      };

      let tabHistory: string[] = [];

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      expect(tab1).toBeDefined();
      tabHistory.push(tab1!.id);

      // Open Context2
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      expect(tab2).toBeDefined();
      tabHistory.push(tab2!.id);

      // Open Context3
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      expect(tab3).toBeDefined();
      tabHistory.push(tab3!.id);

      // Verify 3 tabs exist
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].activeContextId).toBe('context3');

      // Delete Tab1
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // Verify Tab1 is deleted
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeUndefined();

      // Verify Tab2 and Tab3 remain
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();

      // Verify Tab3 is active
      expect(state.panels[0].activeContextId).toBe('context3');
      expect(state.selectedContext?.clusterContext?.id).toBe('context3');

      // Active panel is still the first panel
      expect(state.activePanelId).toBe(state.panels[0].id);

      // Verify tab1 is removed from history
      expect(tabHistory).not.toContain(tab1!.id);
      expect(tabHistory).toContain(tab2!.id);
      expect(tabHistory).toContain(tab3!.id);
    });

    it('closing a non-active tab keeps active tab and panel unchanged', () => {
      // Initial state
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const context2: ClusterContext = {
        id: 'context2',
        clusterName: 'cluster2',
        provider: 'AWS',
        region: 'us-west-2',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      const node2: ContextNode = {
        id: 'context-context2',
        name: 'cluster2',
        type: NodeType.Context,
        clusterContext: context2,
      };

      let tabHistory: string[] = [];

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Open Context2
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2!.id);

      // Context2 is active
      expect(state.panels[0].activeContextId).toBe('context2');

      // Delete Tab1 (non-active)
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // Verify Tab1 is deleted
      expect(state.panels[0].tabs.length).toBe(1);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeUndefined();

      // Verify Tab2 remains
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();

      // Active tab unchanged (context2)
      expect(state.panels[0].activeContextId).toBe('context2');

      // Active panel unchanged
      const originalPanelId = state.panels[0].id;
      expect(state.activePanelId).toBe(originalPanelId);

      // Verify tab1 is removed from history
      expect(tabHistory).not.toContain(tab1!.id);
      expect(tabHistory).toContain(tab2!.id);
    });

    it('closing all tabs creates a default panel', () => {
      // Initial state
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      let tabHistory: string[] = [];

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Delete Tab1
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // Verify default panel is created
      expect(state.panels.length).toBe(1);
      expect(state.panels[0].tabs.length).toBe(0);
      expect(state.selectedContext).toBeUndefined();
      expect(tabHistory.length).toBe(0);

      // Active panel is the newly created default panel
      expect(state.activePanelId).toBe(state.panels[0].id);
    });
  });

  describe('handleSplitRight', () => {
    it('open ctx1, split → 2 panels each with one tab of same context, second panel is active', () => {
      // Initial state
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      expect(tab1).toBeDefined();

      // Split right
      const splitResult = handleSplitRight(state, tab1!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;

      // 2 panels exist
      expect(state.panels.length).toBe(2);

      // First panel has original tab1
      expect(state.panels[0].tabs.length).toBe(1);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context1');

      // Second panel has new tab (same context id)
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context1');

      // Second panel is active
      expect(state.activePanelId).toBe(state.panels[1].id);

      // Second panel's tab is active
      expect(state.panels[1].activeContextId).toBe('context1');
    });

    it('open ctx1,2,3, split ctx2, close ctx2 in panel2 → 1 panel with ctx1,ctx3, ctx3 active', () => {
      // Initial state
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const context2: ClusterContext = {
        id: 'context2',
        clusterName: 'cluster2',
        provider: 'AWS',
        region: 'us-west-2',
      };

      const context3: ClusterContext = {
        id: 'context3',
        clusterName: 'cluster3',
        provider: 'GKE',
        region: 'us-east-1',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      const node2: ContextNode = {
        id: 'context-context2',
        name: 'cluster2',
        type: NodeType.Context,
        clusterContext: context2,
      };

      const node3: ContextNode = {
        id: 'context-context3',
        name: 'cluster3',
        type: NodeType.Context,
        clusterContext: context3,
      };

      let tabHistory: string[] = [];

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Open Context2
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2!.id);

      // Open Context3
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      tabHistory.push(tab3!.id);

      // Split ctx2
      const splitResult = handleSplitRight(state, tab2!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;
      tabHistory.push(splitResult!.newTab.id);

      // 2 panels exist
      expect(state.panels.length).toBe(2);

      // First panel has ctx1, ctx2, ctx3
      expect(state.panels[0].tabs.length).toBe(3);

      // Second panel has ctx2
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context2');
      const panel2Tab2 = state.panels[1].tabs[0];

      // Close ctx2 in second panel
      const closeResult = handleContextNodeClose(state, panel2Tab2, tabHistory);
      state = closeResult.state;
      tabHistory = closeResult.newTabHistory;

      // Only 1 panel
      expect(state.panels.length).toBe(1);

      // ctx1, ctx3 remain
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();

      // ctx3 is active
      expect(state.panels[0].activeContextId).toBe('context3');
      expect(state.activePanelId).toBe(state.panels[0].id);
    });

    it('open ctx1,2,3, split ctx2, select ctx2 in panel1 then close it → 2 panels, panel1 has ctx1,ctx3 with ctx3 active, panel2 has ctx2 and is active', () => {
      // Initial state
      let state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const context1: ClusterContext = {
        id: 'context1',
        clusterName: 'cluster1',
        provider: 'GKE',
        region: 'us-west-1',
      };

      const context2: ClusterContext = {
        id: 'context2',
        clusterName: 'cluster2',
        provider: 'AWS',
        region: 'us-west-2',
      };

      const context3: ClusterContext = {
        id: 'context3',
        clusterName: 'cluster3',
        provider: 'GKE',
        region: 'us-east-1',
      };

      const node1: ContextNode = {
        id: 'context-context1',
        name: 'cluster1',
        type: NodeType.Context,
        clusterContext: context1,
      };

      const node2: ContextNode = {
        id: 'context-context2',
        name: 'cluster2',
        type: NodeType.Context,
        clusterContext: context2,
      };

      const node3: ContextNode = {
        id: 'context-context3',
        name: 'cluster3',
        type: NodeType.Context,
        clusterContext: context3,
      };

      let tabHistory: string[] = [];

      // Open Context1
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Open Context2
      state = handleContextNodeSelect(state, node2);
      const tab2Panel1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2Panel1!.id);

      // Open Context3
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      tabHistory.push(tab3!.id);

      // Split ctx2
      const splitResult = handleSplitRight(state, tab2Panel1!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;
      tabHistory.push(splitResult!.newTab.id);

      // 2 panels exist
      expect(state.panels.length).toBe(2);

      // Select ctx2 tab in first panel (make active)
      state = {
        ...state,
        activePanelId: state.panels[0].id,
        panels: state.panels.map(panel => {
          if (panel.id === state.panels[0].id) {
            return {
              ...panel,
              activeContextId: 'context2',
            };
          }
          return panel;
        }),
      };

      // Close ctx2 in first panel
      const closeResult = handleContextNodeClose(state, tab2Panel1!, tabHistory);
      state = closeResult.state;
      tabHistory = closeResult.newTabHistory;

      // 2 panels exist
      expect(state.panels.length).toBe(2);

      // Panel1 has ctx1, ctx3
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeUndefined();

      // Panel1 is not active but ctx3 is its active tab
      expect(state.panels[0].activeContextId).toBe('context3');

      // Panel2 has ctx2
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context2');

      // Panel2 is active
      expect(state.activePanelId).toBe(state.panels[1].id);

      // Panel2's ctx2 is active
      expect(state.panels[1].activeContextId).toBe('context2');
    });
  });
});
