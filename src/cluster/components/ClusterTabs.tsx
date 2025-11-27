import { useRef, useEffect } from 'react';
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
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { handleContextMenu } = useTabContextMenu({
    tabs,
    onCloseTab: onCloseCluster,
    onCloseOtherTabs,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  useEffect(() => {
    if (!activeContextId || !tabsContainerRef.current) return;

    const activeTab = activeTabRefs.current.get(activeContextId);
    if (!activeTab) return;

    const container = tabsContainerRef.current;
    const tabRect = activeTab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const isTabVisible = tabRect.left >= containerRect.left && tabRect.right <= containerRect.right;

    if (!isTabVisible) {
      activeTab.scrollIntoView({
        behavior: 'instant',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeContextId, activePanelId]);

  const setTabRef = (tabId: string, element: HTMLDivElement | null) => {
    if (element) {
      activeTabRefs.current.set(tabId, element);
    } else {
      activeTabRefs.current.delete(tabId);
    }
  };

  return (
    <div className="cluster-tabs" ref={tabsContainerRef}>
      {tabs.map(tab => {
        const isActive = activeContextId === tab.clusterContext.id;
        const isPanelActive = tab.panelId === activePanelId;
        const shouldDim = !isPanelActive || (isPanelActive && !isActive);

        return (
          <div
            key={tab.id}
            ref={el => setTabRef(tab.clusterContext.id, el)}
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
