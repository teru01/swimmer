import { ClusterContextTab } from '../types/panel';
import { useTabContextMenu } from './useTabContextMenu';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

interface ClusterTabsProps {
  tabs: ClusterContextTab[];
  activeContextId: string | undefined;
  activePanelId: string;
  panelId: string;
  onSelectCluster: (tab: ClusterContextTab) => void;
  onCloseCluster: (tab: ClusterContextTab) => void;
  onReloadCluster?: (tab: ClusterContextTab) => void;
  onSplitRight?: (tab: ClusterContextTab) => void;
  onTabReorder?: (panelId: string, tabIds: string[]) => void;
  onTabMove?: (sourceTabId: string, targetPanelId: string, targetIndex: number) => void;
}

interface SortableTabProps {
  tab: ClusterContextTab;
  isActive: boolean;
  shouldDim: boolean;
  onSelect: (tab: ClusterContextTab) => void;
  onClose: (tab: ClusterContextTab) => void;
  onContextMenu: (e: React.MouseEvent, tab: ClusterContextTab) => void;
}

function SortableTab({
  tab,
  isActive,
  shouldDim,
  onSelect,
  onClose,
  onContextMenu,
}: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cluster-tab ${isActive ? 'active' : ''} ${shouldDim ? 'dimmed' : ''}`}
      onClick={() => onSelect(tab)}
      onContextMenu={e => onContextMenu(e, tab)}
    >
      {tab.clusterContext.clusterName}
      <button
        onClick={e => {
          e.stopPropagation();
          onClose(tab);
        }}
      >
        x
      </button>
    </div>
  );
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  tabs,
  activeContextId,
  activePanelId,
  panelId,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
  onReloadCluster,
  onSplitRight,
  onTabReorder,
  onTabMove,
}: ClusterTabsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { handleContextMenu } = useTabContextMenu({
    tabs,
    onCloseTab: onCloseCluster,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTabId = active.id as string;
    const overTabId = over.id as string;

    if (activeTabId !== overTabId) {
      const oldIndex = tabs.findIndex(t => t.id === activeTabId);
      const newIndex = tabs.findIndex(t => t.id === overTabId);

      const newOrder = [...tabs];
      const [movedTab] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedTab);

      // Check if moved tab belongs to different panel
      const movedTabObj = tabs.find(t => t.id === activeTabId);
      if (movedTabObj && movedTabObj.panelId !== panelId && onTabMove) {
        // Tab moved from another panel
        onTabMove(activeTabId, panelId, newIndex);
      } else if (onTabReorder) {
        // Tab reordered within same panel
        onTabReorder(
          panelId,
          newOrder.map(t => t.id)
        );
      }

      // Activate the dragged tab
      if (movedTabObj) {
        onClusterSelect(movedTabObj);
      }
    }
  };

  const activeTab = activeId ? tabs.find(t => t.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
        <div className="cluster-tabs">
          {tabs.map(tab => {
            const isActive = activeContextId === tab.clusterContext.id;
            const isPanelActive = tab.panelId === activePanelId;
            const shouldDim = !isPanelActive || (isPanelActive && !isActive);

            return (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={isActive}
                shouldDim={shouldDim}
                onSelect={onClusterSelect}
                onClose={onCloseCluster}
                onContextMenu={handleContextMenu}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeTab ? (
          <div className="cluster-tab active">{activeTab.clusterContext.clusterName}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default ClusterTabs;
