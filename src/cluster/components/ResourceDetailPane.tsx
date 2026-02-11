import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ClusterInfoPane.css';
import { KubeResource } from './ResourceList';
import { formatAge } from '../../lib/utils';
import { commands } from '../../api/commands';
import { stringify as yamlStringify } from 'yaml';

interface ResourceDetailPaneProps {
  resource: KubeResource | undefined;
  events?: KubeResource[];
  isLoading?: boolean;
  onClose: () => void;
  contextId?: string;
  onNavigateToResourceInNewPanel?: (pod: KubeResource, contextId: string) => void;
  isActivePanel?: boolean;
}

// Helper component to render key-value pairs nicely
const DetailItem: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="detail-item">
    <span className="detail-label">{label}:</span>
    <span className="detail-value">{children || '-'}</span>
  </div>
);

/** Returns a status category string for container state to apply color styling. */
const getContainerStateCategory = (state: any): string => {
  if (!state) return 'default';
  const key = Object.keys(state)[0]?.toLowerCase();
  if (key === 'running') return 'success';
  if (key === 'waiting') return 'warning';
  if (key === 'terminated') {
    const reason = state.terminated?.reason?.toLowerCase() || '';
    if (reason === 'completed') return 'success';
    return 'error';
  }
  return 'default';
};

const VALUE_COLLAPSE_THRESHOLD = 80;

/** Tiny inline copy button. */
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button className="metadata-copy-btn" onClick={handleCopy} type="button" title="Copy">
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25z" />
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25z" />
        </svg>
      )}
    </button>
  );
};

