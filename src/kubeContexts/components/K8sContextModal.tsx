import React, { useState } from 'react';
import { Button, Input } from '../../main/ui';
import '../styles/modal.css';

interface K8sContextModalProps {
  parentFolderId: string | null;
  onClose: () => void;
  onSave: (context: { name: string; server: string; user: string; namespace?: string }) => void;
}

/**
 * Modal component for creating a new Kubernetes context
 */
function K8sContextModal({
  parentFolderId: _parentFolderId,
  onClose,
  onSave,
}: K8sContextModalProps) {
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [user, setUser] = useState('');
  const [namespace, setNamespace] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      server,
      user,
      namespace: namespace || undefined,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>New Kubernetes Context</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Context Name</label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-context"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="server">API Server URL</label>
            <Input
              id="server"
              value={server}
              onChange={e => setServer(e.target.value)}
              placeholder="https://kubernetes.example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="user">Username</label>
            <Input
              id="user"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="kubernetes-admin"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="namespace">Namespace (Optional)</label>
            <Input
              id="namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="primary-button">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default K8sContextModal;
