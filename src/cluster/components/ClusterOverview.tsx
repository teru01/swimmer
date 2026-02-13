import React, { useState, useEffect, useRef } from 'react';
import './ClusterOverview.css';
import { gkeProvider } from '../../lib/providers/gke';
import { eksProvider } from '../../lib/providers/eks';
import { othersProvider } from '../../lib/providers/others';
import { commands } from '../../api';
import type { ClusterStats } from '../../api/commands';
import { getContextTags, getTagById, type Tag } from '../../lib/tag';

const PROVIDERS = [gkeProvider, eksProvider, othersProvider];

function CopyIconButton({ value }: { value: string }) {
  return (
    <button
      className="copy-icon"
      onClick={e => {
        void navigator.clipboard.writeText(value);
        e.currentTarget.blur();
      }}
      title="Copy to clipboard"
    >
      <svg
        className="copy-icon-img"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}
import { CLUSTER_OVERVIEW_REFRESH_INTERVAL_MS } from '../../lib/constants';

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
  isVisible: boolean;
  refreshKey?: number;
}

const ClusterOverview: React.FC<ClusterOverviewProps> = ({ contextId, isVisible, refreshKey }) => {
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | undefined>(undefined);
  const [stats, setStats] = useState<ClusterStats | undefined>(undefined);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLoadedRef = useRef<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      const isFirstLoad = !hasLoadedRef.current;
      if (isFirstLoad) {
        setIsLoading(true);
      }
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

        if (isFirstLoad) {
          hasLoadedRef.current = true;
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load cluster overview:', error);
        if (isFirstLoad) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    intervalRef.current = setInterval(loadData, CLUSTER_OVERVIEW_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [contextId, refreshKey]);

  if (!isVisible) {
    return null;
  }

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
            <span className="info-label">Context:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{contextId}</span>
              <CopyIconButton value={contextId} />
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">Provider:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{clusterInfo.provider}</span>
              <CopyIconButton value={clusterInfo.provider} />
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">{clusterInfo.projectOrAccountLabel}:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{clusterInfo.projectOrAccount}</span>
              <CopyIconButton value={clusterInfo.projectOrAccount} />
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">Region:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{clusterInfo.region}</span>
              <CopyIconButton value={clusterInfo.region} />
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">Cluster Name:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{clusterInfo.clusterName}</span>
              <CopyIconButton value={clusterInfo.clusterName} />
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">Version:</span>
            <div className="info-value-with-copy">
              <span className="info-value">{clusterInfo.clusterVersion}</span>
              <CopyIconButton value={clusterInfo.clusterVersion} />
            </div>
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
                <span className="info-value" style={{ color: 'var(--text-secondary)' }}>
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
