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
 * 環境設定
 * - USE_MOCK: モックデータを使用するかどうか（"true"の場合モックデータを使用）
 * - VITE_USE_REAL_API: 強制的に実際のAPIを使用するかどうか（"true"の場合常に実際のAPIを使用）
 */
const isDev = import.meta.env.DEV;
const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';
const useMocks = isDev && !useRealApi;

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
   * 環境変数に基づいて、開発中はモックデータを返し、本番または設定時は実際のAPIを呼び出します
   */
  getKubeContexts: async (): Promise<string[]> => {
    // VITE_USE_REAL_API=true の場合や本番環境では実際のAPIを呼び出す
    if (!useMocks) {
      console.info('Using real Tauri API for getKubeContexts');
      return invoke('get_kube_contexts');
    }

    // 開発環境ではモックデータを返す
    console.info('Using mock data for getKubeContexts (DEV mode)');
    return Promise.resolve([
      // GKE contexts
      'gke_project-a_asia-northeast1_cluster-1',
      'gke_project-a_asia-northeast1_cluster-2',
      'gke_project-b_us-central1_cluster-1',
      'gke_project-b_us-central1_cluster-2',

      // EKS contexts
      'arn:aws:eks:ap-northeast-1:123456789012:cluster/eks-cluster-1',
      'arn:aws:eks:ap-northeast-1:123456789012:cluster/eks-cluster-2',
      'arn:aws:eks:us-west-2:123456789012:cluster/eks-cluster-3',

      // Other contexts
      'docker-desktop',
      'minikube',
      'kind-cluster',
      'custom-context-1',
      'custom-context-2',
    ]);
  },

  /**
   * クラスタ概要情報を取得します
   */
  getClusterOverviewInfo: async (contextId: string): Promise<ClusterOverviewInfo> => {
    if (!useMocks) {
      console.info('Using real Tauri API for getClusterOverviewInfo');
      return invoke('get_cluster_overview_info', { contextId });
    }

    console.info('Using mock data for getClusterOverviewInfo (DEV mode)');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      provider: 'GKE',
      projectOrAccount: 'my-gcp-project',
      region: 'asia-northeast1',
      clusterName: 'production-cluster',
      clusterVersion: 'v1.28.5-gke.1217000',
    };
  },

  /**
   * クラスタ統計情報を取得します
   */
  getClusterStats: async (contextId: string): Promise<ClusterStats> => {
    if (!useMocks) {
      console.info('Using real Tauri API for getClusterStats');
      return invoke('get_cluster_stats', { contextId });
    }

    console.info('Using mock data for getClusterStats (DEV mode)');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      totalNodes: 5,
      readyNodes: 5,
      totalPods: 42,
      runningPods: 38,
      namespaceCount: 8,
      deploymentCount: 15,
      jobCount: 3,
      cpuUsage: '45%',
      memoryUsage: '62%',
    };
  },

  /**
   * ノード一覧を取得します
   */
  getNodes: async (contextId: string): Promise<NodeInfo[]> => {
    if (!useMocks) {
      console.info('Using real Tauri API for getNodes');
      return invoke('get_nodes', { contextId });
    }

    console.info('Using mock data for getNodes (DEV mode)');
    await new Promise(resolve => setTimeout(resolve, 300));
    const baseTime = new Date();
    return [
      {
        name: 'node-1',
        status: 'Ready',
        version: 'v1.28.5',
        osImage: 'Ubuntu 22.04',
        cpu: '4 cores',
        memory: '16Gi',
        creationTimestamp: new Date(baseTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        internalIP: '10.0.1.1',
        externalIP: '35.200.100.1',
      },
      {
        name: 'node-2',
        status: 'Ready',
        version: 'v1.28.5',
        osImage: 'Ubuntu 22.04',
        cpu: '4 cores',
        memory: '16Gi',
        creationTimestamp: new Date(baseTime.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        internalIP: '10.0.1.2',
        externalIP: '35.200.100.2',
      },
      {
        name: 'node-3',
        status: 'Ready',
        version: 'v1.28.5',
        osImage: 'Ubuntu 22.04',
        cpu: '8 cores',
        memory: '32Gi',
        creationTimestamp: new Date(baseTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        internalIP: '10.0.1.3',
        externalIP: '35.200.100.3',
      },
      {
        name: 'node-4',
        status: 'Ready',
        version: 'v1.28.5',
        osImage: 'Ubuntu 22.04',
        cpu: '4 cores',
        memory: '16Gi',
        creationTimestamp: new Date(baseTime.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        internalIP: '10.0.1.4',
        externalIP: '35.200.100.4',
      },
      {
        name: 'node-5',
        status: 'Ready',
        version: 'v1.28.5',
        osImage: 'Ubuntu 22.04',
        cpu: '4 cores',
        memory: '16Gi',
        creationTimestamp: new Date(baseTime.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        internalIP: '10.0.1.5',
        externalIP: '35.200.100.5',
      },
    ];
  },

  /**
   * Pod一覧を取得します
   */
  getPods: async (contextId: string): Promise<PodInfo[]> => {
    if (!useMocks) {
      console.info('Using real Tauri API for getPods');
      return invoke('get_pods', { contextId });
    }

    console.info('Using mock data for getPods (DEV mode)');
    await new Promise(resolve => setTimeout(resolve, 300));
    const statuses = ['Running', 'Running', 'Running', 'Running', 'Pending', 'Failed'];
    const namespaces = ['default', 'kube-system', 'production', 'development'];
    const pods: PodInfo[] = [];
    const baseTime = new Date();

    for (let i = 0; i < 15; i++) {
      const totalContainers = Math.floor(Math.random() * 3) + 1;
      const readyContainers =
        statuses[i % statuses.length] === 'Running'
          ? totalContainers
          : Math.floor(Math.random() * totalContainers);
      const minutesAgo = Math.floor(Math.random() * 60 * 24 * 7);
      pods.push({
        name: `pod-${i + 1}-${Math.random().toString(36).substring(7)}`,
        namespace: namespaces[i % namespaces.length],
        status: statuses[i % statuses.length],
        node: `node-${(i % 5) + 1}`,
        restarts: Math.floor(Math.random() * 3),
        readyContainers,
        totalContainers,
        creationTimestamp: new Date(baseTime.getTime() - minutesAgo * 60000).toISOString(),
      });
    }

    return pods;
  },
};
