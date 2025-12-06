import { useCallback } from 'react';
import ResourceKindSidebar from './ResourceKindSidebar';
import ResourceList, { KubeResource } from './ResourceList';
import ResourceDetailPane from './ResourceDetailPane';
import './ClusterInfoPane.css';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { commands } from '../../api/commands';

export interface ClusterViewState {
  selectedKind: string | undefined;
  selectedResourceDetail: KubeResource | undefined;
  isDetailLoading: boolean;
  showDetailPane: boolean;
  expandedGroups: Set<string>;
}

const fetchResourceDetail = async (
  resource: KubeResource | undefined,
  context: string | undefined
): Promise<KubeResource | undefined> => {
  if (!resource) return undefined;
  console.log(`Fetching details for: ${resource.metadata.name}`);

  const kind = resource.kind?.endsWith('s') ? resource.kind.slice(0, -1) : resource.kind;
  if (!kind) return resource;

  try {
    const details = await commands.getResourceDetail(
      context,
      kind,
      resource.metadata.name,
      resource.metadata.namespace
    );
    return details as KubeResource;
  } catch (error) {
    console.error('Failed to fetch resource detail:', error);
    return resource;
  }
};

interface ClusterInfoPaneProps {
  activeTabId: string | undefined;
  activeContextId: string | undefined;
  allViewStates: Map<string, ClusterViewState>;
  onViewStateChange: (tabId: string, state: ClusterViewState) => void;
}

interface ClusterViewInstanceProps {
  tabId: string;
  contextId: string | undefined;
  isVisible: boolean;
  viewState: ClusterViewState;
  onViewStateChange: (state: ClusterViewState) => void;
}

/**
 * Individual cluster view instance
 */
function ClusterViewInstance({
  isVisible,
  contextId,
  viewState,
  onViewStateChange,
}: ClusterViewInstanceProps) {
  const handleKindSelect = (kind: string) => {
    onViewStateChange({
      ...viewState,
      selectedKind: kind,
      selectedResourceDetail: undefined,
      showDetailPane: false,
    });
  };

  const handleExpandedGroupsChange = (expandedGroups: Set<string>) => {
    onViewStateChange({
      ...viewState,
      expandedGroups,
    });
  };

  const handleResourceSelect = useCallback(
    async (resource: KubeResource) => {
      onViewStateChange({
        ...viewState,
        showDetailPane: true,
        isDetailLoading: true,
        selectedResourceDetail: undefined,
      });
      try {
        const details = await fetchResourceDetail(resource, contextId);
        onViewStateChange({
          ...viewState,
          showDetailPane: true,
          isDetailLoading: false,
          selectedResourceDetail: details,
        });
      } catch (error) {
        console.error('Failed to fetch resource details:', error);
        onViewStateChange({
          ...viewState,
          showDetailPane: true,
          isDetailLoading: false,
          selectedResourceDetail: undefined,
        });
      }
    },
    [viewState, onViewStateChange, contextId]
  );

  const handleCloseDetailPane = () => {
    onViewStateChange({
      ...viewState,
      showDetailPane: false,
      selectedResourceDetail: undefined,
    });
  };

  const handleDetailPaneResize = (size: number) => {
    if (size < 5 && viewState.showDetailPane) {
      handleCloseDetailPane();
    }
  };

  return (
    <div
      className="cluster-view-instance"
      style={{ display: isVisible ? 'block' : 'none', width: '100%', height: '100%' }}
    >
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15} maxSize={40} id="sidebar">
          <ResourceKindSidebar
            selectedKind={viewState.selectedKind}
            onKindSelect={handleKindSelect}
            expandedGroups={viewState.expandedGroups}
            onExpandedGroupsChange={handleExpandedGroupsChange}
          />
        </Panel>
        <PanelResizeHandle className="resize-handle-vertical" />
        <Panel minSize={30} id="main-area">
          <PanelGroup direction="vertical">
            <Panel defaultSize={viewState.showDetailPane ? 30 : 100} minSize={20} id="list">
              <ResourceList
                selectedKind={viewState.selectedKind}
                onResourceSelect={handleResourceSelect}
                contextId={contextId}
              />
            </Panel>
            {viewState.showDetailPane && (
              <>
                <PanelResizeHandle className="resize-handle-horizontal" />
                <Panel
                  defaultSize={70}
                  minSize={5}
                  maxSize={80}
                  id="detail"
                  collapsible={true}
                  onCollapse={handleCloseDetailPane}
                  onResize={handleDetailPaneResize}
                >
                  <ResourceDetailPane
                    resource={viewState.selectedResourceDetail}
                    isLoading={viewState.isDetailLoading}
                    onClose={handleCloseDetailPane}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}

/**
 * Center Pane: Component to display cluster information with sidebar, list, and detail views.
 */
function ClusterInfoPane({
  activeTabId,
  activeContextId,
  allViewStates,
  onViewStateChange,
}: ClusterInfoPaneProps) {
  return (
    <div className="cluster-info-pane-container">
      {activeTabId ? (
        <>
          {Array.from(allViewStates.entries()).map(([tabId, viewState]) => {
            return (
              <ClusterViewInstance
                key={tabId}
                tabId={tabId}
                contextId={tabId === activeTabId ? activeContextId : undefined}
                isVisible={tabId === activeTabId}
                viewState={viewState}
                onViewStateChange={state => onViewStateChange(tabId, state)}
              />
            );
          })}
        </>
      ) : (
        <p className="no-context">Select a context to view cluster information</p>
      )}
    </div>
  );
}

export default ClusterInfoPane;
