import React, { useState } from 'react';
import './ClusterInfoPane.css';
import { KubeResource } from './ResourceList';
import { formatAge } from '../../lib/utils';

interface ResourceDetailPaneProps {
  resource: KubeResource | undefined;
  events?: KubeResource[];
  isLoading?: boolean;
  onClose: () => void;
  contextId?: string;
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

/** Returns a status category string for container state to apply color styling. */
const getContainerStateCategory = (state: any): string => {
  if (!state) return 'default';
  const key = Object.keys(state)[0]?.toLowerCase();
  if (key === 'running') return 'success';
  if (key === 'waiting') return 'warning';
  if (key === 'terminated') {
    const reason = state.terminated?.reason?.toLowerCase() || '';
    if (reason === 'completed') return 'success';
    return 'error';
  }
  return 'default';
};

const VALUE_COLLAPSE_THRESHOLD = 80;

/** A single metadata entry whose value collapses when it exceeds the threshold. */
const MetadataEntry: React.FC<{ entryKey: string; value: string }> = ({ entryKey, value }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > VALUE_COLLAPSE_THRESHOLD;

  return (
    <li>
      <span className="metadata-key-col">
        <span className="metadata-key">{entryKey}:</span>
        {isLong && (
          <button
            className="metadata-value-toggle"
            onClick={() => setExpanded(prev => !prev)}
            type="button"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      <span className={`metadata-value ${isLong && !expanded ? 'value-collapsed' : ''}`}>
        {value}
      </span>
    </li>
  );
};

/** Renders a metadata map with long values collapsed by default. */
const CollapsibleMetadataMap: React.FC<{ map: { [key: string]: string } | undefined }> = ({
  map,
}) => {
  if (!map || Object.keys(map).length === 0) {
    return <span className="detail-value">-</span>;
  }

  return (
    <ul className="metadata-list">
      {Object.entries(map).map(([key, value]) => (
        <MetadataEntry key={key} entryKey={key} value={value} />
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
  events: eventsProp = [],
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
    return undefined;
  }

  const resourceKind = resource.kind || 'Unknown';

  const renderEvents = () => {
    if (eventsProp.length === 0) {
      return (
        <section className="detail-section">
          <h4>Events</h4>
          <div className="detail-value">No events found</div>
        </section>
      );
    }

    return (
      <section className="detail-section">
        <h4>Events</h4>
        <table className="detail-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Count</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {eventsProp.map((event, index) => {
              const eventType = ((event as any).type || 'Normal').toLowerCase();
              return (
                <tr key={`${event.metadata.name}-${index}`}>
                  <td>
                    <span className={`status-badge ${eventType}`}>
                      {(event as any).type || 'Normal'}
                    </span>
                  </td>
                  <td>{(event as any).reason || '-'}</td>
                  <td>{(event as any).message || '-'}</td>
                  <td>{(event as any).count || 1}</td>
                  <td>{formatAge(event.metadata.creationTimestamp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  };

  const renderDeploymentDetails = (deployment: KubeResource) => {
    const { metadata, spec, status } = deployment;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{`${status?.readyReplicas ?? 0}/${spec?.replicas ?? 0}`}</DetailItem>
          <DetailItem label="Up-to-date">{status?.updatedReplicas ?? 0}</DetailItem>
          <DetailItem label="Available">{status?.availableReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{c.reason || '-'}</td>
                  <td>{c.message || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderServiceDetails = (service: KubeResource) => {
    const { metadata, spec, status } = service;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Type">{spec?.type || 'ClusterIP'}</DetailItem>
          <DetailItem label="Cluster IP">{spec?.clusterIP || '-'}</DetailItem>
          <DetailItem label="External IP">
            {spec?.externalIPs?.join(', ') ||
              status?.loadBalancer?.ingress?.map(i => i.ip || i.hostname).join(', ') ||
              '<none>'}
          </DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Ports</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Target Port</th>
                <th>Node Port</th>
              </tr>
            </thead>
            <tbody>
              {spec?.ports?.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.name || '-'}</td>
                  <td>{p.protocol || 'TCP'}</td>
                  <td>{p.port}</td>
                  <td>{p.targetPort || '-'}</td>
                  <td>{p.nodePort || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderNodeDetails = (node: KubeResource) => {
    const { metadata, status } = node;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Roles">
            {Object.keys(metadata.labels || {})
              .filter(k => k.startsWith('node-role.kubernetes.io/'))
              .map(k => k.replace('node-role.kubernetes.io/', ''))
              .join(', ') || '<none>'}
          </DetailItem>
          <DetailItem label="Kubelet Version">{status?.nodeInfo?.kubeletVersion || '-'}</DetailItem>
          <DetailItem label="Container Runtime">
            {status?.nodeInfo?.containerRuntimeVersion || '-'}
          </DetailItem>
          <DetailItem label="OS Image">{status?.nodeInfo?.osImage || '-'}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Addresses</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {status?.addresses?.map((addr, idx) => (
                <tr key={idx}>
                  <td>{addr.type}</td>
                  <td>{addr.address}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={2}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{c.reason || '-'}</td>
                  <td>{c.message || '-'}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="detail-section">
          <h4>Capacity</h4>
          {<CollapsibleMetadataMap map={status?.capacity} />}
        </section>

        <section className="detail-section">
          <h4>Allocatable</h4>
          {<CollapsibleMetadataMap map={status?.allocatable} />}
        </section>

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>
        {renderEvents()}
      </>
    );
  };

  const renderReplicaSetDetails = (rs: KubeResource) => {
    const { metadata, spec, status } = rs;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Controlled By">
            {metadata.ownerReferences?.[0]
              ? `${metadata.ownerReferences[0].kind}/${metadata.ownerReferences[0].name}`
              : '-'}
          </DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Current">{status?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{status?.readyReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderStatefulSetDetails = (sts: KubeResource) => {
    const { metadata, spec, status } = sts;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Replicas">{spec?.replicas ?? 0}</DetailItem>
          <DetailItem label="Ready">{`${status?.readyReplicas ?? 0}/${spec?.replicas ?? 0}`}</DetailItem>
          <DetailItem label="Current">{status?.currentReplicas ?? 0}</DetailItem>
          <DetailItem label="Updated">{status?.updatedReplicas ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderDaemonSetDetails = (ds: KubeResource) => {
    const { metadata, spec, status } = ds;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Desired">{status?.desiredNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Current">{status?.currentNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Ready">{status?.numberReady ?? 0}</DetailItem>
          <DetailItem label="Available">{status?.numberAvailable ?? 0}</DetailItem>
          <DetailItem label="Up-to-date">{status?.updatedNumberScheduled ?? 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                    <td>{c.reason || '-'}</td>
                    <td>{c.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Selector</h4>
          {<CollapsibleMetadataMap map={spec?.selector?.matchLabels} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderIngressDetails = (ingress: KubeResource) => {
    const { metadata, spec, status } = ingress;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Ingress Class">{spec?.ingressClassName || '<none>'}</DetailItem>
          <DetailItem label="Address">
            {status?.loadBalancer?.ingress
              ?.map(i => i.ip || i.hostname)
              .filter(Boolean)
              .join(', ') || '-'}
          </DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {spec?.rules && spec.rules.length > 0 && (
          <section className="detail-section">
            <h4>Rules</h4>
            {spec.rules.map((rule, idx) => (
              <div key={idx} style={{ marginBottom: '15px' }}>
                <DetailItem label="Host">{rule.host || '*'}</DetailItem>
                {rule.http?.paths && (
                  <div style={{ marginLeft: '20px' }}>
                    <h5>Paths</h5>
                    {rule.http.paths.map((path, pidx) => (
                      <DetailItem key={pidx} label={path.path || '/'}>
                        {(path.backend as any)?.service?.name || '-'} (Port:{' '}
                        {(path.backend as any)?.service?.port?.number || '-'})
                      </DetailItem>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {spec?.tls && spec.tls.length > 0 && (
          <section className="detail-section">
            <h4>TLS</h4>
            {spec.tls.map((tls, idx) => (
              <div key={idx} style={{ marginBottom: '10px' }}>
                <DetailItem label="Hosts">{tls.hosts?.join(', ') || '-'}</DetailItem>
                <DetailItem label="Secret">{tls.secretName || '-'}</DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderConfigMapDetails = (cm: KubeResource) => {
    const { metadata, data } = cm;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Data entries">{data ? Object.keys(data).length : 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {data && Object.keys(data).length > 0 && (
          <section className="detail-section">
            <h4>Data</h4>
            {Object.entries(data).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <DetailItem label={key}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</pre>
                </DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderSecretDetails = (secret: KubeResource) => {
    const { metadata, data, type } = secret;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Type">{type || 'Opaque'}</DetailItem>
          <DetailItem label="Data entries">{data ? Object.keys(data).length : 0}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {data && Object.keys(data).length > 0 && (
          <section className="detail-section">
            <h4>Data</h4>
            <ul className="metadata-list">
              {Object.keys(data).map(key => (
                <li key={key}>
                  <span className="metadata-key">{key}:</span>
                  <span className="metadata-value">(hidden)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {renderEvents()}
      </>
    );
  };

  const renderNamespaceDetails = (ns: KubeResource) => {
    const { metadata, status } = ns;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Status">{status?.phase || 'Active'}</DetailItem>
          <DetailItem label="Age">{formatAge(metadata.creationTimestamp)}</DetailItem>
        </section>

        {status?.conditions && status.conditions.length > 0 && (
          <section className="detail-section">
            <h4>Conditions</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {status.conditions.map(c => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>
      </>
    );
  };

  const renderPodDetails = (pod: KubeResource) => {
    const { metadata, spec, status } = pod;
    return (
      <>
        <section className="detail-section">
          <h4>Summary</h4>
          <DetailItem label="Name">{metadata.name}</DetailItem>
          <DetailItem label="Namespace">{metadata.namespace}</DetailItem>
          <DetailItem label="Priority">{(pod as any).spec?.priority ?? 0}</DetailItem>
          <DetailItem label="Service Account">{spec?.serviceAccountName || '-'}</DetailItem>
          <DetailItem label="Node">{spec?.nodeName || '-'}</DetailItem>
          <DetailItem label="Start Time">
            {status?.startTime ? new Date(status.startTime).toLocaleString() : '-'}
          </DetailItem>
          <DetailItem label="Status">{status?.phase || '-'}</DetailItem>
          <DetailItem label="IP">{status?.podIP || '-'}</DetailItem>
          <DetailItem label="IPs">
            {(pod as any).status?.podIPs?.map((ip: any) => ip.ip).join(', ') ||
              status?.podIP ||
              '-'}
          </DetailItem>
          <DetailItem label="Controlled By">
            {metadata.ownerReferences?.[0]
              ? `${metadata.ownerReferences[0].kind}/${metadata.ownerReferences[0].name}`
              : '-'}
          </DetailItem>
          <DetailItem label="QoS Class">{(pod as any).status?.qosClass || '-'}</DetailItem>
        </section>

        <section className="detail-section">
          <h4>Containers</h4>
          {spec?.containers?.map((container: any) => {
            const containerStatus = status?.containerStatuses?.find(
              cs => cs.name === container.name
            );
            return (
              <div key={container.name} style={{ marginBottom: '15px' }}>
                <h5>{container.name}</h5>
                <DetailItem label="Image">{container.image}</DetailItem>
                <DetailItem label="Image ID">{containerStatus?.imageID || '-'}</DetailItem>
                {container.ports && container.ports.length > 0 && (
                  <DetailItem label="Ports">
                    {container.ports
                      .map(
                        (p: any) =>
                          `${p.containerPort}/${p.protocol || 'TCP'}${p.name ? ` (${p.name})` : ''}`
                      )
                      .join(', ')}
                  </DetailItem>
                )}
                <DetailItem label="State">
                  <span
                    className={`status-text status-${getContainerStateCategory(containerStatus?.state)}`}
                  >
                    {containerStatus?.state ? Object.keys(containerStatus.state)[0] : '-'}
                  </span>
                </DetailItem>
                <DetailItem label="Ready">
                  <span
                    className={`status-text status-${containerStatus?.ready ? 'success' : 'error'}`}
                  >
                    {containerStatus?.ready ? 'True' : 'False'}
                  </span>
                </DetailItem>
                <DetailItem label="Restart Count">{containerStatus?.restartCount ?? 0}</DetailItem>
                {container.resources?.limits && (
                  <DetailItem label="Limits">
                    CPU: {container.resources.limits.cpu || '-'}, Memory:{' '}
                    {container.resources.limits.memory || '-'}
                    {container.resources.limits['ephemeral-storage']
                      ? `, Ephemeral Storage: ${container.resources.limits['ephemeral-storage']}`
                      : ''}
                  </DetailItem>
                )}
                {container.resources?.requests && (
                  <DetailItem label="Requests">
                    CPU: {container.resources.requests.cpu || '-'}, Memory:{' '}
                    {container.resources.requests.memory || '-'}
                    {container.resources.requests['ephemeral-storage']
                      ? `, Ephemeral Storage: ${container.resources.requests['ephemeral-storage']}`
                      : ''}
                  </DetailItem>
                )}
                {container.livenessProbe && (
                  <DetailItem label="Liveness">
                    {container.livenessProbe.httpGet
                      ? `http-get ${container.livenessProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.livenessProbe.httpGet.port}${container.livenessProbe.httpGet.path}`
                      : container.livenessProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
                {container.readinessProbe && (
                  <DetailItem label="Readiness">
                    {container.readinessProbe.httpGet
                      ? `http-get ${container.readinessProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.readinessProbe.httpGet.port}${container.readinessProbe.httpGet.path}`
                      : container.readinessProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
                {container.startupProbe && (
                  <DetailItem label="Startup">
                    {container.startupProbe.httpGet
                      ? `http-get ${container.startupProbe.httpGet.scheme?.toLowerCase() || 'http'}://:${container.startupProbe.httpGet.port}${container.startupProbe.httpGet.path}`
                      : container.startupProbe.exec
                        ? 'exec'
                        : 'tcp-socket'}
                  </DetailItem>
                )}
              </div>
            );
          }) ?? <p>-</p>}
        </section>

        {spec?.initContainers && spec.initContainers.length > 0 && (
          <section className="detail-section">
            <h4>Init Containers</h4>
            {spec.initContainers.map((container: any) => {
              const containerStatus = status?.containerStatuses?.find(
                cs => cs.name === container.name
              );
              return (
                <div key={container.name} style={{ marginBottom: '15px' }}>
                  <h5>{container.name}</h5>
                  <DetailItem label="Image">{container.image}</DetailItem>
                  <DetailItem label="Image ID">{containerStatus?.imageID || '-'}</DetailItem>
                  <DetailItem label="State">
                    <span
                      className={`status-text status-${getContainerStateCategory(containerStatus?.state)}`}
                    >
                      {containerStatus?.state ? Object.keys(containerStatus.state)[0] : '-'}
                    </span>
                  </DetailItem>
                  <DetailItem label="Ready">
                    <span
                      className={`status-text status-${containerStatus?.ready ? 'success' : 'error'}`}
                    >
                      {containerStatus?.ready ? 'True' : 'False'}
                    </span>
                  </DetailItem>
                  <DetailItem label="Restart Count">
                    {containerStatus?.restartCount ?? 0}
                  </DetailItem>
                  {container.resources?.limits && (
                    <DetailItem label="Limits">
                      CPU: {container.resources.limits.cpu || '-'}, Memory:{' '}
                      {container.resources.limits.memory || '-'}
                    </DetailItem>
                  )}
                  {container.resources?.requests && (
                    <DetailItem label="Requests">
                      CPU: {container.resources.requests.cpu || '-'}, Memory:{' '}
                      {container.resources.requests.memory || '-'}
                    </DetailItem>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <section className="detail-section">
          <h4>Conditions</h4>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {status?.conditions?.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={2}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {spec?.volumes && spec.volumes.length > 0 && (
          <section className="detail-section">
            <h4>Volumes</h4>
            {spec.volumes.map((v: any) => (
              <div key={v.name} style={{ marginBottom: '10px' }}>
                <DetailItem label="Name">{v.name}</DetailItem>
                <DetailItem label="Type">
                  {v.configMap
                    ? `ConfigMap (${v.configMap.name})`
                    : v.secret
                      ? `Secret (${v.secret.secretName})`
                      : v.emptyDir
                        ? 'EmptyDir'
                        : v.persistentVolumeClaim
                          ? `PersistentVolumeClaim (${v.persistentVolumeClaim.claimName})`
                          : v.projected
                            ? 'Projected'
                            : v.downwardAPI
                              ? 'DownwardAPI'
                              : 'Other'}
                </DetailItem>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h4>Labels</h4>
          {<CollapsibleMetadataMap map={metadata.labels} />}
        </section>

        <section className="detail-section">
          <h4>Annotations</h4>
          {<CollapsibleMetadataMap map={metadata.annotations} />}
        </section>

        {(pod as any).spec?.nodeSelector && (
          <section className="detail-section">
            <h4>Node-Selectors</h4>
            {<CollapsibleMetadataMap map={(pod as any).spec.nodeSelector} />}
          </section>
        )}

        {(pod as any).spec?.tolerations && (pod as any).spec.tolerations.length > 0 && (
          <section className="detail-section">
            <h4>Tolerations</h4>
            <ul className="metadata-list">
              {(pod as any).spec.tolerations.map((t: any, idx: number) => (
                <li key={idx}>
                  {t.key}
                  {t.operator === 'Exists' ? '' : `=${t.value}`}:{t.effect || 'NoSchedule'}
                  {t.tolerationSeconds ? ` for ${t.tolerationSeconds}s` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
        {renderEvents()}
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
        {resourceKind === 'Pod' && renderPodDetails(resource)}
        {resourceKind === 'Deployment' && renderDeploymentDetails(resource)}
        {resourceKind === 'ReplicaSet' && renderReplicaSetDetails(resource)}
        {resourceKind === 'StatefulSet' && renderStatefulSetDetails(resource)}
        {resourceKind === 'DaemonSet' && renderDaemonSetDetails(resource)}
        {resourceKind === 'Service' && renderServiceDetails(resource)}
        {resourceKind === 'Ingress' && renderIngressDetails(resource)}
        {resourceKind === 'ConfigMap' && renderConfigMapDetails(resource)}
        {resourceKind === 'Secret' && renderSecretDetails(resource)}
        {resourceKind === 'Namespace' && renderNamespaceDetails(resource)}
        {resourceKind === 'Node' && renderNodeDetails(resource)}
        {![
          'Pod',
          'Deployment',
          'ReplicaSet',
          'StatefulSet',
          'DaemonSet',
          'Service',
          'Ingress',
          'ConfigMap',
          'Secret',
          'Namespace',
          'Node',
        ].includes(resourceKind) && (
          <div className="fallback-details">
            <section className="detail-section">
              <h4>Basic Information</h4>
              <DetailItem label="Name">{resource.metadata.name}</DetailItem>
              <DetailItem label="Namespace">{resource.metadata.namespace}</DetailItem>
              <DetailItem label="Age">{formatAge(resource.metadata.creationTimestamp)}</DetailItem>
            </section>

            {resource.status?.conditions && resource.status.conditions.length > 0 && (
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
                    {resource.status.conditions.map(c => (
                      <tr key={c.type}>
                        <td>{c.type}</td>
                        <td>{c.status}</td>
                        <td>{formatAge(c.lastTransitionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="detail-section">
              <h4>Labels</h4>
              {<CollapsibleMetadataMap map={resource.metadata.labels} />}
            </section>

            <section className="detail-section">
              <h4>Annotations</h4>
              {<CollapsibleMetadataMap map={resource.metadata.annotations} />}
            </section>

            {renderEvents()}

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
