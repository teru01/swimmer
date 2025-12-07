import React from 'react';
import './ClusterInfoPane.css';

// Define resource groups and their kinds
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
    kinds: ['CRDs'],
  },
];

interface ResourceKindSidebarProps {
  selectedKind: string | undefined;
  onKindSelect: (kind: string) => void;
  expandedGroups: Set<string>;
  onExpandedGroupsChange: (expandedGroups: Set<string>) => void;
}

/**
 * Sidebar component to display list of resource kinds with improved UI
 */
const ResourceKindSidebar: React.FC<ResourceKindSidebarProps> = ({
  selectedKind,
  onKindSelect,
  expandedGroups,
  onExpandedGroupsChange,
}) => {
  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    onExpandedGroupsChange(newExpanded);
  };

  return (
    <div className="resource-kind-sidebar">
      <div className="content">
        {resourceGroups.map(({ groupName, kinds, isSingle }) => {
          const isExpanded = expandedGroups.has(groupName);

          if (isSingle && kinds.length === 1) {
            const kind = kinds[0];
            return (
              <div key={groupName} className="resource-group single-item-group">
                <div
                  className={`group-header ${selectedKind === kind ? 'selected' : ''}`}
                  onClick={() => onKindSelect(kind)}
                >
                  {groupName}
                </div>
              </div>
            );
          }

          return (
            <div key={groupName} className="resource-group">
              <div
                className={`group-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleGroup(groupName)}
              >
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                {groupName}
              </div>
              {isExpanded && (
                <ul className="kind-list">
                  {kinds.map(kind => (
                    <li
                      key={kind}
                      className={selectedKind === kind ? 'selected' : ''}
                      onClick={() => onKindSelect(kind)}
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
    </div>
  );
};

export default ResourceKindSidebar;
