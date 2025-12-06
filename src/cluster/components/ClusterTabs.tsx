import { useRef, useEffect, useState } from 'react';
import { ClusterContextTab } from '../types/panel';
import { Menu, MenuItem } from '../../components/ui/Menu';

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

interface TabContextMenuState {
  tab: ClusterContextTab;
  x: number;
  y: number;
}

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
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | undefined>(undefined);
  const [closingTabs, setClosingTabs] = useState<Set<string>>(new Set());

  const handleContextMenu = (e: React.MouseEvent, tab: ClusterContextTab) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      tab,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const closeMenu = () => setContextMenu(undefined);

  const handleCloseTab = (tab: ClusterContextTab) => {
    setClosingTabs(prev => new Set(prev).add(tab.id));
    setTimeout(() => {
      onCloseCluster(tab);
      setClosingTabs(prev => {
        const next = new Set(prev);
        next.delete(tab.id);
        return next;
      });
    }, 200);
  };

  const getMenuItems = (tab: ClusterContextTab): MenuItem[] => {
    const menuItems: MenuItem[] = [
      {
        id: 'close',
        label: 'Close',
        onClick: () => handleCloseTab(tab),
      },
    ];

    if (onCloseOtherTabs) {
      menuItems.push({
        id: 'close-others',
        label: 'Close Others',
        onClick: () => onCloseOtherTabs(tab),
      });
    }

    menuItems.push({ id: 'separator1', type: 'separator' });

    if (onSplitRight) {
      menuItems.push({
        id: 'split-right',
        label: 'Split Right',
        onClick: () => onSplitRight(tab),
      });
    }

    menuItems.push({ id: 'separator2', type: 'separator' });

    if (onReloadCluster) {
      menuItems.push({
        id: 'reload',
        label: 'Reload',
        onClick: () => onReloadCluster(tab),
      });
    }

    return menuItems;
  };

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
    <>
      <div className="cluster-tabs" ref={tabsContainerRef}>
        {tabs.map(tab => {
          const isActive = activeContextId === tab.clusterContext.id;
          const isPanelActive = tab.panelId === activePanelId;
          const shouldDim = !isPanelActive || (isPanelActive && !isActive);

          const isClosing = closingTabs.has(tab.id);

          return (
            <div
              key={tab.id}
              ref={el => setTabRef(tab.clusterContext.id, el)}
              className={`cluster-tab ${isActive ? 'active' : ''} ${shouldDim ? 'dimmed' : ''} ${isClosing ? 'closing' : ''}`}
              onClick={() => onClusterSelect(tab)}
              onContextMenu={e => handleContextMenu(e, tab)}
            >
              <span className="tab-label">{tab.clusterContext.clusterName}</span>
              <button
                className="close-button"
                onClick={e => {
                  e.stopPropagation();
                  handleCloseTab(tab);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <Menu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getMenuItems(contextMenu.tab)}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

export default ClusterTabs;
