import { Menu } from '@tauri-apps/api/menu';
import { ClusterContextTab } from '../types/panel';

interface UseTabContextMenuProps {
  tabs: ClusterContextTab[];
  onCloseTab: (tab: ClusterContextTab) => void;
  onCloseOtherTabs?: (tab: ClusterContextTab) => void;
  onReloadTab?: (tab: ClusterContextTab) => void;
  onSplitRight?: (tab: ClusterContextTab) => void;
}

export const useTabContextMenu = ({
  tabs,
  onCloseTab,
  onCloseOtherTabs,
  onReloadTab,
  onSplitRight,
}: UseTabContextMenuProps) => {
  const handleContextMenu = async (e: React.MouseEvent, tab: ClusterContextTab) => {
    e.preventDefault();

    const menu = await Menu.new({
      items: [
        {
          id: 'close',
          text: 'Close',
          action: () => onCloseTab(tab),
        },
        {
          id: 'close-others',
          text: 'Close Others',
          action: () => {
            if (onCloseOtherTabs) {
              onCloseOtherTabs(tab);
            }
          },
        },
        {
          id: 'separator1',
          item: 'Separator',
        },
        {
          id: 'split-right',
          text: 'Split Right',
          action: () => {
            if (onSplitRight) {
              onSplitRight(tab);
            }
          },
        },
        {
          id: 'separator2',
          item: 'Separator',
        },
        {
          id: 'reload',
          text: 'Reload',
          action: () => {
            if (onReloadTab) {
              onReloadTab(tab);
            }
          },
        },
      ],
    });

    await menu.popup();
  };

  return { handleContextMenu };
};
