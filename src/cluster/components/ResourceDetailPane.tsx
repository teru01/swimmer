import React from 'react';
import './ClusterInfoPane.css';
import { KubeResource } from './ResourceList';
import { formatAge } from '../../lib/utils';

interface ResourceDetailPaneProps {
  resource: KubeResource | null;
  isLoading?: boolean;
  onClose: () => void;
}

// Helper component to render key-value pairs nicely
const DetailItem: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="detail-item">
    <span className="detail-label">{label}:</span>
    <span className="detail-value">{children || '-'}</span>
  </div>
);

// Helper to render Labels/Annotations
const renderMetadataMap = (map: { [key: string]: string } | undefined) => {
  if (!map || Object.keys(map).length === 0) {
    return <span className="detail-value">-</span>;
  }
  return (
    <ul className="metadata-list">
      {Object.entries(map).map(([key, value]) => (
        <li key={key}>
          <span className="metadata-key">{key}:</span>
          <span className="metadata-value">{value}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * Pane component to display details of the selected resource.
 * @param resource Currently selected resource object.
 * @param isLoading Loading state of the resource.
 * @param onClose Callback function when the pane is closed.
 */
const ResourceDetailPane: React.FC<ResourceDetailPaneProps> = ({
  resource,
  isLoading,
  onClose,
}) => {
  if (isLoading) {
    return (
      <div className="resource-detail-pane loading">
        <button onClick={onClose} className="close-button" title="Close details">
          ✕
        </button>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading resource details...</span>
        </div>
      </div>
    );
  }

  if (!resource) {
    return null;
  }

  // Determine resource kind from name or add kind field to KubeResource
  const getResourceKind = (resource: KubeResource): string => {
    const name = resource.metadata.name;
    if (name.startsWith('pod-')) return 'Pod';
    if (name.startsWith('deployment-')) return 'Deployment';
    if (name.startsWith('service-')) return 'Service';
    if (name.startsWith('node-')) return 'Node';
    return 'Unknown';
  };

  const resourceKind = getResourceKind(resource);

  // --- Specific Renderer for Pod ---
  // Add renderers for other kinds as needed
  const renderPodDetails = (pod: KubeResource) => {
    const { metadata, spec, status } = pod;
    return (
      <>
        {/* --- Summary Section --- */}
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Node">{spec?.nodeName}</DetailItem>
          <DetailItem label="Service Account">{spec?.serviceAccountName}</DetailItem>
          <DetailItem label="Status">{status?.phase}</DetailItem>
          <DetailItem label="IP">{status?.podIP}</DetailItem>
          <DetailItem label="Controlled By">
            {metadata.ownerReferences?.[0]?.kind}/{metadata.ownerReferences?.[0]?.name}
          </DetailItem>{' '}
          {/* Example owner */}
          <DetailItem label="Start Time">
            {status?.startTime ? new Date(status.startTime).toLocaleString() : '-'}
          </DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {/* --- Labels & Annotations --- */}
        <section className="detail-section">
          <h4>Labels</h4>
          {renderMetadataMap(metadata.labels)}
        </section>
        <section className="detail-section">
          <h4>Annotations</h4>
          {renderMetadataMap(metadata.annotations)}
        </section>

        {/* --- Conditions --- */}
        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Last Transition</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{formatAge(c.lastTransitionTime)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={3}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* --- Containers --- */}
        <section className="detail-section">
          <h4>Containers</h4>
          {spec?.initContainers && spec.initContainers.length > 0 && (
            <>
              <h5>Init Containers</h5>
              {/* Render Init Containers - simplified for now */}
              {spec.initContainers.map(c => (
                <p key={c.name}>
                  {c.name} ({c.image}) - Status: {c.state?.terminated?.reason ?? 'Unknown'}
                </p>
              ))}{' '}
            </>
          )}
          <h5>App Containers</h5>
          {/* Render App Containers - simplified for now */}
          {spec?.containers?.map(c => (
            <p key={c.name}>
              {c.name} ({c.image}) - Ready: {c.ready ? 'True' : 'False'}, Restarts: {c.restartCount}
            </p>
          )) ?? <p>-</p>}
        </section>

        {/* --- Volumes --- */}
        <section className="detail-section">
          <h4>Volumes</h4>
          {/* Render Volumes - simplified for now */}
          {spec?.volumes?.map(v => (
            <p key={v.name}>
              {v.name} (
              {v.configMap
                ? `ConfigMap: ${v.configMap.name}`
                : v.secret
                  ? `Secret: ${v.secret.secretName}`
                  : 'Other'}
              )
            </p>
          )) ?? <p>-</p>}
        </section>

        {/* TODO: Add Events section */}
      </>
    );
  };
  // --- End Pod Renderer ---

  return (
    <div className="resource-detail-pane">
      <div className="detail-header">
        <div className="detail-title">
          <h3>{resource.metadata.name}</h3>
          <span className="resource-kind-badge">{resourceKind}</span>
        </div>
        <button onClick={onClose} className="close-button" title="Close details">
          ✕
        </button>
      </div>

      <div className="detail-content">
        {resourceKind === 'Pod' ? (
          renderPodDetails(resource)
        ) : (
          <div className="fallback-details">
            <section className="detail-section">
              <h4>Basic Information</h4>
              <DetailItem label="Name">{resource.metadata.name}</DetailItem>
              <DetailItem label="Namespace">{resource.metadata.namespace}</DetailItem>
              <DetailItem label="Age">{formatAge(resource.metadata.creationTimestamp)}</DetailItem>
            </section>

            <section className="detail-section">
              <h4>Labels</h4>
              {renderMetadataMap(resource.metadata.labels)}
            </section>

            <section className="detail-section">
              <h4>Annotations</h4>
              {renderMetadataMap(resource.metadata.annotations)}
            </section>

            <section className="detail-section">
              <h4>Raw Data</h4>
              <pre className="json-display">{JSON.stringify(resource, null, 2)}</pre>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceDetailPane;
