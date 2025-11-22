import { ClusterContextTab } from '../types/panel';
import { useTabContextMenu } from './useTabContextMenu';

interface ClusterTabsProps {
  tabs: ClusterContextTab[];
  activeContextId: string | undefined;
  onSelectCluster: (tab: ClusterContextTab) => void;
  onCloseCluster: (tab: ClusterContextTab) => void;
  onReloadCluster?: (tab: ClusterContextTab) => void;
  onSplitRight?: (tab: ClusterContextTab) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  tabs,
  activeContextId,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
  onReloadCluster,
  onSplitRight,
}: ClusterTabsProps) {
  const { handleContextMenu } = useTabContextMenu({
    tabs,
    onCloseTab: onCloseCluster,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  return (
    <div className="cluster-tabs">
      {tabs.map(tab => {
        return (
          <div
            key={tab.id}
            className={`cluster-tab ${activeContextId === tab.clusterContext.id ? 'active' : ''}`}
            onClick={() => onClusterSelect(tab)}
            onContextMenu={e => handleContextMenu(e, tab)}
          >
            {tab.clusterContext.clusterName}
            <button
              onClick={e => {
                e.stopPropagation();
                onCloseCluster(tab);
              }}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ClusterTabs;
