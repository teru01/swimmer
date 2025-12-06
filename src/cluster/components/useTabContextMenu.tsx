import { useState } from 'react';
import { ClusterContextTab } from '../types/panel';
import { Menu, MenuItem } from '../../components/ui/Menu';

interface UseTabContextMenuProps {
  tabs: ClusterContextTab[];
  onCloseTab: (tab: ClusterContextTab) => void;
  onCloseOtherTabs?: (tab: ClusterContextTab) => void;
  onReloadTab?: (tab: ClusterContextTab) => void;
  onSplitRight?: (tab: ClusterContextTab) => void;
}

interface TabContextMenuState {
  tab: ClusterContextTab;
  x: number;
  y: number;
}

export const useTabContextMenu = ({
  onCloseTab,
  onCloseOtherTabs,
  onReloadTab,
  onSplitRight,
}: UseTabContextMenuProps) => {
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | undefined>(undefined);

  const handleContextMenu = (e: React.MouseEvent, tab: ClusterContextTab) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      tab,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const renderMenu = (): JSX.Element | null => {
    if (!contextMenu) return null;

    const menuItems: MenuItem[] = [
      {
        id: 'close',
        label: 'Close',
        onClick: () => onCloseTab(contextMenu.tab),
      },
    ];

    if (onCloseOtherTabs) {
      menuItems.push({
        id: 'close-others',
        label: 'Close Others',
        onClick: () => onCloseOtherTabs(contextMenu.tab),
      });
    }

    menuItems.push({ id: 'separator1', type: 'separator' });

    if (onSplitRight) {
      menuItems.push({
        id: 'split-right',
        label: 'Split Right',
        onClick: () => onSplitRight(contextMenu.tab),
      });
    }

    menuItems.push({ id: 'separator2', type: 'separator' });

    if (onReloadTab) {
      menuItems.push({
        id: 'reload',
        label: 'Reload',
        onClick: () => onReloadTab(contextMenu.tab),
      });
    }

    return (
      <Menu
        x={contextMenu.x}
        y={contextMenu.y}
        items={menuItems}
        onClose={() => setContextMenu(undefined)}
      />
    );
  };

  return { handleContextMenu, renderMenu };
};
