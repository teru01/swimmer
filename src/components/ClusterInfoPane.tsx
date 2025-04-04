/**
 * Center Pane: Component to display cluster information
 */
function ClusterInfoPane({ selectedContext }: { selectedContext: string | null }) {
  return (
    <div className="cluster-info-pane">
      <h2>Cluster Information</h2>
      
      {selectedContext ? (
        <div className="cluster-info-content">
          <h3>Context: {selectedContext}</h3>
          
          <div className="info-section">
            <h4>Nodes</h4>
            <div className="dummy-data">
              <p>node1 (Ready) - 4 CPU, 16GB Memory</p>
              <p>node2 (Ready) - 4 CPU, 16GB Memory</p>
              <p>node3 (Ready) - 4 CPU, 16GB Memory</p>
            </div>
          </div>
          
          <div className="info-section">
            <h4>Namespaces</h4>
            <div className="dummy-data">
              <p>default</p>
              <p>kube-system</p>
              <p>kube-public</p>
              <p>monitoring</p>
            </div>
          </div>
          
          <div className="info-section">
            <h4>Deployments</h4>
            <div className="dummy-data">
              <p>app1 (3/3 Ready)</p>
              <p>app2 (1/1 Ready)</p>
              <p>monitoring (2/2 Ready)</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="no-context">Select a context to view cluster information</p>
      )}
    </div>
  );
}

export default ClusterInfoPane; 
