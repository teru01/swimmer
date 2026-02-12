import React, { useState, useEffect } from 'react';
import './ClusterInfoPane.css';
import { commands, CrdGroup } from '../../api/commands';

export const resourceGroups = [
  {
    groupName: 'Overview',
    kinds: ['Overview'],
    isSingle: true,
  },
  {
    groupName: 'Cluster',
    kinds: ['Nodes', 'Namespaces', 'Events'],
  },
  {
    groupName: 'Workloads',
    kinds: [
      'Pods',
      'Deployments',
      'ReplicaSets',
      'StatefulSets',
      'DaemonSets',
      'Jobs',
      'CronJobs',
      'HorizontalPodAutoscalers',
    ],
  },
  {
    groupName: 'Network',
    kinds: ['Services', 'Endpoints', 'Ingresses', 'NetworkPolicies'],
  },
  {
    groupName: 'Storage',
    kinds: ['PersistentVolumes', 'PersistentVolumeClaims', 'StorageClasses'],
  },
  {
    groupName: 'Configuration',
    kinds: ['ConfigMaps', 'Secrets', 'LimitRanges', 'ResourceQuotas'],
  },
  {
    groupName: 'RBAC',
    kinds: ['Roles', 'ClusterRoles', 'RoleBindings', 'ClusterRoleBindings', 'ServiceAccounts'],
  },
  {
    groupName: 'Custom Resources',
    kinds: [],
  },
];

interface ResourceKindSidebarProps {
  selectedKind: string | undefined;
  onKindSelect: (kind: string) => void;
  expandedGroups: Set<string>;
  onExpandedGroupsChange: (expandedGroups: Set<string>) => void;
  contextId?: string;
}

const handleKeyDownActivate = (e: React.KeyboardEvent, action: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

const ResourceKindSidebar: React.FC<ResourceKindSidebarProps> = ({
  selectedKind,
  onKindSelect,
  expandedGroups,
  onExpandedGroupsChange,
  contextId,
}) => {
  const [crdGroups, setCrdGroups] = useState<CrdGroup[]>([]);
  const [crdLoading, setCrdLoading] = useState(false);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    onExpandedGroupsChange(newExpanded);
  };

  useEffect(() => {
    setCrdGroups([]);
  }, [contextId]);

  useEffect(() => {
    if (!expandedGroups.has('Custom Resources')) return;
    if (crdGroups.length > 0) return;

    let cancelled = false;
    const load = async () => {
      setCrdLoading(true);
      try {
        const groups = await commands.listCrdGroups(contextId);
        if (!cancelled) {
          setCrdGroups(groups);
        }
      } catch (err) {
        console.error('Failed to fetch CRD groups:', err);
      } finally {
        if (!cancelled) {
          setCrdLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [expandedGroups, contextId, crdGroups.length]);

  return (
    <nav className="resource-kind-sidebar" aria-label="Resource kinds">
      <div className="content">
        {resourceGroups.map(({ groupName, kinds, isSingle }) => {
          const isExpanded = expandedGroups.has(groupName);

          if (isSingle && kinds.length === 1) {
            const kind = kinds[0];
            return (
              <div key={groupName} className="resource-group single-item-group">
                <div
                  className={`group-header ${selectedKind === kind ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-selected={selectedKind === kind}
                  onClick={() => onKindSelect(kind)}
                  onKeyDown={e => handleKeyDownActivate(e, () => onKindSelect(kind))}
                >
                  {groupName}
                </div>
              </div>
            );
          }

          if (groupName === 'Custom Resources') {
            return (
              <div key={groupName} className="resource-group">
                <div
                  className={`group-header ${isExpanded ? 'expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(groupName)}
                  onKeyDown={e => handleKeyDownActivate(e, () => toggleGroup(groupName))}
                >
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  {groupName}
                </div>
                {isExpanded && (
                  <div className="kind-list">
                    {crdLoading && (
                      <div className="cr-loading">
                        <div className="cr-loading-spinner"></div>
                        <span>Loading...</span>
                      </div>
                    )}
                    {!crdLoading && crdGroups.length === 0 && (
                      <div className="cr-empty">No custom resources</div>
                    )}
                    {crdGroups.map(crdGroup => {
                      const subGroupKey = `CR:${crdGroup.group}`;
                      const isSubExpanded = expandedGroups.has(subGroupKey);
                      return (
                        <div key={crdGroup.group} className="cr-sub-group">
                          <div
                            className={`cr-sub-group-header ${isSubExpanded ? 'expanded' : ''}`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isSubExpanded}
                            onClick={() => toggleGroup(subGroupKey)}
                            onKeyDown={e =>
                              handleKeyDownActivate(e, () => toggleGroup(subGroupKey))
                            }
                          >
                            <span className="expand-icon">{isSubExpanded ? '▼' : '▶'}</span>
                            {crdGroup.group}
                          </div>
                          {isSubExpanded && (
                            <ul className="cr-kind-list" role="listbox">
                              {crdGroup.resources.map(res => {
                                const kindKey = `cr:${res.group}/${res.version}/${res.plural}/${res.scope}`;
                                return (
                                  <li
                                    key={kindKey}
                                    role="option"
                                    tabIndex={0}
                                    aria-selected={selectedKind === kindKey}
                                    className={selectedKind === kindKey ? 'selected' : ''}
                                    onClick={() => onKindSelect(kindKey)}
                                    onKeyDown={e =>
                                      handleKeyDownActivate(e, () => onKindSelect(kindKey))
                                    }
                                  >
                                    {res.kind}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={groupName} className="resource-group">
              <div
                className={`group-header ${isExpanded ? 'expanded' : ''}`}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => toggleGroup(groupName)}
                onKeyDown={e => handleKeyDownActivate(e, () => toggleGroup(groupName))}
              >
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                {groupName}
              </div>
              {isExpanded && (
                <ul className="kind-list" role="listbox">
                  {kinds.map(kind => (
                    <li
                      key={kind}
                      role="option"
                      tabIndex={0}
                      aria-selected={selectedKind === kind}
                      className={selectedKind === kind ? 'selected' : ''}
                      onClick={() => onKindSelect(kind)}
                      onKeyDown={e => handleKeyDownActivate(e, () => onKindSelect(kind))}
                    >
                      {kind}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default ResourceKindSidebar;
