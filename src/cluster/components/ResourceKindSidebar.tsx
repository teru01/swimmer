import React from 'react';
import './ClusterInfoPane.css';

// Define resource kinds (example)
const resourceKinds = [
  'Nodes',
  'Pods',
  'Deployments',
  'ConfigMaps',
  'Secrets',
  'Services',
  'Custom Resources',
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
  return (
    <div className="resource-kind-sidebar">
      <h4>Resource Kinds</h4>
      <ul>
        {resourceKinds.map(kind => (
          <li
            key={kind}
            className={selectedKind === kind ? 'selected' : ''}
            onClick={() => onKindSelect(kind)}
          >
            {kind}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ResourceKindSidebar;
