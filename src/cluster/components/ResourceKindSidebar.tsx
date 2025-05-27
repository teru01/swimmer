import React, { useState } from 'react';
import './ClusterInfoPane.css';

// Define resource groups and their kinds with icons
const resourceGroups = [
  {
    groupName: 'Overview',
    kinds: ['Overview'],
    isSingle: true,
    icon: '📊',
  },
  {
    groupName: 'Cluster',
    kinds: ['Nodes', 'Namespaces', 'Events'],
    icon: '🏗️',
  },
  {
    groupName: 'Workloads',
    kinds: ['Pods', 'Deployments', 'ReplicaSets', 'StatefulSets', 'DaemonSets', 'Jobs', 'CronJobs'],
    icon: '⚙️',
  },
  {
    groupName: 'Network',
    kinds: ['Services', 'Ingresses', 'NetworkPolicies'],
    icon: '🌐',
  },
  {
    groupName: 'Storage',
    kinds: ['PersistentVolumes', 'PersistentVolumeClaims', 'StorageClasses'],
    icon: '💾',
  },
  {
    groupName: 'Configuration',
    kinds: ['ConfigMaps', 'Secrets'],
    icon: '⚙️',
  },
  {
    groupName: 'RBAC',
    kinds: ['Roles', 'ClusterRoles', 'RoleBindings', 'ClusterRoleBindings', 'ServiceAccounts'],
    icon: '🔐',
  },
  {
    groupName: 'Custom Resources',
    kinds: ['CRDs'],
    icon: '🔧',
  },
];

// Kind icons mapping
const kindIcons: Record<string, string> = {
  Overview: '📊',
  Nodes: '🖥️',
  Namespaces: '📁',
  Events: '📝',
  Pods: '📦',
  Deployments: '🚀',
  ReplicaSets: '📋',
  StatefulSets: '🗃️',
  DaemonSets: '👥',
  Jobs: '⚡',
  CronJobs: '⏰',
  Services: '🔗',
  Ingresses: '🌍',
  NetworkPolicies: '🛡️',
  PersistentVolumes: '💽',
  PersistentVolumeClaims: '📀',
  StorageClasses: '🗄️',
  ConfigMaps: '📄',
  Secrets: '🔒',
  Roles: '👤',
  ClusterRoles: '👥',
  RoleBindings: '🔗',
  ClusterRoleBindings: '🌐',
  ServiceAccounts: '🆔',
  CRDs: '🔧',
};

interface ResourceKindSidebarProps {
  selectedKind: string | null;
  onKindSelect: (kind: string) => void;
}

/**
 * Sidebar component to display list of resource kinds with improved UI
 */
const ResourceKindSidebar: React.FC<ResourceKindSidebarProps> = ({
  selectedKind,
  onKindSelect,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Overview', 'Cluster', 'Workloads'])
  );

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
      <div className="sidebar-header">
        <h3>Resources</h3>
      </div>
      <div className="content">
        {resourceGroups.map(({ groupName, kinds, isSingle, icon }) => {
          const isExpanded = expandedGroups.has(groupName);

          if (isSingle && kinds.length === 1) {
            const kind = kinds[0];
            return (
              <div key={groupName} className="resource-group single-item-group">
                <div
                  className={`group-header ${selectedKind === kind ? 'selected' : ''}`}
                  onClick={() => onKindSelect(kind)}
                >
                  <span className="group-icon">{icon}</span>
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
                <span className="group-icon">{icon}</span>
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
                      <span className="kind-icon">{kindIcons[kind] || '📄'}</span>
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
