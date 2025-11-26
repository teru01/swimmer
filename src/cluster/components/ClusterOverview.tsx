import React, { useState, useEffect } from 'react';
import './ClusterOverview.css';
import { gkeProvider } from '../../lib/providers/gke';
import { eksProvider } from '../../lib/providers/eks';
import { othersProvider } from '../../lib/providers/others';
import { commands } from '../../api';
import type { ClusterStats, NodeInfo, PodInfo } from '../../api/commands';

const PROVIDERS = [gkeProvider, eksProvider, othersProvider];

interface ClusterInfo {
  provider: string;
  projectOrAccount: string;
  projectOrAccountLabel: string;
  region: string;
  clusterName: string;
  clusterVersion: string;
}

const fetchClusterInfo = async (contextId: string): Promise<ClusterInfo> => {
  const info = await commands.getClusterOverviewInfo(contextId);
  const matchedProvider = PROVIDERS.find(p => p.name === info.provider);
  const projectOrAccountLabel = matchedProvider?.resourceContainerLabel || 'Project/Account';

  return {
    ...info,
    projectOrAccountLabel,
  };
};

interface ClusterOverviewProps {
  contextId: string;
}

const ClusterOverview: React.FC<ClusterOverviewProps> = ({ contextId }) => {
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | undefined>(undefined);
  const [stats, setStats] = useState<ClusterStats | undefined>(undefined);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [info, statsData, nodesData, podsData] = await Promise.all([
          fetchClusterInfo(contextId),
          commands.getClusterStats(contextId),
          commands.getNodes(contextId),
          commands.getPods(contextId),
        ]);
        setClusterInfo(info);
        setStats(statsData);
        setNodes(nodesData);
        setPods(podsData);
      } catch (error) {
        console.error('Failed to load cluster overview:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [contextId]);

  if (isLoading) {
    return (
      <div className="cluster-overview-loading">
        <div className="loading-spinner"></div>
        <span>Loading cluster information...</span>
      </div>
    );
  }

  if (!clusterInfo || !stats) {
    return <div className="cluster-overview-error">Failed to load cluster information</div>;
  }

  return (
    <div className="cluster-overview">
      <div className="overview-section cluster-info-section">
        <h2 className="section-title">Cluster Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Provider:</span>
            <span className="info-value">{clusterInfo.provider}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{clusterInfo.projectOrAccountLabel}:</span>
            <span className="info-value">{clusterInfo.projectOrAccount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Region:</span>
            <span className="info-value">{clusterInfo.region}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Cluster Name:</span>
            <span className="info-value">{clusterInfo.clusterName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Version:</span>
            <span className="info-value">{clusterInfo.clusterVersion}</span>
          </div>
        </div>
      </div>

      <div className="overview-section stats-section">
        <h2 className="section-title">Resource Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Nodes</div>
            <div className="stat-value">
              {stats.readyNodes}/{stats.totalNodes}
            </div>
            <div className="stat-detail">Ready/Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pods</div>
            <div className="stat-value">
              {stats.runningPods}/{stats.totalPods}
            </div>
            <div className="stat-detail">Running/Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Namespaces</div>
            <div className="stat-value">{stats.namespaceCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">CPU Usage</div>
            <div className="stat-value">{stats.cpuUsage}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Memory Usage</div>
            <div className="stat-value">{stats.memoryUsage}</div>
          </div>
        </div>
      </div>

      <div className="overview-section resources-section">
        <div className="resource-container">
          <div className="resource-list-container">
            <div className="resource-header">
              <h3 className="resource-title">Nodes ({nodes.length})</h3>
            </div>
            <div className="resource-scroll">
              <table className="resource-mini-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>CPU</th>
                    <th>Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map(node => (
                    <tr key={node.name}>
                      <td>{node.name}</td>
                      <td>
                        <span className={`status-badge ${node.status.toLowerCase()}`}>
                          {node.status}
                        </span>
                      </td>
                      <td>{node.cpu}</td>
                      <td>{node.memory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="resource-list-container">
            <div className="resource-header">
              <h3 className="resource-title">Pods ({pods.length})</h3>
            </div>
            <div className="resource-scroll">
              <table className="resource-mini-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Namespace</th>
                    <th>Status</th>
                    <th>Node</th>
                  </tr>
                </thead>
                <tbody>
                  {pods.map((pod, index) => (
                    <tr key={`${pod.namespace}-${pod.name}-${index}`}>
                      <td className="pod-name">{pod.name}</td>
                      <td>{pod.namespace}</td>
                      <td>
                        <span className={`status-badge ${pod.status.toLowerCase()}`}>
                          {pod.status}
                        </span>
                      </td>
                      <td>{pod.node}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClusterOverview;
