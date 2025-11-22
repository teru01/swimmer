import { Menu } from '@tauri-apps/api/menu';
import { ContextNode } from '../../lib/contextTree';

interface UseTabContextMenuProps {
  contextNodes: ContextNode[];
  onCloseTab: (node: ContextNode) => void;
  onReloadTab?: (node: ContextNode) => void;
  onSplitRight?: (node: ContextNode) => void;
}

export const useTabContextMenu = ({
  contextNodes,
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
            contextNodes.forEach(contextNode => {
              if (contextNode.id !== node.id) {
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
