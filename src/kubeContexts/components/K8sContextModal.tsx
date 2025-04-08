import React, { useState, ChangeEvent } from 'react';
import { Button, Input } from '../../main/ui';
import '../styles/modal.css';

// プロバイダータイプの定義
enum ProviderType {
  GKE = 'GKE',
  EKS = 'EKS',
  AKS = 'AKS',
  Manual = 'Manual',
}

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
  // 基本情報
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('');

  // プロバイダー選択
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.GKE);

  // GKE固有フィールド
  const [gkeProject, setGkeProject] = useState('');
  const [gkeRegion, setGkeRegion] = useState('');
  const [gkeClusterName, setGkeClusterName] = useState('');
  const [gkeUseInternalIp, setGkeUseInternalIp] = useState(false);
  const [gkeUseDnsEndpoint, setGkeUseDnsEndpoint] = useState(false);

  // EKS固有フィールド
  const [eksRegion, setEksRegion] = useState('');
  const [eksClusterName, setEksClusterName] = useState('');
  const [eksProfile, setEksProfile] = useState('');

  // AKS固有フィールド
  const [aksResourceGroup, setAksResourceGroup] = useState('');
  const [aksClusterName, setAksClusterName] = useState('');
  const [aksSubscription, setAksSubscription] = useState('');

  // Manual固有フィールド
  const [manualServer, setManualServer] = useState('');
  const [manualUser, setManualUser] = useState('');
  const [manualCertData, setManualCertData] = useState('');
  const [manualKeyData, setManualKeyData] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let server = '';
    let user = '';

    // プロバイダー別の処理
    switch (providerType) {
      case ProviderType.GKE:
        // GKEの場合はコマンドを構築してサーバーとユーザー情報を設定
        server = `https://${gkeClusterName}.${gkeRegion}.gcp`;
        user = `gke-${gkeProject}`;
        break;
      case ProviderType.EKS:
        server = `https://${eksClusterName}.${eksRegion}.eks.amazonaws.com`;
        user = `eks-${eksProfile}`;
        break;
      case ProviderType.AKS:
        server = `https://${aksClusterName}.${aksResourceGroup}.azmk8s.io`;
        user = `aks-${aksSubscription}`;
        break;
      case ProviderType.Manual:
        server = manualServer;
        user = manualUser;
        break;
    }

    onSave({
      name,
      server,
      user,
      namespace: namespace || undefined,
    });
  };

  // プロバイダータイプの変更ハンドラー
  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setProviderType(e.target.value as ProviderType);
  };

  // プロバイダー別のフォームを描画
  const renderProviderForm = () => {
    switch (providerType) {
      case ProviderType.GKE:
        return (
          <>
            <div className="form-group">
              <label htmlFor="gkeProject">プロジェクトID</label>
              <Input
                id="gkeProject"
                value={gkeProject}
                onChange={e => setGkeProject(e.target.value)}
                placeholder="my-gke-project"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="gkeRegion">リージョン/ゾーン</label>
              <Input
                id="gkeRegion"
                value={gkeRegion}
                onChange={e => setGkeRegion(e.target.value)}
                placeholder="asia-northeast1"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="gkeClusterName">クラスター名</label>
              <Input
                id="gkeClusterName"
                value={gkeClusterName}
                onChange={e => setGkeClusterName(e.target.value)}
                placeholder="my-cluster"
                required
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={gkeUseInternalIp}
                  onChange={e => setGkeUseInternalIp(e.target.checked)}
                />
                内部IPを使用 (--internal-ip)
              </label>
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={gkeUseDnsEndpoint}
                  onChange={e => setGkeUseDnsEndpoint(e.target.checked)}
                />
                DNSエンドポイント (--dns-endpoint)
              </label>
            </div>
          </>
        );

      case ProviderType.EKS:
        return (
          <>
            <div className="form-group">
              <label htmlFor="eksRegion">リージョン</label>
              <Input
                id="eksRegion"
                value={eksRegion}
                onChange={e => setEksRegion(e.target.value)}
                placeholder="us-west-2"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="eksClusterName">クラスター名</label>
              <Input
                id="eksClusterName"
                value={eksClusterName}
                onChange={e => setEksClusterName(e.target.value)}
                placeholder="my-eks-cluster"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="eksProfile">プロファイル</label>
              <Input
                id="eksProfile"
                value={eksProfile}
                onChange={e => setEksProfile(e.target.value)}
                placeholder="default"
              />
            </div>
          </>
        );

      case ProviderType.AKS:
        return (
          <>
            <div className="form-group">
              <label htmlFor="aksResourceGroup">リソースグループ</label>
              <Input
                id="aksResourceGroup"
                value={aksResourceGroup}
                onChange={e => setAksResourceGroup(e.target.value)}
                placeholder="my-resource-group"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="aksClusterName">クラスター名</label>
              <Input
                id="aksClusterName"
                value={aksClusterName}
                onChange={e => setAksClusterName(e.target.value)}
                placeholder="my-aks-cluster"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="aksSubscription">サブスクリプションID</label>
              <Input
                id="aksSubscription"
                value={aksSubscription}
                onChange={e => setAksSubscription(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
          </>
        );

      case ProviderType.Manual:
        return (
          <>
            <div className="form-group">
              <label htmlFor="manualServer">APIサーバーURL</label>
              <Input
                id="manualServer"
                value={manualServer}
                onChange={e => setManualServer(e.target.value)}
                placeholder="https://kubernetes.example.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="manualUser">ユーザー名</label>
              <Input
                id="manualUser"
                value={manualUser}
                onChange={e => setManualUser(e.target.value)}
                placeholder="kubernetes-admin"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="manualCertData">クライアント証明書（オプション）</label>
              <textarea
                id="manualCertData"
                value={manualCertData}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setManualCertData(e.target.value)
                }
                placeholder="-----BEGIN CERTIFICATE-----"
                rows={3}
                className="textarea-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="manualKeyData">クライアント鍵（オプション）</label>
              <textarea
                id="manualKeyData"
                value={manualKeyData}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setManualKeyData(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={3}
                className="textarea-input"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>新規Kubernetesコンテキスト</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">コンテキスト名</label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-context"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="providerType">プロバイダータイプ</label>
            <select
              id="providerType"
              value={providerType}
              onChange={handleProviderChange}
              className="provider-select"
            >
              <option value={ProviderType.GKE}>GKE</option>
              <option value={ProviderType.EKS}>EKS</option>
              <option value={ProviderType.AKS}>AKS</option>
              <option value={ProviderType.Manual}>手動</option>
            </select>
          </div>

          {renderProviderForm()}

          <div className="form-group">
            <label htmlFor="namespace">名前空間（オプション）</label>
            <Input
              id="namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              placeholder="default"
            />
          </div>

          <div className="modal-actions">
            <Button type="button" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" className="primary-button">
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default K8sContextModal;
