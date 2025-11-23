import { describe, it, expect } from 'vitest';
import { handleContextNodeSelect, handleContextNodeClose, PanelState } from './panelLogic';
import { ClusterContext, ContextNode, NodeType } from '../lib/contextTree';
import { createDefaultPanel } from '../cluster/types/panel';

describe('panelLogic', () => {
  describe('handleContextNodeClose', () => {
    it('context1を開く、context2を開く、context3を開く、tab1を消すと、tab2,3が残っていてtab3がactiveである', () => {
      // 初期状態: 空のパネル1つ
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

      // Context1を開く
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      expect(tab1).toBeDefined();
      tabHistory.push(tab1!.id);

      // Context2を開く
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      expect(tab2).toBeDefined();
      tabHistory.push(tab2!.id);

      // Context3を開く
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      expect(tab3).toBeDefined();
      tabHistory.push(tab3!.id);

      // この時点で3つのタブがあることを確認
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].activeContextId).toBe('context3');

      // Tab1を削除
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // Tab1が削除されたことを確認
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeUndefined();

      // Tab2とTab3が残っていることを確認
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();

      // Tab3がアクティブであることを確認
      expect(state.panels[0].activeContextId).toBe('context3');
      expect(state.selectedContext?.clusterContext?.id).toBe('context3');

      // Active panelは最初のパネルのまま
      expect(state.activePanelId).toBe(state.panels[0].id);

      // Historyからtab1が削除されていることを確認
      expect(tabHistory).not.toContain(tab1!.id);
      expect(tabHistory).toContain(tab2!.id);
      expect(tabHistory).toContain(tab3!.id);
    });

    it('非アクティブタブを削除した時、アクティブタブとパネルはそのまま', () => {
      // 初期状態
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

      // Context1を開く
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Context2を開く
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2!.id);

      // Context2がアクティブ
      expect(state.panels[0].activeContextId).toBe('context2');

      // Tab1（非アクティブ）を削除
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // Tab1が削除されたことを確認
      expect(state.panels[0].tabs.length).toBe(1);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeUndefined();

      // Tab2が残っていることを確認
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();

      // アクティブタブはそのまま（context2）
      expect(state.panels[0].activeContextId).toBe('context2');

      // Active panelもそのまま
      const originalPanelId = state.panels[0].id;
      expect(state.activePanelId).toBe(originalPanelId);

      // Historyからtab1が削除されていることを確認
      expect(tabHistory).not.toContain(tab1!.id);
      expect(tabHistory).toContain(tab2!.id);
    });

    it('全てのタブを削除するとデフォルトパネルが作成される', () => {
      // 初期状態
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

      // Context1を開く
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      tabHistory.push(tab1!.id);

      // Tab1を削除
      const result = handleContextNodeClose(state, tab1!, tabHistory);
      state = result.state;
      tabHistory = result.newTabHistory;

      // デフォルトパネルが作成されていることを確認
      expect(state.panels.length).toBe(1);
      expect(state.panels[0].tabs.length).toBe(0);
      expect(state.selectedContext).toBeUndefined();
      expect(tabHistory.length).toBe(0);

      // Active panelは新しく作成されたデフォルトパネル
      expect(state.activePanelId).toBe(state.panels[0].id);
    });
  });
});