/** A single metadata entry whose value collapses when it exceeds the threshold. */
const MetadataEntry: React.FC<{ entryKey: string; value: string }> = ({ entryKey, value }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > VALUE_COLLAPSE_THRESHOLD;

  return (
    <li>
      <span className="metadata-key-col">
        <span className="metadata-key">{entryKey}</span>
        <CopyButton text={entryKey} />
      </span>
      <span className="metadata-value-col">
        <span className={`metadata-value ${isLong && !expanded ? 'value-collapsed' : ''}`}>
          {value}
        </span>
        <CopyButton text={value} />
        {isLong && (
          <button
            className="metadata-value-toggle"
            onClick={() => setExpanded(prev => !prev)}
            type="button"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
    </li>
  );
};

/** Renders a metadata map with long values collapsed by default. */
const CollapsibleMetadataMap: React.FC<{ map: { [key: string]: string } | undefined }> = ({
  map,
}) => {
  if (!map || Object.keys(map).length === 0) {
    return <span className="detail-value">-</span>;
  }

  return (
    <ul className="metadata-list">
      {Object.entries(map).map(([key, value]) => (
        <MetadataEntry key={key} entryKey={key} value={value} />
      ))}
    </ul>
  );
};

const ENV_VARS_COLLAPSE_THRESHOLD = 3;
const ENV_VARS_INITIAL_DISPLAY = 2;

/** Displays container environment variables that have direct values (not valueFrom). */
const ContainerEnvVars: React.FC<{ env: { name: string; value?: string; valueFrom?: any }[] }> = ({
  env,
}) => {
  const [expanded, setExpanded] = useState(false);
  const directEnvVars = env.filter(e => !e.valueFrom && e.value !== undefined);

  if (directEnvVars.length === 0) return undefined;

  const shouldCollapse = directEnvVars.length >= ENV_VARS_COLLAPSE_THRESHOLD;
  const displayedVars =
    shouldCollapse && !expanded ? directEnvVars.slice(0, ENV_VARS_INITIAL_DISPLAY) : directEnvVars;
  const hiddenCount = directEnvVars.length - ENV_VARS_INITIAL_DISPLAY;

  return (
    <div className="env-vars-section">
      <span className="env-vars-label-col">
        <span className="detail-label">Env:</span>
        {shouldCollapse && (
          <button
            className="metadata-value-toggle"
            onClick={() => setExpanded(prev => !prev)}
            type="button"
          >
            {expanded ? 'Hide' : `Show ${hiddenCount} more`}
          </button>
        )}
      </span>
      <ul className="env-vars-list">
        {displayedVars.map(e => (
          <li key={e.name} className="env-var-item">
            <span className="env-var-name">{e.name}</span>
            <span className="env-var-separator">=</span>
            <span className="env-var-value">{e.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Collects unique ConfigMap names referenced by a container. */
const getContainerConfigMapRefs = (container: any, volumes: any[] | undefined): string[] => {
  const refs = new Set<string>();
  container.envFrom?.forEach((ef: any) => {
    if (ef.configMapRef?.name) refs.add(ef.configMapRef.name);
  });
  container.env?.forEach((e: any) => {
    if (e.valueFrom?.configMapKeyRef?.name) refs.add(e.valueFrom.configMapKeyRef.name);
  });
  const mountedVolumeNames = new Set((container.volumeMounts || []).map((vm: any) => vm.name));
  volumes?.forEach((v: any) => {
    if (mountedVolumeNames.has(v.name) && v.configMap?.name) {
      refs.add(v.configMap.name);
    }
  });
  return Array.from(refs);
};

/** Collects unique Secret names referenced by a container. */
const getContainerSecretRefs = (container: any, volumes: any[] | undefined): string[] => {
  const refs = new Set<string>();
  container.envFrom?.forEach((ef: any) => {
    if (ef.secretRef?.name) refs.add(ef.secretRef.name);
  });
  container.env?.forEach((e: any) => {
    if (e.valueFrom?.secretKeyRef?.name) refs.add(e.valueFrom.secretKeyRef.name);
  });
  const mountedVolumeNames = new Set((container.volumeMounts || []).map((vm: any) => vm.name));
  volumes?.forEach((v: any) => {
    if (mountedVolumeNames.has(v.name) && v.secret?.secretName) {
      refs.add(v.secret.secretName);
    }
  });
  return Array.from(refs);
};

/** Filters pods that match the deployment's selector matchLabels. */
const filterPodsForDeployment = (
  pods: KubeResource[],
  matchLabels: { [key: string]: string }
): KubeResource[] => {
  return pods.filter(pod => {
    const podLabels = pod.metadata.labels || {};
    return Object.entries(matchLabels).every(([key, value]) => podLabels[key] === value);
  });
};

/** Returns the total restart count across all containers in a pod. */
const getPodRestarts = (pod: KubeResource): number => {
  const statuses = pod.status?.containerStatuses || [];
  return statuses.reduce((sum, cs) => sum + (cs.restartCount || 0), 0);
};

/** Section component that lists pods belonging to a deployment. */
const DeploymentPodsSection: React.FC<{
  deployment: KubeResource;
  contextId: string | undefined;
  onNavigateToResourceInNewPanel?: (pod: KubeResource, contextId: string) => void;
}> = ({ deployment, contextId, onNavigateToResourceInNewPanel }) => {
  const [pods, setPods] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const matchLabels = deployment.spec?.selector?.matchLabels;
  const matchLabelsRef = useRef(matchLabels);
  matchLabelsRef.current = matchLabels;
  const matchLabelsKey = JSON.stringify(matchLabels);
  const namespace = deployment.metadata.namespace;

  useEffect(() => {
    const labels = matchLabelsRef.current;
    if (!contextId || !labels || Object.keys(labels).length === 0) {
      setPods([]);
      return;
    }

    let cancelled = false;
    const fetchPods = async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const allPods = await commands.listResources(contextId, 'Pods', namespace);
        if (!cancelled) {
          setPods(filterPodsForDeployment(allPods as KubeResource[], matchLabelsRef.current!));
        }
      } catch (error) {
        console.error('Failed to fetch pods for deployment:', error);
        if (!cancelled && !silent) {
          setPods([]);
        }
      } finally {
        if (!cancelled && !silent) {
          setIsLoading(false);
        }
      }
    };

    fetchPods(false);
    const intervalId = setInterval(() => fetchPods(true), 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, namespace, matchLabelsKey]);

  const handlePodClick = (pod: KubeResource) => {
    if (onNavigateToResourceInNewPanel && contextId) {
      onNavigateToResourceInNewPanel(pod, contextId);
    }
  };

  return (
    <section className="detail-section">
      <h4>Pods</h4>
      {isLoading ? (
        <div className="detail-value">Loading pods...</div>
      ) : pods.length === 0 ? (
        <div className="detail-value">No pods found</div>
      ) : (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Restarts</th>
            </tr>
          </thead>
          <tbody>
            {pods.map(pod => (
              <tr key={pod.metadata.uid} className="pod-row" onClick={() => handlePodClick(pod)}>
                <td>{pod.metadata.name}</td>
                <td>
                  <span
                    className={`status-badge ${(pod.status?.phase || 'unknown').toLowerCase()}`}
                  >
                    {pod.status?.phase || 'Unknown'}
                  </span>
                </td>
                <td>{getPodRestarts(pod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

/** Section component that lists pods belonging to a replicaset. */
const ReplicaSetPodsSection: React.FC<{
  replicaSet: KubeResource;
  contextId: string | undefined;
  onNavigateToResourceInNewPanel?: (pod: KubeResource, contextId: string) => void;
}> = ({ replicaSet, contextId, onNavigateToResourceInNewPanel }) => {
  const [pods, setPods] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const matchLabels = replicaSet.spec?.selector?.matchLabels;
  const matchLabelsRef = useRef(matchLabels);
  matchLabelsRef.current = matchLabels;
  const matchLabelsKey = JSON.stringify(matchLabels);
  const namespace = replicaSet.metadata.namespace;
  const replicaSetName = replicaSet.metadata.name;

  useEffect(() => {
    const labels = matchLabelsRef.current;
    if (!contextId || !labels || Object.keys(labels).length === 0) {
      setPods([]);
      return;
    }

    let cancelled = false;
    const fetchPods = async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const allPods = await commands.listResources(contextId, 'Pods', namespace);
        if (!cancelled) {
          const filtered = filterPodsForDeployment(
            allPods as KubeResource[],
            matchLabelsRef.current!
          );
          const owned = filtered.filter(pod =>
            pod.metadata.ownerReferences?.some(
              ref => ref.kind === 'ReplicaSet' && ref.name === replicaSetName
            )
          );
          setPods(owned);
        }
      } catch (error) {
        console.error('Failed to fetch pods for replicaset:', error);
        if (!cancelled && !silent) {
          setPods([]);
        }
      } finally {
        if (!cancelled && !silent) {
          setIsLoading(false);
        }
      }
    };

    fetchPods(false);
    const intervalId = setInterval(() => fetchPods(true), 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, namespace, matchLabelsKey, replicaSetName]);

  const handlePodClick = (pod: KubeResource) => {
    if (onNavigateToResourceInNewPanel && contextId) {
      onNavigateToResourceInNewPanel(pod, contextId);
    }
  };

  return (
    <section className="detail-section">
      <h4>Pods</h4>
      {isLoading ? (
        <div className="detail-value">Loading pods...</div>
      ) : pods.length === 0 ? (
        <div className="detail-value">No pods found</div>
      ) : (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Restarts</th>
            </tr>
          </thead>
          <tbody>
            {pods.map(pod => (
              <tr key={pod.metadata.uid} className="pod-row" onClick={() => handlePodClick(pod)}>
                <td>{pod.metadata.name}</td>
                <td>
                  <span
                    className={`status-badge ${(pod.status?.phase || 'unknown').toLowerCase()}`}
                  >
                    {pod.status?.phase || 'Unknown'}
                  </span>
                </td>
                <td>{getPodRestarts(pod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

/** Section component that lists pods running on a node. */
const NodePodsSection: React.FC<{
  node: KubeResource;
  contextId: string | undefined;
  onNavigateToResourceInNewPanel?: (resource: KubeResource, contextId: string) => void;
}> = ({ node, contextId, onNavigateToResourceInNewPanel }) => {
  const [pods, setPods] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const nodeName = node.metadata.name;

  useEffect(() => {
    if (!contextId || !nodeName) {
      setPods([]);
      return;
    }

    let cancelled = false;
    const fetchPods = async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const allPods = (await commands.listResources(
          contextId,
          'Pods',
          undefined
        )) as KubeResource[];
        if (!cancelled) {
          setPods(allPods.filter(pod => pod.spec?.nodeName === nodeName));
        }
      } catch (error) {
        console.error('Failed to fetch pods for node:', error);
        if (!cancelled && !silent) {
          setPods([]);
        }
      } finally {
        if (!cancelled && !silent) {
          setIsLoading(false);
        }
      }
    };

    fetchPods(false);
    const intervalId = setInterval(() => fetchPods(true), 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [contextId, nodeName]);

  const handlePodClick = (pod: KubeResource) => {
    if (onNavigateToResourceInNewPanel && contextId) {
      onNavigateToResourceInNewPanel(pod, contextId);
    }
  };

  return (
    <section className="detail-section">
      <h4>Pods</h4>
      {isLoading ? (
        <div className="detail-value">Loading pods...</div>
      ) : pods.length === 0 ? (
        <div className="detail-value">No pods found</div>
      ) : (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Namespace</th>
              <th>Status</th>
              <th>Restarts</th>
            </tr>
          </thead>
          <tbody>
            {pods.map(pod => (
              <tr key={pod.metadata.uid} className="pod-row" onClick={() => handlePodClick(pod)}>
                <td>{pod.metadata.name}</td>
                <td>{pod.metadata.namespace || '-'}</td>
                <td>
                  <span
                    className={`status-badge ${(pod.status?.phase || 'unknown').toLowerCase()}`}
                  >
                    {pod.status?.phase || 'Unknown'}
                  </span>
                </td>
                <td>{getPodRestarts(pod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

/**
 * Pane component to display details of the selected resource.
 * @param resource Currently selected resource object.
 * @param isLoading Loading state of the resource.
 * @param onClose Callback function when the pane is closed.
 */
const ResourceDetailPane: React.FC<ResourceDetailPaneProps> = ({
  resource,
  events: eventsProp = [],
  isLoading,
  onClose,
  contextId,
  onNavigateToResourceInNewPanel,
  isActivePanel,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showRawYaml, setShowRawYaml] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const highlightClass = 'detail-search-highlight';
  const activeHighlightClass = 'detail-search-highlight-active';

  const rawYamlContent = useMemo(() => {
    if (!resource) return '';
    return yamlStringify(resource, { lineWidth: 0 });
  }, [resource]);

  const clearHighlights = useCallback(() => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll(`mark.${highlightClass}`);
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  }, []);

  const applyHighlights = useCallback(
    (query: string) => {
      clearHighlights();
      if (!contentRef.current || !query.trim()) {
        setMatchCount(0);
        setCurrentMatch(0);
        return;
      }

      const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'MARK' || parent.closest('.detail-search-bar'))) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      const lowerQuery = query.toLowerCase();
      let total = 0;

      for (const textNode of textNodes) {
        const text = textNode.textContent || '';
        const lowerText = text.toLowerCase();
        if (!lowerText.includes(lowerQuery)) continue;

        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let idx = lowerText.indexOf(lowerQuery, lastIdx);

        while (idx !== -1) {
          if (idx > lastIdx) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
          }
          const mark = document.createElement('mark');
          mark.className = highlightClass;
          mark.dataset.matchIndex = String(total);
          mark.textContent = text.slice(idx, idx + query.length);
          frag.appendChild(mark);
          total++;
          lastIdx = idx + query.length;
          idx = lowerText.indexOf(lowerQuery, lastIdx);
        }

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }

        textNode.parentNode?.replaceChild(frag, textNode);
      }

      setMatchCount(total);
      setCurrentMatch(total > 0 ? 1 : 0);

      if (total > 0) {
        const first = contentRef.current.querySelector(
          `mark.${highlightClass}[data-match-index="0"]`
        );
        first?.classList.add(activeHighlightClass);
        first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [clearHighlights]
  );

  const jumpToMatch = useCallback(
    (index: number) => {
      if (!contentRef.current || matchCount === 0) return;
      const marks = contentRef.current.querySelectorAll(`mark.${highlightClass}`);
      marks.forEach(m => m.classList.remove(activeHighlightClass));
      const target = marks[index - 1];
      if (target) {
        target.classList.add(activeHighlightClass);
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [matchCount]
  );

  const handleSearchNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    jumpToMatch(next);
  }, [currentMatch, matchCount, jumpToMatch]);

  const handleSearchPrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = currentMatch <= 1 ? matchCount : currentMatch - 1;
    setCurrentMatch(prev);
    jumpToMatch(prev);
  }, [currentMatch, matchCount, jumpToMatch]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchText('');
    clearHighlights();
    setMatchCount(0);
    setCurrentMatch(0);
  }, [clearHighlights]);

  useEffect(() => {
    if (!isActivePanel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 0);
      }
      if (e.key === 'Escape' && searchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActivePanel, searchOpen, closeSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      applyHighlights(searchText);
    }, 150);
    return () => clearTimeout(timeout);
  }, [searchText, applyHighlights]);

  useEffect(() => {
    closeSearch();
  }, [resource?.metadata?.uid]);
  if (isLoading) {
    return (
      <div className="resource-detail-pane loading">
        <button onClick={onClose} className="close-button" title="Close details">
          ✕
        </button>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading resource details...</span>
        </div>
      </div>
    );
  }

  if (!resource) {
    return undefined;
  }

  const resourceKind = resource.kind || 'Unknown';

  const renderEvents = () => {
    if (eventsProp.length === 0) {
      return (
        <section className="detail-section">
          <h4>Events</h4>
          <div className="detail-value">No events found</div>
        </section>
      );
    }

    return (
      <section className="detail-section">
        <h4>Events</h4>
        <table className="detail-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Count</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {eventsProp.map((event, index) => {
              const eventType = ((event as any).type || 'Normal').toLowerCase();
              return (
                <tr key={`${event.metadata.name}-${index}`}>
                  <td>
                    <span className={`status-badge ${eventType}`}>
                      {(event as any).type || 'Normal'}
                    </span>
                  </td>
                  <td>{(event as any).reason || '-'}</td>
                  <td>{(event as any).message || '-'}</td>
                  <td>{(event as any).count || 1}</td>
                  <td>{formatAge(event.metadata.creationTimestamp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  };

  const renderDeploymentDetails = (deployment: KubeResource) => {
    const { metadata, spec, status } = deployment;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{`${status?.readyReplicas ?? 0}/${status?.replicas ?? 0}`}</DetailItem>
          <DetailItem label="Up-to-date">{status?.updatedReplicas ?? 0}</DetailItem>
          <DetailItem label="Available">{status?.availableReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <DeploymentPodsSection
          deployment={deployment}
          contextId={contextId}
          onNavigateToResourceInNewPanel={onNavigateToResourceInNewPanel}
        />

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{c.reason || '-'}</td>
                  <td>{c.message || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderServiceDetails = (service: KubeResource) => {
    const { metadata, spec, status } = service;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Type">{spec?.type || 'ClusterIP'}</DetailItem>
          <DetailItem label="Cluster IP">{spec?.clusterIP || '-'}</DetailItem>
          <DetailItem label="External IP">
            {spec?.externalIPs?.join(', ') ||
              status?.loadBalancer?.ingress?.map(i => i.ip || i.hostname).join(', ') ||
              '<none>'}
          </DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Ports</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Target Port</th>
                <th>Node Port</th>
              </tr>
            </thead>
            <tbody>
              {spec?.ports?.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.name || '-'}</td>
                  <td>{p.protocol || 'TCP'}</td>
                  <td>{p.port}</td>
                  <td>{p.targetPort || '-'}</td>
                  <td>{p.nodePort || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {
            <CollapsibleMetadataMap
              map={spec?.selector as unknown as { [key: string]: string } | undefined}
            />
          }
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderNodeDetails = (node: KubeResource) => {
    const { metadata, status } = node;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Roles">
            {Object.keys(metadata.labels || {})
              .filter(k => k.startsWith('node-role.kubernetes.io/'))
              .map(k => k.replace('node-role.kubernetes.io/', ''))
              .join(', ') || '<none>'}
          </DetailItem>
          <DetailItem label="Kubelet Version">{status?.nodeInfo?.kubeletVersion || '-'}</DetailItem>
          <DetailItem label="Container Runtime">
            {status?.nodeInfo?.containerRuntimeVersion || '-'}
          </DetailItem>
          <DetailItem label="OS Image">{status?.nodeInfo?.osImage || '-'}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <NodePodsSection
          node={node}
          contextId={contextId}
          onNavigateToResourceInNewPanel={onNavigateToResourceInNewPanel}
        />

        <section className="detail-section">
          <h4>Addresses</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {status?.addresses?.map((addr, idx) => (
                <tr key={idx}>
                  <td>{addr.type}</td>
                  <td>{addr.address}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={2}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{c.reason || '-'}</td>
                  <td>{c.message || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Capacity</h4>
          {<CollapsibleMetadataMap map={status?.capacity} />}
        </section>

        <section className="detail-section">
          <h4>Allocatable</h4>
          {<CollapsibleMetadataMap map={status?.allocatable} />}
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>
        {renderEvents()}
      </>
    );
  };

  const renderReplicaSetDetails = (rs: KubeResource) => {
    const { metadata, spec, status } = rs;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Controlled By">
            {metadata.ownerReferences?.[0] ? (
              <span
                className="resource-ref-link"
                onClick={() => {
                  const owner = metadata.ownerReferences![0];
                  if (onNavigateToResourceInNewPanel && contextId) {
                    onNavigateToResourceInNewPanel(
                      {
                        kind: owner.kind,
                        metadata: {
                          name: owner.name,
                          namespace: metadata.namespace,
                          uid: owner.uid || '',
                        },
                      },
                      contextId
                    );
                  }
                }}
              >
                {`${metadata.ownerReferences[0].kind}/${metadata.ownerReferences[0].name}`}
              </span>
            ) : (
              '-'
            )}
          </DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Current">{status?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{status?.readyReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <ReplicaSetPodsSection
          replicaSet={rs}
          contextId={contextId}
          onNavigateToResourceInNewPanel={onNavigateToResourceInNewPanel}
        />

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderStatefulSetDetails = (sts: KubeResource) => {
    const { metadata, spec, status } = sts;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{`${status?.readyReplicas ?? 0}/${status?.replicas ?? 0}`}</DetailItem>
          <DetailItem label="Current">{status?.currentReplicas ?? 0}</DetailItem>
          <DetailItem label="Updated">{status?.updatedReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderDaemonSetDetails = (ds: KubeResource) => {
    const { metadata, spec, status } = ds;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Desired">{status?.desiredNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Current">{status?.currentNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Ready">{status?.numberReady ?? 0}</DetailItem>
          <DetailItem label="Available">{status?.numberAvailable ?? 0}</DetailItem>
          <DetailItem label="Up-to-date">{status?.updatedNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderIngressDetails = (ingress: KubeResource) => {
    const { metadata, spec, status } = ingress;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Ingress Class">{spec?.ingressClassName || '<none>'}</DetailItem>
          <DetailItem label="Address">
            {status?.loadBalancer?.ingress
              ?.map(i => i.ip || i.hostname)
              .filter(Boolean)
              .join(', ') || '-'}
          </DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {spec?.rules && spec.rules.length > 0 && (
          <section className="detail-section">
            <h4>Rules</h4>
            {spec.rules.map((rule, idx) => (
              <div key={idx} style={{ marginBottom: '15px' }}>
                <DetailItem label="Host">{rule.host || '*'}</DetailItem>
                {rule.http?.paths && (
                  <div style={{ marginLeft: '20px' }}>
                    <h5>Paths</h5>
                    {rule.http.paths.map((path, pidx) => (
                      <DetailItem key={pidx} label={path.path || '/'}>
                        {(path.backend as any)?.service?.name || '-'} (Port:{' '}
                        {(path.backend as any)?.service?.port?.number || '-'})
                      </DetailItem>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {spec?.tls && spec.tls.length > 0 && (
          <section className="detail-section">
            <h4>TLS</h4>
            {spec.tls.map((tls, idx) => (
              <div key={idx} style={{ marginBottom: '10px' }}>
                <DetailItem label="Hosts">{tls.hosts?.join(', ') || '-'}</DetailItem>
                <DetailItem label="Secret">{tls.secretName || '-'}</DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderConfigMapDetails = (cm: KubeResource) => {
    const { metadata, data } = cm;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Data entries">{data ? Object.keys(data).length : 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {data && Object.keys(data).length > 0 && (
          <section className="detail-section">
            <h4>Data</h4>
            {Object.entries(data).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <DetailItem label={key}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</pre>
                </DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderSecretDetails = (secret: KubeResource) => {
    const { metadata, data, type } = secret;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Type">{type || 'Opaque'}</DetailItem>
          <DetailItem label="Data entries">{data ? Object.keys(data).length : 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {data && Object.keys(data).length > 0 && (
          <section className="detail-section">
            <h4>Data</h4>
            <ul className="metadata-list">
              {Object.keys(data).map(key => (
                <li key={key}>
                  <span className="metadata-key">{key}:</span>
                  <span className="metadata-value">(hidden)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderNamespaceDetails = (ns: KubeResource) => {
    const { metadata, status } = ns;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Status">{status?.phase || 'Active'}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>
      </>
    );
  };

  const renderPodDetails = (pod: KubeResource) => {
    const { metadata, spec, status } = pod;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Priority">{(pod as any).spec?.priority ?? 0}</DetailItem>
          <DetailItem label="Service Account">{spec?.serviceAccountName || '-'}</DetailItem>
          <DetailItem label="Node">{spec?.nodeName || '-'}</DetailItem>
          <DetailItem label="Start Time">
            {status?.startTime ? new Date(status.startTime).toLocaleString() : '-'}
          </DetailItem>
          <DetailItem label="Status">{status?.phase || '-'}</DetailItem>
          <DetailItem label="IP">{status?.podIP || '-'}</DetailItem>
          <DetailItem label="IPs">
            {(pod as any).status?.podIPs?.map((ip: any) => ip.ip).join(', ') ||
              status?.podIP ||
              '-'}
          </DetailItem>
          <DetailItem label="Controlled By">
            {metadata.ownerReferences?.[0] ? (
              <span
                className="resource-ref-link"
                onClick={() => {
                  const owner = metadata.ownerReferences![0];
                  if (onNavigateToResourceInNewPanel && contextId) {
                    onNavigateToResourceInNewPanel(
                      {
                        kind: owner.kind,
                        metadata: {
                          name: owner.name,
                          namespace: metadata.namespace,
                          uid: owner.uid || '',
                        },
                      },
                      contextId
                    );
                  }
                }}
              >
                {`${metadata.ownerReferences[0].kind}/${metadata.ownerReferences[0].name}`}
              </span>
            ) : (
              '-'
            )}
          </DetailItem>
          <DetailItem label="QoS Class">{(pod as any).status?.qosClass || '-'}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Containers</h4>
          {spec?.containers?.map((container: any) => {
            const containerStatus = status?.containerStatuses?.find(
              cs => cs.name === container.name
            );
            const configMapRefs = getContainerConfigMapRefs(container, spec?.volumes);
            const secretRefs = getContainerSecretRefs(container, spec?.volumes);
            return (
              <div key={container.name} style={{ marginBottom: '15px' }}>
                <h5>{container.name}</h5>
                <DetailItem label="Image">{container.image}</DetailItem>
                <DetailItem label="Image ID">{containerStatus?.imageID || '-'}</DetailItem>
                {container.ports && container.ports.length > 0 && (
                  <DetailItem label="Ports">
                    {container.ports
                      .map(
                        (p: any) =>
                          `${p.containerPort}/${p.protocol || 'TCP'}${p.name ? ` (${p.name})` : ''}`
                      )
                      .join(', ')}
                  </DetailItem>
                )}
                <DetailItem label="State">
                  <span
                    className={`status-text status-${getContainerStateCategory(containerStatus?.state)}`}
                  >
                    {containerStatus?.state ? Object.keys(containerStatus.state)[0] : '-'}
                  </span>
                </DetailItem>
                <DetailItem label="Ready">
                  <span
                    className={`status-text status-${containerStatus?.ready ? 'success' : 'error'}`}
                  >
                    {containerStatus?.ready ? 'True' : 'False'}
                  </span>
                </DetailItem>
                <DetailItem label="Restart Count">{containerStatus?.restartCount ?? 0}</DetailItem>
                {container.env && container.env.length > 0 && (
                  <ContainerEnvVars env={container.env} />
                )}
                {container.resources?.limits && (
                  <DetailItem label="Limits">
                    CPU: {container.resources.limits.cpu || '-'}, Memory:{' '}
                    {container.resources.limits.memory || '-'}
                    {container.resources.limits['ephemeral-storage']
                      ? `, Ephemeral Storage: ${container.resources.limits['ephemeral-storage']}`
                      : ''}
                  </DetailItem>
                )}
                {container.resources?.requests && (
                  <DetailItem label="Requests">
                    CPU: {container.resources.requests.cpu || '-'}, Memory:{' '}
                    {container.resources.requests.memory || '-'}
                    {container.resources.requests['ephemeral-storage']
                      ? `, Ephemeral Storage: ${container.resources.requests['ephemeral-storage']}`
                      : ''}
                  </DetailItem>
                )}
                {container.livenessProbe && (
                  <DetailItem label="Liveness">
                    {container.livenessProbe.httpGet
                      ? `http-get ${container.livenessProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.livenessProbe.httpGet.port}${container.livenessProbe.httpGet.path}`
                      : container.livenessProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
                {container.readinessProbe && (
                  <DetailItem label="Readiness">
                    {container.readinessProbe.httpGet
                      ? `http-get ${container.readinessProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.readinessProbe.httpGet.port}${container.readinessProbe.httpGet.path}`
                      : container.readinessProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
                {container.startupProbe && (
                  <DetailItem label="Startup">
                    {container.startupProbe.httpGet
                      ? `http-get ${container.startupProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.startupProbe.httpGet.port}${container.startupProbe.httpGet.path}`
                      : container.startupProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
                {configMapRefs.length > 0 && (
                  <DetailItem label="ConfigMaps">
                    {configMapRefs.map((name, idx) => (
                      <span key={name}>
                        {idx > 0 && ', '}
                        <span
                          className="resource-ref-link"
                          onClick={() =>
                            onNavigateToResourceInNewPanel &&
                            contextId &&
                            onNavigateToResourceInNewPanel(
                              {
                                kind: 'ConfigMap',
                                metadata: {
                                  name,
                                  namespace: metadata.namespace,
                                  uid: '',
                                },
                              },
                              contextId
                            )
                          }
                        >
                          {name}
                        </span>
                      </span>
                    ))}
                  </DetailItem>
                )}
                {secretRefs.length > 0 && (
                  <DetailItem label="Secrets">
                    {secretRefs.map((name, idx) => (
                      <span key={name}>
                        {idx > 0 && ', '}
                        <span
                          className="resource-ref-link"
                          onClick={() =>
                            onNavigateToResourceInNewPanel &&
                            contextId &&
                            onNavigateToResourceInNewPanel(
                              {
                                kind: 'Secret',
                                metadata: {
                                  name,
                                  namespace: metadata.namespace,
                                  uid: '',
                                },
                              },
                              contextId
                            )
                          }
                        >
                          {name}
                        </span>
                      </span>
                    ))}
                  </DetailItem>
                )}
              </div>
            );
          }) ?? <p>-</p>}
        </section>

        {spec?.initContainers && spec.initContainers.length > 0 && (
          <section className="detail-section">
            <h4>Init Containers</h4>
            {spec.initContainers.map((container: any) => {
              const containerStatus = status?.containerStatuses?.find(
                cs => cs.name === container.name
              );
              return (
                <div key={container.name} style={{ marginBottom: '15px' }}>
                  <h5>{container.name}</h5>
                  <DetailItem label="Image">{container.image}</DetailItem>
                  <DetailItem label="Image ID">{containerStatus?.imageID || '-'}</DetailItem>
                  <DetailItem label="State">
                    <span
                      className={`status-text status-${getContainerStateCategory(containerStatus?.state)}`}
                    >
                      {containerStatus?.state ? Object.keys(containerStatus.state)[0] : '-'}
                    </span>
                  </DetailItem>
                  <DetailItem label="Ready">
                    <span
                      className={`status-text status-${containerStatus?.ready ? 'success' : 'error'}`}
                    >
                      {containerStatus?.ready ? 'True' : 'False'}
                    </span>
                  </DetailItem>
                  <DetailItem label="Restart Count">
                    {containerStatus?.restartCount ?? 0}
                  </DetailItem>
                  {container.resources?.limits && (
                    <DetailItem label="Limits">
                      CPU: {container.resources.limits.cpu || '-'}, Memory:{' '}
                      {container.resources.limits.memory || '-'}
                    </DetailItem>
                  )}
                  {container.resources?.requests && (
                    <DetailItem label="Requests">
                      CPU: {container.resources.requests.cpu || '-'}, Memory:{' '}
                      {container.resources.requests.memory || '-'}
                    </DetailItem>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={2}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {spec?.volumes && spec.volumes.length > 0 && (
          <section className="detail-section">
            <h4>Volumes</h4>
            {spec.volumes.map((v: any) => (
              <div key={v.name} style={{ marginBottom: '10px' }}>
                <DetailItem label="Name">{v.name}</DetailItem>
                <DetailItem label="Type">
                  {v.configMap
                    ? `ConfigMap (${v.configMap.name})`
                    : v.secret
                      ? `Secret (${v.secret.secretName})`
                      : v.emptyDir
                        ? 'EmptyDir'
                        : v.persistentVolumeClaim
                          ? `PersistentVolumeClaim (${v.persistentVolumeClaim.claimName})`
                          : v.projected
                            ? 'Projected'
                            : v.downwardAPI
                              ? 'DownwardAPI'
                              : 'Other'}
                </DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {(pod as any).spec?.nodeSelector && (
          <section className="detail-section">
            <h4>Node-Selectors</h4>
            {<CollapsibleMetadataMap map={(pod as any).spec.nodeSelector} />}
          </section>
        )}

        {(pod as any).spec?.tolerations && (pod as any).spec.tolerations.length > 0 && (
          <section className="detail-section">
            <h4>Tolerations</h4>
            <ul className="metadata-list">
              {(pod as any).spec.tolerations.map((t: any, idx: number) => (
                <li key={idx}>
                  {t.key}
                  {t.operator === 'Exists' ? '' : `=${t.value}`}:{t.effect || 'NoSchedule'}
                  {t.tolerationSeconds ? ` for ${t.tolerationSeconds}s` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
        {renderEvents()}
      </>
    );
  };
  // --- End Pod Renderer ---

  return (
    <div className="resource-detail-pane">
      <div className="detail-header">
        <div className="detail-title">
          <h3>{resource.metadata.name}</h3>
          <span className="resource-kind-badge">{resourceKind}</span>
        </div>
        <div className="detail-header-actions">
          <label className="yaml-toggle">
            <span className="yaml-toggle-label">YAML</span>
            <input
              type="checkbox"
              checked={showRawYaml}
              onChange={e => setShowRawYaml(e.target.checked)}
            />
            <span className="yaml-toggle-slider" />
          </label>
          <button onClick={onClose} className="close-button" title="Close details">
            ✕
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="detail-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handleSearchPrev();
                } else {
                  handleSearchNext();
                }
              }
            }}
            placeholder="Search..."
            className="detail-search-input"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="detail-search-count">
            {matchCount > 0 ? `${currentMatch}/${matchCount}` : 'No results'}
          </span>
          <button
            className="detail-search-nav-btn"
            onClick={handleSearchPrev}
            title="Previous (Shift+Enter)"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.22 9.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1-1.06 1.06L8 6.06 4.28 9.78a.75.75 0 0 1-1.06 0z" />
            </svg>
          </button>
          <button
            className="detail-search-nav-btn"
            onClick={handleSearchNext}
            title="Next (Enter)"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0z" />
            </svg>
          </button>
          <button
            className="detail-search-close-btn"
            onClick={closeSearch}
            title="Close (Esc)"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      <div className="detail-content" ref={contentRef}>
        {showRawYaml ? (
          <div className="raw-yaml-wrapper">
            <pre className="raw-yaml-lines" aria-hidden="true">
              {rawYamlContent
                .split('\n')
                .map((_, i) => i + 1)
                .join('\n')}
            </pre>
            <pre className="raw-yaml-content">{rawYamlContent}</pre>
          </div>
        ) : (
          <>
            {resourceKind === 'Pod' && renderPodDetails(resource)}
            {resourceKind === 'Deployment' && renderDeploymentDetails(resource)}
            {resourceKind === 'ReplicaSet' && renderReplicaSetDetails(resource)}
            {resourceKind === 'StatefulSet' && renderStatefulSetDetails(resource)}
            {resourceKind === 'DaemonSet' && renderDaemonSetDetails(resource)}
            {resourceKind === 'Service' && renderServiceDetails(resource)}
            {resourceKind === 'Ingress' && renderIngressDetails(resource)}
            {resourceKind === 'ConfigMap' && renderConfigMapDetails(resource)}
            {resourceKind === 'Secret' && renderSecretDetails(resource)}
            {resourceKind === 'Namespace' && renderNamespaceDetails(resource)}
            {resourceKind === 'Node' && renderNodeDetails(resource)}
            {![
              'Pod',
              'Deployment',
              'ReplicaSet',
              'StatefulSet',
              'DaemonSet',
              'Service',
              'Ingress',
              'ConfigMap',
              'Secret',
              'Namespace',
              'Node',
            ].includes(resourceKind) && (
              <div className="fallback-details">
                <section className="detail-section">
                  <h4>Basic Information</h4>
                  <DetailItem label="Name">{resource.metadata.name}</DetailItem>
                  <DetailItem label="Namespace">{resource.metadata.namespace}</DetailItem>
                  <DetailItem label="Age">
                    {formatAge(resource.metadata.creationTimestamp)}
                  </DetailItem>
                </section>

                {resource.status?.conditions && resource.status.conditions.length > 0 && (
                  <section className="detail-section">
                    <h4>Conditions</h4>
                    <table className="detail-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Last Transition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resource.status.conditions.map(c => (
                          <tr key={c.type}>
                            <td>{c.type}</td>
                            <td>{c.status}</td>
                            <td>{formatAge(c.lastTransitionTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                <section className="detail-section">
                  <h4>Labels</h4>
                  {<CollapsibleMetadataMap map={resource.metadata.labels} />}
                </section>

                <section className="detail-section">
                  <h4>Annotations</h4>
                  {<CollapsibleMetadataMap map={resource.metadata.annotations} />}
                </section>

                {renderEvents()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResourceDetailPane;
