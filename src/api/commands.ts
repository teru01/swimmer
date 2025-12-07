/**
 * Rust の Tauri コマンドを型安全に呼び出すためのラッパー関数を提供します。
 */

import { invoke } from '@tauri-apps/api/core';

export interface ClusterOverviewInfo {
  provider: string;
  projectOrAccount: string;
  region: string;
  clusterName: string;
  clusterVersion: string;
}

export interface ClusterStats {
  totalNodes: number;
  readyNodes: number;
  totalPods: number;
  runningPods: number;
  namespaceCount: number;
  deploymentCount: number;
  jobCount: number;
  cpuUsage: string;
  memoryUsage: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  version: string;
  osImage: string;
  cpu: string;
  memory: string;
  creationTimestamp?: string;
  internalIP?: string;
  externalIP?: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  node: string;
  restarts: number;
  readyContainers?: number;
  totalContainers?: number;
  creationTimestamp?: string;
}

/**
 * サポートされている全ての Rust コマンドをラップしたオブジェクト
 */
export const commands = {
  /**
   * 挨拶メッセージを生成します
   */
  greet: (name: string): Promise<string> => {
    return invoke('greet', { name });
  },

  /**
   * 利用可能な Kubernetes コンテキストのリストを取得します
   */
  getKubeContexts: async (): Promise<string[]> => {
    return invoke('get_kube_contexts');
  },

  /**
   * クラスタ概要情報を取得します
   */
  getClusterOverviewInfo: async (contextId: string): Promise<ClusterOverviewInfo> => {
    return invoke('get_cluster_overview_info', { contextId });
  },

  /**
   * クラスタ統計情報を取得します
   */
  getClusterStats: async (contextId: string): Promise<ClusterStats> => {
    return invoke('get_cluster_stats', { contextId });
  },

  /**
   * ノード一覧を取得します
   */
  getNodes: async (contextId: string): Promise<NodeInfo[]> => {
    return invoke('get_nodes', { contextId });
  },

  /**
   * Pod一覧を取得します
   */
  getPods: async (contextId: string): Promise<PodInfo[]> => {
    return invoke('get_pods', { contextId });
  },

  /**
   * Kubernetesリソースのリストを取得します
   */
  listResources: async (
    context: string | undefined,
    kind: string,
    namespace: string | undefined
  ): Promise<any[]> => {
    return invoke('list_resources', { context, kind, namespace });
  },

  /**
   * Kubernetesリソースの詳細を取得します
   */
  getResourceDetail: async (
    context: string | undefined,
    kind: string,
    name: string,
    namespace: string | undefined
  ): Promise<any> => {
    return invoke('get_resource_detail', { context, kind, name, namespace });
  },
};
