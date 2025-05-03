import React, { useState } from 'react';
import './ClusterInfoPane.css';

// Define resource groups and their kinds
const resourceGroups = [
  { groupName: 'Overview', kinds: ['Overview'], isSingle: true }, // Special case for single item group
  { groupName: 'Cluster', kinds: ['Nodes', 'Namespaces', 'Events'] },
  {
    groupName: 'Workloads',
    kinds: ['Pods', 'Deployments', 'ReplicaSets', 'StatefulSets', 'DaemonSets', 'Jobs', 'CronJobs'],
  },
  {
    groupName: 'Network',
    kinds: ['Services', 'Ingresses', 'NetworkPolicies'], // Added NetworkPolicies
  },
  {
    groupName: 'Storage',
    kinds: ['PersistentVolumes', 'PersistentVolumeClaims', 'StorageClasses'], // Added StorageClasses
  },
  {
    groupName: 'Configuration',
    kinds: ['ConfigMaps', 'Secrets'],
  },
  {
    groupName: 'RBAC', // Added RBAC Group
    kinds: ['Roles', 'ClusterRoles', 'RoleBindings', 'ClusterRoleBindings', 'ServiceAccounts'],
  },
  { groupName: 'Custom Resources', kinds: ['CRDs'] }, // Placeholder for CRDs, needs dynamic loading later
];

interface ResourceKindSidebarProps {
  selectedKind: string | null;
  onKindSelect: (kind: string) => void;
}

/**
 * Sidebar component to display list of resource kinds.
 * @param selectedKind Currently selected resource kind.
 * @param onKindSelect Callback function when a kind is selected.
 */
const ResourceKindSidebar: React.FC<ResourceKindSidebarProps> = ({
  selectedKind,
  onKindSelect,
}) => {
  // State to keep track of expanded groups (using a Set for efficient add/remove)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Overview', 'Cluster', 'Workloads'])
  ); // Default expanded groups

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prevExpanded => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(groupName)) {
        newExpanded.delete(groupName);
      } else {
        newExpanded.add(groupName);
      }
      return newExpanded;
    });
  };

  return (
    <div className="resource-kind-sidebar">
      {resourceGroups.map(({ groupName, kinds, isSingle }) => {
        const isExpanded = expandedGroups.has(groupName);
        // Handle single-item groups like Overview directly as a selectable item
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

        // Render expandable groups
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
  );
};

export default ResourceKindSidebar;
