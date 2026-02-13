/**
 * Provides type-safe wrapper functions for invoking Rust Tauri commands.
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
 * Object wrapping all supported Rust commands
 */
export const commands = {
  /**
   * Get list of available Kubernetes contexts
   */
  getKubeContexts: async (): Promise<string[]> => {
    return invoke('get_kube_contexts');
  },

  /**
   * Set kubeconfig path
   */
  setKubeconfigPath: async (path: string | undefined): Promise<void> => {
    return invoke('set_kubeconfig_path', { path });
  },

  /**
   * Get current kubeconfig path
   */
  getKubeconfigPath: async (): Promise<string | undefined> => {
    return invoke('get_kubeconfig_path');
  },

  /**
   * Get cluster overview information
   */
  getClusterOverviewInfo: async (contextId: string): Promise<ClusterOverviewInfo> => {
    return invoke('get_cluster_overview_info', { contextId });
  },

  /**
   * Get cluster statistics
   */
  getClusterStats: async (contextId: string): Promise<ClusterStats> => {
    return invoke('get_cluster_stats', { contextId });
  },

  /**
   * Get list of Kubernetes resources
   */
  listResources: async (
    context: string | undefined,
    kind: string,
    namespace: string | undefined
  ): Promise<any[]> => {
    return invoke('list_resources', { context, kind, namespace });
  },

  /**
   * Get Kubernetes resource details
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
   * Start watching resources
   */
  startWatchResources: async (
    context: string | undefined,
    kind: string,
    namespace: string | undefined
  ): Promise<string> => {
    return invoke('start_watch_resources', { context, kind, namespace });
  },

  /**
   * Stop watching resources
   */
  stopWatchResources: async (watchId: string): Promise<void> => {
    return invoke('stop_watch_resources', { watchId });
  },

  /**
   * Get list of CRD groups
   */
  listCrdGroups: async (context: string | undefined): Promise<CrdGroup[]> => {
    return invoke('list_crd_groups', { context });
  },

  /**
   * Delete a Kubernetes resource
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
   * Execute rollout restart for a Deployment
   */
  rolloutRestartDeployment: async (
    context: string | undefined,
    name: string,
    namespace: string
  ): Promise<void> => {
    return invoke('rollout_restart_deployment', { context, name, namespace });
  },
};
