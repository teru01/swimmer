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
}

export interface CrdResourceInfo {
  kind: string;
  plural: string;
  version: string;
  scope: string;
  group: string;
}

export interface CrdGroup {
  group: string;
  resources: CrdResourceInfo[];
}

/**
 * サポートされている全ての Rust コマンドをラップしたオブジェクト
 */
export const commands = {
  /**
   * 利用可能な Kubernetes コンテキストのリストを取得します
   */
  getKubeContexts: async (): Promise<string[]> => {
    return invoke('get_kube_contexts');
  },

  /**
   * Kubeconfig パスを設定します
   */
  setKubeconfigPath: async (path: string | undefined): Promise<void> => {
    return invoke('set_kubeconfig_path', { path });
  },

  /**
   * 現在の Kubeconfig パスを取得します
   */
  getKubeconfigPath: async (): Promise<string | undefined> => {
    return invoke('get_kubeconfig_path');
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

  /**
   * リソースのwatch監視を開始します
   */
  startWatchResources: async (
    context: string | undefined,
    kind: string,
    namespace: string | undefined
  ): Promise<string> => {
    return invoke('start_watch_resources', { context, kind, namespace });
  },

  /**
   * リソースのwatch監視を停止します
   */
  stopWatchResources: async (watchId: string): Promise<void> => {
    return invoke('stop_watch_resources', { watchId });
  },

  /**
   * CRDグループ一覧を取得します
   */
  listCrdGroups: async (context: string | undefined): Promise<CrdGroup[]> => {
    return invoke('list_crd_groups', { context });
  },

  /**
   * Kubernetesリソースを削除します
   */
  deleteResource: async (
    context: string | undefined,
    kind: string,
    name: string,
    namespace: string | undefined
  ): Promise<void> => {
    return invoke('delete_resource', { context, kind, name, namespace });
  },

  /**
   * Deploymentのrollout restartを実行します
   */
  rolloutRestartDeployment: async (
    context: string | undefined,
    name: string,
    namespace: string
  ): Promise<void> => {
    return invoke('rollout_restart_deployment', { context, name, namespace });
  },
};
