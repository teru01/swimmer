import { useState, useCallback } from 'react';
import { ContextNode } from '../../lib/contextTree';
import ResourceKindSidebar from './ResourceKindSidebar';
import ResourceList, { KubeResource } from './ResourceList';
import ResourceDetailPane from './ResourceDetailPane';
import './ClusterInfoPane.css';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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
  selectedContext: ContextNode | undefined;
}

/**
 * Center Pane: Component to display cluster information with sidebar, list, and detail views.
 */
function ClusterInfoPane({ selectedContext }: ClusterInfoPaneProps) {
  const [selectedKind, setSelectedKind] = useState<string | undefined>(undefined);
  const [selectedResourceDetail, setSelectedResourceDetail] = useState<KubeResource | undefined>(
    undefined
  );
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [showDetailPane, setShowDetailPane] = useState<boolean>(false);

  const handleKindSelect = (kind: string) => {
    setSelectedKind(kind);
    setSelectedResourceDetail(undefined);
    setShowDetailPane(false);
  };

  const handleResourceSelect = useCallback(async (resource: KubeResource) => {
    setShowDetailPane(true);
    setIsDetailLoading(true);
    setSelectedResourceDetail(undefined);
    try {
      const details = await fetchResourceDetail(resource);
      setSelectedResourceDetail(details);
    } catch (error) {
      console.error('Failed to fetch resource details:', error);
      setSelectedResourceDetail(undefined);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleCloseDetailPane = () => {
    setShowDetailPane(false);
    setSelectedResourceDetail(undefined);
  };

  const handleDetailPaneResize = (size: number) => {
    if (size < 5 && showDetailPane) {
      handleCloseDetailPane();
    }
  };

  return (
    <div className="cluster-info-pane-container">
      {selectedContext ? (
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={15} maxSize={40} id="sidebar">
            <ResourceKindSidebar selectedKind={selectedKind} onKindSelect={handleKindSelect} />
          </Panel>
          <PanelResizeHandle className="resize-handle-vertical" />
          <Panel minSize={30} id="main-area">
            <PanelGroup direction="vertical">
              <Panel defaultSize={showDetailPane ? 70 : 100} minSize={20} id="list">
                <ResourceList selectedKind={selectedKind} onResourceSelect={handleResourceSelect} />
              </Panel>
              {showDetailPane && (
                <>
                  <PanelResizeHandle className="resize-handle-horizontal" />
                  <Panel
                    defaultSize={30}
                    minSize={5}
                    maxSize={80}
                    id="detail"
                    collapsible={true}
                    onCollapse={handleCloseDetailPane}
                    onResize={handleDetailPaneResize}
                  >
                    <ResourceDetailPane
                      resource={selectedResourceDetail}
                      isLoading={isDetailLoading}
                      onClose={handleCloseDetailPane}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      ) : (
        <p className="no-context">Select a context to view cluster information</p>
      )}
    </div>
  );
}

export default ClusterInfoPane;
