/**
 * Rust の Tauri コマンドを型安全に呼び出すためのラッパー関数を提供します。
 */

import { invoke } from '@tauri-apps/api/core';

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
};
