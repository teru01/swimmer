import { describe, it, expect } from 'vitest';
import {
  handleContextNodeSelect,
  handleContextNodeClose,
  handleSplitRight,
  handleTabReorder,
  handleTabMove,
  PanelState,
} from './panelLogic';
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

  describe('handleSplitRight', () => {
    it('ctx1を開く, splitする: panelが2つできてそれぞれ1つずつ同じcontextidのtabができる. 2つ目の方にactive panel, active tabがある', () => {
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

      // Context1を開く
      state = handleContextNodeSelect(state, node1);
      const tab1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context1');
      expect(tab1).toBeDefined();

      // Split right
      const splitResult = handleSplitRight(state, tab1!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;

      // パネルが2つある
      expect(state.panels.length).toBe(2);

      // 1つ目のパネルに元のtab1がある
      expect(state.panels[0].tabs.length).toBe(1);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context1');

      // 2つ目のパネルに新しいタブがある（同じcontext id）
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context1');

      // 2つ目のパネルがアクティブ
      expect(state.activePanelId).toBe(state.panels[1].id);

      // 2つ目のパネルのタブがアクティブ
      expect(state.panels[1].activeContextId).toBe('context1');
    });

    it('ctx1, ctx2, ctx3を開く、ctx2をsplitする, 2つ目のパネルのctx2を消す: パネルは1つだけ。ctx1, ctx3が残る。ctx3がactive', () => {
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
      tabHistory.push(tab1!.id);

      // Context2を開く
      state = handleContextNodeSelect(state, node2);
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2!.id);

      // Context3を開く
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      tabHistory.push(tab3!.id);

      // ctx2をsplitする
      const splitResult = handleSplitRight(state, tab2!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;
      tabHistory.push(splitResult!.newTab.id);

      // パネルが2つある
      expect(state.panels.length).toBe(2);

      // 1つ目のパネルにctx1, ctx2, ctx3がある
      expect(state.panels[0].tabs.length).toBe(3);

      // 2つ目のパネルにctx2がある
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context2');
      const panel2Tab2 = state.panels[1].tabs[0];

      // 2つ目のパネルのctx2を消す
      const closeResult = handleContextNodeClose(state, panel2Tab2, tabHistory);
      state = closeResult.state;
      tabHistory = closeResult.newTabHistory;

      // パネルは1つだけ
      expect(state.panels.length).toBe(1);

      // ctx1, ctx3が残る
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();

      // ctx3がactive
      expect(state.panels[0].activeContextId).toBe('context3');
      expect(state.activePanelId).toBe(state.panels[0].id);
    });

    it('ctx1, ctx2, ctx3を開く、ctx2をsplitする, 1つ目のパネルのctx2タブを開く、それを閉じる: パネルは2つ。パネル1にはctx1, ctx3が残りパネルはactiveではないがctx3がアクティブ。パネル2にはctx2が残りactiveでパネル自体もactive', () => {
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
      tabHistory.push(tab1!.id);

      // Context2を開く
      state = handleContextNodeSelect(state, node2);
      const tab2Panel1 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2');
      tabHistory.push(tab2Panel1!.id);

      // Context3を開く
      state = handleContextNodeSelect(state, node3);
      const tab3 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context3');
      tabHistory.push(tab3!.id);

      // ctx2をsplitする
      const splitResult = handleSplitRight(state, tab2Panel1!);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;
      tabHistory.push(splitResult!.newTab.id);

      // パネルが2つある
      expect(state.panels.length).toBe(2);

      // 1つ目のパネルのctx2タブを開く（アクティブにする）
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

      // 1つ目のパネルのctx2を閉じる
      const closeResult = handleContextNodeClose(state, tab2Panel1!, tabHistory);
      state = closeResult.state;
      tabHistory = closeResult.newTabHistory;

      // パネルは2つ
      expect(state.panels.length).toBe(2);

      // パネル1にはctx1, ctx3が残る
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context1')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context3')).toBeDefined();
      expect(state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')).toBeUndefined();

      // パネル1はactiveではないがctx3がアクティブ
      expect(state.panels[0].activeContextId).toBe('context3');

      // パネル2にはctx2が残る
      expect(state.panels[1].tabs.length).toBe(1);
      expect(state.panels[1].tabs[0].clusterContext.id).toBe('context2');

      // パネル2がactive
      expect(state.activePanelId).toBe(state.panels[1].id);

      // パネル2のctx2がアクティブ
      expect(state.panels[1].activeContextId).toBe('context2');
    });
  });

  describe('handleTabReorder', () => {
    it('ctx1, ctx2, ctx3を開いて、順序をctx3, ctx1, ctx2に並び替える', () => {
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

      // context1, context2, context3を開く
      state = handleContextNodeSelect(state, node1);
      state = handleContextNodeSelect(state, node2);
      state = handleContextNodeSelect(state, node3);

      const panelId = state.panels[0].id;
      const tab1Id = state.panels[0].tabs[0].id;
      const tab2Id = state.panels[0].tabs[1].id;
      const tab3Id = state.panels[0].tabs[2].id;

      // 順序を並び替え: tab3, tab1, tab2
      state = handleTabReorder(state, panelId, [tab3Id, tab1Id, tab2Id]);

      // タブの順序を確認
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context3');
      expect(state.panels[0].tabs[1].clusterContext.id).toBe('context1');
      expect(state.panels[0].tabs[2].clusterContext.id).toBe('context2');
    });

    it('存在しないtabIdを含む並び替えでは、存在するタブのみが並び替えられる', () => {
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

      state = handleContextNodeSelect(state, node1);
      state = handleContextNodeSelect(state, node2);

      const panelId = state.panels[0].id;
      const tab1Id = state.panels[0].tabs[0].id;
      const tab2Id = state.panels[0].tabs[1].id;

      // 存在しないIDを含む並び替え
      state = handleTabReorder(state, panelId, ['non-existent', tab2Id, tab1Id]);

      // 存在するタブのみが並び替えられる
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context2');
      expect(state.panels[0].tabs[1].clusterContext.id).toBe('context1');
    });
  });

  describe('handleTabMove', () => {
    it('ctx1, ctx2を開き、ctx2をsplitし、パネル2のctx2をパネル1の先頭に移動する', () => {
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

      // context1, context2を開く
      state = handleContextNodeSelect(state, node1);
      state = handleContextNodeSelect(state, node2);

      const panel1Id = state.panels[0].id;
      const tab2 = state.panels[0].tabs.find(t => t.clusterContext.id === 'context2')!;

      // ctx2をsplit
      const splitResult = handleSplitRight(state, tab2);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;

      const panel2Id = state.panels[1].id;
      const panel2Tab2Id = state.panels[1].tabs[0].id;

      // パネル2のctx2をパネル1の先頭（index 0）に移動
      const moveResult = handleTabMove(state, panel2Tab2Id, panel1Id, 0);
      expect(moveResult).toBeDefined();
      state = moveResult!.state;

      // 空のパネル2は削除され、パネルは1つになる
      expect(state.panels.length).toBe(1);

      // パネル1に3つのタブ（ctx2が先頭）
      expect(state.panels[0].tabs.length).toBe(3);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context2');
      expect(state.panels[0].tabs[1].clusterContext.id).toBe('context1');
      expect(state.panels[0].tabs[2].clusterContext.id).toBe('context2');

      // パネル1がactive
      expect(state.activePanelId).toBe(panel1Id);

      // 移動したctx2がactive
      expect(state.panels[0].activeContextId).toBe('context2');

      // タブIDが更新されている
      expect(moveResult!.newTabId).toBe(`${panel1Id}-context2`);
      expect(moveResult!.oldTabId).toBe(panel2Tab2Id);
    });

    it('存在しないtabIdを移動しようとするとundefinedを返す', () => {
      const state: PanelState = {
        panels: [createDefaultPanel()],
        activePanelId: '',
        selectedContext: undefined,
      };
      state.activePanelId = state.panels[0].id;

      const result = handleTabMove(state, 'non-existent-tab', state.panels[0].id, 0);
      expect(result).toBeUndefined();
    });

    it('ctx1をパネル1で開き、splitして、パネル2のctx1をパネル1の最後（index 1）に移動する', () => {
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

      state = handleContextNodeSelect(state, node1);

      const panel1Id = state.panels[0].id;
      const tab1 = state.panels[0].tabs[0];

      // split
      const splitResult = handleSplitRight(state, tab1);
      expect(splitResult).toBeDefined();
      state = splitResult!.state;

      const panel2Tab1Id = state.panels[1].tabs[0].id;

      // パネル2のctx1をパネル1の最後（index 1）に移動
      const moveResult = handleTabMove(state, panel2Tab1Id, panel1Id, 1);
      expect(moveResult).toBeDefined();
      state = moveResult!.state;

      // 空のパネル2は削除され、パネルは1つになる
      expect(state.panels.length).toBe(1);

      // パネル1に2つのタブ
      expect(state.panels[0].tabs.length).toBe(2);
      expect(state.panels[0].tabs[0].clusterContext.id).toBe('context1');
      expect(state.panels[0].tabs[1].clusterContext.id).toBe('context1');
    });
  });
});
