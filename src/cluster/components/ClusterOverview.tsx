import React, { useState, useEffect } from 'react';
import './ClusterOverview.css';
import { gkeProvider } from '../../lib/providers/gke';
import { eksProvider } from '../../lib/providers/eks';
import { othersProvider } from '../../lib/providers/others';
import { commands } from '../../api';
import type { ClusterStats } from '../../api/commands';
import { getContextTags, getTagById, type Tag } from '../../lib/tag';

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
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [info, statsData] = await Promise.all([
          fetchClusterInfo(contextId),
          commands.getClusterStats(contextId),
        ]);
        setClusterInfo(info);
        setStats(statsData);

        const tagIds = getContextTags(contextId);
        const loadedTags = tagIds
          .map(id => getTagById(id))
          .filter((tag): tag is Tag => tag !== undefined);
        setTags(loadedTags);
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
          <div className="info-item">
            <span className="info-label">Tag:</span>
            <div className="tags-container">
              {tags.length > 0 ? (
                tags.map(tag => (
                  <span
                    key={tag.id}
                    className="cluster-tag"
                    style={{
                      borderColor: tag.color,
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <span className="cluster-tag-dot" style={{ backgroundColor: tag.color }} />
                    <span className="cluster-tag-name">{tag.name}</span>
                  </span>
                ))
              ) : (
                <span
                  className="info-value"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  -
                </span>
              )}
            </div>
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
            <div className="stat-label">Deployment</div>
            <div className="stat-value">{stats.deploymentCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pods</div>
            <div className="stat-value">
              {stats.runningPods}/{stats.totalPods}
            </div>
            <div className="stat-detail">Running/Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Job</div>
            <div className="stat-value">{stats.jobCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Namespace</div>
            <div className="stat-value">{stats.namespaceCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClusterOverview;
