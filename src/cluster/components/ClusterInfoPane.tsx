import { useCallback } from 'react';
import ResourceKindSidebar from './ResourceKindSidebar';
import ResourceList, { KubeResource } from './ResourceList';
import ResourceDetailPane from './ResourceDetailPane';
import './ClusterInfoPane.css';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export interface ClusterViewState {
  selectedKind: string | undefined;
  selectedResourceDetail: KubeResource | undefined;
  isDetailLoading: boolean;
  showDetailPane: boolean;
  expandedGroups: Set<string>;
}

// --- Dummy Fetch Detail ---
// Simulates fetching full details for a specific resource
const fetchResourceDetail = async (
  resource: KubeResource | undefined
): Promise<KubeResource | undefined> => {
  if (!resource) return undefined;
  console.log(`Fetching details for: ${resource.metadata.name}`);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay

  // Return a more detailed dummy object based on the input resource
  // For now, just return the input, assuming ResourceList already provides enough detail
  // In a real scenario, this would fetch the full YAML/JSON from the API
  // Example adding more details for a Pod:
  if (resource.metadata.name.startsWith('pod-')) {
    // Check if it looks like a pod based on dummy naming
    return {
      ...resource,
      spec: {
        ...(resource.spec || {}),
        nodeName: 'gk3-csm-cluster-0-pool-3-ae2f041a-y8fl', // Example node
        serviceAccountName: 'default',
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            ready: true,
            restartCount: 0,
            state: { running: { startedAt: new Date().toISOString() } },
          },
          {
            name: 'sidecar',
            image: 'sidecar:latest',
            ready: true,
            restartCount: 0,
            state: { running: { startedAt: new Date().toISOString() } },
          },
        ],
        initContainers: [
          {
            name: 'init-myservice',
            image: 'busybox',
            state: { terminated: { exitCode: 0, reason: 'Completed' } },
          },
        ],
        volumes: [
          { name: 'config-volume', configMap: { name: 'my-config' } },
          { name: 'secret-volume', secret: { secretName: 'my-secret' } },
        ],
      },
      status: {
        ...(resource.status || {}),
        phase: 'Running',
        podIP: '10.10.0.12',
        startTime: '2025-04-23T14:05:21Z', // Example start time
        conditions: [
          { type: 'Initialized', status: 'True', lastTransitionTime: new Date().toISOString() },
          { type: 'Ready', status: 'True', lastTransitionTime: new Date().toISOString() },
          { type: 'ContainersReady', status: 'True', lastTransitionTime: new Date().toISOString() },
          { type: 'PodScheduled', status: 'True', lastTransitionTime: new Date().toISOString() },
        ],
      },
      // Add dummy labels/annotations similar to describe output
      metadata: {
        ...resource.metadata,
        labels: { app: 'myapp', env: 'production', ...resource.metadata.labels },
        annotations: {
          'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
          ...resource.metadata.annotations,
        },
      },
    };
  }

  return resource; // Return original resource if not a pod (or add other kinds)
};
// --- End Dummy Fetch ---

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
        const details = await fetchResourceDetail(resource);
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
    [viewState, onViewStateChange]
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
