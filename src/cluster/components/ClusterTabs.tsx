import { ClusterContextTab } from '../types/panel';
import { useTabContextMenu } from './useTabContextMenu';

interface ClusterTabsProps {
  tabs: ClusterContextTab[];
  activeContextId: string | undefined;
  activePanelId: string;
  onSelectCluster: (tab: ClusterContextTab) => void;
  onCloseCluster: (tab: ClusterContextTab) => void;
  onCloseOtherTabs?: (tab: ClusterContextTab) => void;
  onReloadCluster?: (tab: ClusterContextTab) => void;
  onSplitRight?: (tab: ClusterContextTab) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  tabs,
  activeContextId,
  activePanelId,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
  onCloseOtherTabs,
  onReloadCluster,
  onSplitRight,
}: ClusterTabsProps) {
  const { handleContextMenu } = useTabContextMenu({
    tabs,
    onCloseTab: onCloseCluster,
    onCloseOtherTabs,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  return (
    <div className="cluster-tabs">
      {tabs.map(tab => {
        const isActive = activeContextId === tab.clusterContext.id;
        const isPanelActive = tab.panelId === activePanelId;
        const shouldDim = !isPanelActive || (isPanelActive && !isActive);

        return (
          <div
            key={tab.id}
            className={`cluster-tab ${isActive ? 'active' : ''} ${shouldDim ? 'dimmed' : ''}`}
            onClick={() => onClusterSelect(tab)}
            onContextMenu={e => handleContextMenu(e, tab)}
          >
            <span className="tab-label">{tab.clusterContext.clusterName}</span>
            <button
              className="close-button"
              onClick={e => {
                e.stopPropagation();
                onCloseCluster(tab);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ClusterTabs;
