import { Menu } from '@tauri-apps/api/menu';
import { ContextNode } from '../../lib/contextTree';
import { ClusterContextTab } from '../types/panel';

interface UseTabContextMenuProps {
  tabs: ClusterContextTab[];
  onCloseTab: (node: ContextNode) => void;
  onReloadTab?: (node: ContextNode) => void;
  onSplitRight?: (node: ContextNode) => void;
}

export const useTabContextMenu = ({
  tabs,
  onCloseTab,
  onReloadTab,
  onSplitRight,
}: UseTabContextMenuProps) => {
  const handleContextMenu = async (e: React.MouseEvent, node: ContextNode) => {
    e.preventDefault();

    const menu = await Menu.new({
      items: [
        {
          id: 'close',
          text: 'Close',
          action: () => onCloseTab(node),
        },
        {
          id: 'close-others',
          text: 'Close Others',
          action: () => {
            tabs.forEach(tab => {
              if (tab.clusterContext.id !== node.clusterContext?.id) {
                // Reconstruct ContextNode for callback
                const contextNode: ContextNode = {
                  id: `context-${tab.clusterContext.id}`,
                  name: tab.clusterContext.clusterName,
                  type: 'context' as const,
                  clusterContext: tab.clusterContext,
                };
                onCloseTab(contextNode);
              }
            });
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
              onSplitRight(node);
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
              onReloadTab(node);
            }
          },
        },
      ],
    });

    await menu.popup();
  };

  return { handleContextMenu };
};
