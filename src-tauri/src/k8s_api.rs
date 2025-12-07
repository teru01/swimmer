use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, PersistentVolumeClaim, Pod, Secret, Service,
    ServiceAccount,
};
use k8s_openapi::api::networking::v1::{Ingress, NetworkPolicy};
use k8s_openapi::api::rbac::v1::{ClusterRole, ClusterRoleBinding, Role, RoleBinding};
use k8s_openapi::api::storage::v1::StorageClass;
use kube::{
    api::{Api, ListParams, ObjectList},
    config::{Config, InferConfigError},
    Client,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum K8sError {
    #[error("Kube error: {0}")]
    Kube(#[from] kube::Error),
    #[error("Config error: {0}")]
    Config(#[from] InferConfigError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl serde::Serialize for K8sError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, K8sError>;

#[async_trait]
pub trait K8sClient: Send + Sync {
    async fn list_pods(&self, namespace: Option<&str>) -> Result<Vec<Pod>>;
    async fn get_pod(&self, name: &str, namespace: &str) -> Result<Pod>;
    async fn list_deployments(&self, namespace: Option<&str>) -> Result<Vec<Deployment>>;
    async fn get_deployment(&self, name: &str, namespace: &str) -> Result<Deployment>;
    async fn list_services(&self, namespace: Option<&str>) -> Result<Vec<Service>>;
    async fn get_service(&self, name: &str, namespace: &str) -> Result<Service>;
    async fn list_nodes(&self) -> Result<Vec<Node>>;
    async fn get_node(&self, name: &str) -> Result<Node>;
    async fn list_namespaces(&self) -> Result<Vec<Namespace>>;
    async fn get_namespace(&self, name: &str) -> Result<Namespace>;
    async fn list_replicasets(&self, namespace: Option<&str>) -> Result<Vec<ReplicaSet>>;
    async fn list_statefulsets(&self, namespace: Option<&str>) -> Result<Vec<StatefulSet>>;
    async fn list_daemonsets(&self, namespace: Option<&str>) -> Result<Vec<DaemonSet>>;
    async fn list_jobs(&self, namespace: Option<&str>) -> Result<Vec<Job>>;
    async fn list_cronjobs(&self, namespace: Option<&str>) -> Result<Vec<CronJob>>;
    async fn list_configmaps(&self, namespace: Option<&str>) -> Result<Vec<ConfigMap>>;
    async fn list_secrets(&self, namespace: Option<&str>) -> Result<Vec<Secret>>;
    async fn list_ingresses(&self, namespace: Option<&str>) -> Result<Vec<Ingress>>;
    async fn list_networkpolicies(&self, namespace: Option<&str>) -> Result<Vec<NetworkPolicy>>;
    async fn list_persistentvolumes(&self) -> Result<Vec<PersistentVolume>>;
    async fn list_persistentvolumeclaims(&self, namespace: Option<&str>) -> Result<Vec<PersistentVolumeClaim>>;
    async fn list_storageclasses(&self) -> Result<Vec<StorageClass>>;
    async fn list_roles(&self, namespace: Option<&str>) -> Result<Vec<Role>>;
    async fn list_clusterroles(&self) -> Result<Vec<ClusterRole>>;
    async fn list_rolebindings(&self, namespace: Option<&str>) -> Result<Vec<RoleBinding>>;
    async fn list_clusterrolebindings(&self) -> Result<Vec<ClusterRoleBinding>>;
    async fn list_serviceaccounts(&self, namespace: Option<&str>) -> Result<Vec<ServiceAccount>>;
    async fn apiserver_version(&self) -> Result<k8s_openapi::apimachinery::pkg::version::Info>;
}

pub struct RealK8sClient {
    client: Client,
}

impl RealK8sClient {
    pub async fn new(context: Option<String>) -> Result<Self> {
        let mut config = Config::infer().await?;
        if let Some(_ctx) = context {
            config.cluster_url = config.cluster_url; // TODO: switch context
        }
        let client = Client::try_from(config)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl K8sClient for RealK8sClient {
    async fn list_pods(&self, namespace: Option<&str>) -> Result<Vec<Pod>> {
        let api: Api<Pod> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let pods: ObjectList<Pod> = api.list(&ListParams::default()).await?;
        Ok(pods.items)
    }

    async fn get_pod(&self, name: &str, namespace: &str) -> Result<Pod> {
        let api: Api<Pod> = Api::namespaced(self.client.clone(), namespace);
        Ok(api.get(name).await?)
    }

    async fn list_deployments(&self, namespace: Option<&str>) -> Result<Vec<Deployment>> {
        let api: Api<Deployment> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Deployment> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn get_deployment(&self, name: &str, namespace: &str) -> Result<Deployment> {
        let api: Api<Deployment> = Api::namespaced(self.client.clone(), namespace);
        Ok(api.get(name).await?)
    }

    async fn list_services(&self, namespace: Option<&str>) -> Result<Vec<Service>> {
        let api: Api<Service> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Service> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn get_service(&self, name: &str, namespace: &str) -> Result<Service> {
        let api: Api<Service> = Api::namespaced(self.client.clone(), namespace);
        Ok(api.get(name).await?)
    }

    async fn list_nodes(&self) -> Result<Vec<Node>> {
        let api: Api<Node> = Api::all(self.client.clone());
        let items: ObjectList<Node> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn get_node(&self, name: &str) -> Result<Node> {
        let api: Api<Node> = Api::all(self.client.clone());
        Ok(api.get(name).await?)
    }

    async fn list_namespaces(&self) -> Result<Vec<Namespace>> {
        let api: Api<Namespace> = Api::all(self.client.clone());
        let items: ObjectList<Namespace> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn get_namespace(&self, name: &str) -> Result<Namespace> {
        let api: Api<Namespace> = Api::all(self.client.clone());
        Ok(api.get(name).await?)
    }

    async fn list_replicasets(&self, namespace: Option<&str>) -> Result<Vec<ReplicaSet>> {
        let api: Api<ReplicaSet> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<ReplicaSet> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_statefulsets(&self, namespace: Option<&str>) -> Result<Vec<StatefulSet>> {
        let api: Api<StatefulSet> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<StatefulSet> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_daemonsets(&self, namespace: Option<&str>) -> Result<Vec<DaemonSet>> {
        let api: Api<DaemonSet> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<DaemonSet> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_jobs(&self, namespace: Option<&str>) -> Result<Vec<Job>> {
        let api: Api<Job> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Job> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_cronjobs(&self, namespace: Option<&str>) -> Result<Vec<CronJob>> {
        let api: Api<CronJob> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<CronJob> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_configmaps(&self, namespace: Option<&str>) -> Result<Vec<ConfigMap>> {
        let api: Api<ConfigMap> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<ConfigMap> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_secrets(&self, namespace: Option<&str>) -> Result<Vec<Secret>> {
        let api: Api<Secret> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Secret> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_ingresses(&self, namespace: Option<&str>) -> Result<Vec<Ingress>> {
        let api: Api<Ingress> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Ingress> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_networkpolicies(&self, namespace: Option<&str>) -> Result<Vec<NetworkPolicy>> {
        let api: Api<NetworkPolicy> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<NetworkPolicy> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_persistentvolumes(&self) -> Result<Vec<PersistentVolume>> {
        let api: Api<PersistentVolume> = Api::all(self.client.clone());
        let items: ObjectList<PersistentVolume> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_persistentvolumeclaims(&self, namespace: Option<&str>) -> Result<Vec<PersistentVolumeClaim>> {
        let api: Api<PersistentVolumeClaim> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<PersistentVolumeClaim> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_storageclasses(&self) -> Result<Vec<StorageClass>> {
        let api: Api<StorageClass> = Api::all(self.client.clone());
        let items: ObjectList<StorageClass> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_roles(&self, namespace: Option<&str>) -> Result<Vec<Role>> {
        let api: Api<Role> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<Role> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_clusterroles(&self) -> Result<Vec<ClusterRole>> {
        let api: Api<ClusterRole> = Api::all(self.client.clone());
        let items: ObjectList<ClusterRole> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_rolebindings(&self, namespace: Option<&str>) -> Result<Vec<RoleBinding>> {
        let api: Api<RoleBinding> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<RoleBinding> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_clusterrolebindings(&self) -> Result<Vec<ClusterRoleBinding>> {
        let api: Api<ClusterRoleBinding> = Api::all(self.client.clone());
        let items: ObjectList<ClusterRoleBinding> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn list_serviceaccounts(&self, namespace: Option<&str>) -> Result<Vec<ServiceAccount>> {
        let api: Api<ServiceAccount> = if let Some(ns) = namespace {
            Api::namespaced(self.client.clone(), ns)
        } else {
            Api::all(self.client.clone())
        };
        let items: ObjectList<ServiceAccount> = api.list(&ListParams::default()).await?;
        Ok(items.items)
    }

    async fn apiserver_version(&self) -> Result<k8s_openapi::apimachinery::pkg::version::Info> {
        Ok(self.client.apiserver_version().await?)
    }
}

pub use crate::mock_client::MockK8sClient;

pub async fn create_client(context: Option<String>) -> Result<Box<dyn K8sClient>> {
    let use_mock = env::var("USE_MOCK")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    if use_mock {
        Ok(Box::new(MockK8sClient::new()))
    } else {
        Ok(Box::new(RealK8sClient::new(context).await?))
    }
}

#[tauri::command]
pub async fn list_resources(
    context: Option<String>,
    kind: String,
    namespace: Option<String>,
) -> Result<Vec<Value>> {
    let client = create_client(context).await?;

    let resources: Vec<Value> = match kind.as_str() {
        "Pods" => {
            let pods = client.list_pods(namespace.as_deref()).await?;
            pods.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Deployments" => {
            let items = client.list_deployments(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Services" => {
            let items = client.list_services(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Nodes" => {
            let items = client.list_nodes().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Namespaces" => {
            let items = client.list_namespaces().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ReplicaSets" => {
            let items = client.list_replicasets(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "StatefulSets" => {
            let items = client.list_statefulsets(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "DaemonSets" => {
            let items = client.list_daemonsets(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Jobs" => {
            let items = client.list_jobs(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "CronJobs" => {
            let items = client.list_cronjobs(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ConfigMaps" => {
            let items = client.list_configmaps(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Secrets" => {
            let items = client.list_secrets(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Ingresses" => {
            let items = client.list_ingresses(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "NetworkPolicies" => {
            let items = client.list_networkpolicies(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "PersistentVolumes" => {
            let items = client.list_persistentvolumes().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "PersistentVolumeClaims" => {
            let items = client.list_persistentvolumeclaims(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "StorageClasses" => {
            let items = client.list_storageclasses().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Roles" => {
            let items = client.list_roles(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ClusterRoles" => {
            let items = client.list_clusterroles().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "RoleBindings" => {
            let items = client.list_rolebindings(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ClusterRoleBindings" => {
            let items = client.list_clusterrolebindings().await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ServiceAccounts" => {
            let items = client.list_serviceaccounts(namespace.as_deref()).await?;
            items.into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        _ => vec![],
    };

    Ok(resources)
}

#[tauri::command]
pub async fn get_resource_detail(
    context: Option<String>,
    kind: String,
    name: String,
    namespace: Option<String>,
) -> Result<Value> {
    let client = create_client(context).await?;

    let resource: Value = match kind.as_str() {
        "Pod" => {
            let ns = namespace.ok_or_else(|| K8sError::Kube(kube::Error::Api(
                kube::error::ErrorResponse {
                    status: "Failure".to_string(),
                    message: "Namespace required for Pod".to_string(),
                    reason: "BadRequest".to_string(),
                    code: 400,
                },
            )))?;
            let pod = client.get_pod(&name, &ns).await?;
            serde_json::to_value(pod)?
        }
        "Deployment" => {
            let ns = namespace.ok_or_else(|| K8sError::Kube(kube::Error::Api(
                kube::error::ErrorResponse {
                    status: "Failure".to_string(),
                    message: "Namespace required for Deployment".to_string(),
                    reason: "BadRequest".to_string(),
                    code: 400,
                },
            )))?;
            let item = client.get_deployment(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Service" => {
            let ns = namespace.ok_or_else(|| K8sError::Kube(kube::Error::Api(
                kube::error::ErrorResponse {
                    status: "Failure".to_string(),
                    message: "Namespace required for Service".to_string(),
                    reason: "BadRequest".to_string(),
                    code: 400,
                },
            )))?;
            let item = client.get_service(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Node" => {
            let item = client.get_node(&name).await?;
            serde_json::to_value(item)?
        }
        "Namespace" => {
            let item = client.get_namespace(&name).await?;
            serde_json::to_value(item)?
        }
        _ => serde_json::json!({}),
    };

    Ok(resource)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterOverviewInfo {
    pub provider: String,
    #[serde(rename = "projectOrAccount")]
    pub project_or_account: String,
    pub region: String,
    #[serde(rename = "clusterName")]
    pub cluster_name: String,
    #[serde(rename = "clusterVersion")]
    pub cluster_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterStats {
    #[serde(rename = "totalNodes")]
    pub total_nodes: usize,
    #[serde(rename = "readyNodes")]
    pub ready_nodes: usize,
    #[serde(rename = "totalPods")]
    pub total_pods: usize,
    #[serde(rename = "runningPods")]
    pub running_pods: usize,
    #[serde(rename = "namespaceCount")]
    pub namespace_count: usize,
    #[serde(rename = "deploymentCount")]
    pub deployment_count: usize,
    #[serde(rename = "jobCount")]
    pub job_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeInfo {
    pub name: String,
    pub status: String,
    pub version: String,
    #[serde(rename = "osImage")]
    pub os_image: String,
    pub cpu: String,
    pub memory: String,
    #[serde(rename = "creationTimestamp")]
    pub creation_timestamp: Option<String>,
    #[serde(rename = "internalIP")]
    pub internal_ip: Option<String>,
    #[serde(rename = "externalIP")]
    pub external_ip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PodInfo {
    pub name: String,
    pub namespace: String,
    pub status: String,
    pub node: String,
    pub restarts: i32,
    #[serde(rename = "readyContainers")]
    pub ready_containers: Option<usize>,
    #[serde(rename = "totalContainers")]
    pub total_containers: Option<usize>,
    #[serde(rename = "creationTimestamp")]
    pub creation_timestamp: Option<String>,
}

fn parse_context_id(context_id: &str) -> (String, String, String, String) {
    if context_id.starts_with("gke_") {
        let parts: Vec<&str> = context_id.split('_').collect();
        if parts.len() >= 4 {
            return (
                "GKE".to_string(),
                parts[1].to_string(),
                parts[2].to_string(),
                parts[3..].join("_"),
            );
        }
    } else if context_id.starts_with("arn:aws:eks:") {
        let parts: Vec<&str> = context_id.split(':').collect();
        if parts.len() >= 6 {
            let region = parts[3].to_string();
            let account = parts[4].to_string();
            let cluster_name = parts[5].trim_start_matches("cluster/").to_string();
            return ("EKS".to_string(), account, region, cluster_name);
        }
    }
    (
        "Other".to_string(),
        "".to_string(),
        "".to_string(),
        context_id.to_string(),
    )
}

#[tauri::command]
pub async fn get_cluster_overview_info(context_id: String) -> Result<ClusterOverviewInfo> {
    let client = create_client(Some(context_id.clone())).await?;
    let (provider, project_or_account, region, cluster_name) = parse_context_id(&context_id);

    let version_info = client.apiserver_version().await?;
    let cluster_version = format!("{}.{}", version_info.major, version_info.minor);

    Ok(ClusterOverviewInfo {
        provider,
        project_or_account,
        region,
        cluster_name,
        cluster_version,
    })
}

#[tauri::command]
pub async fn get_cluster_stats(context_id: String) -> Result<ClusterStats> {
    let client = create_client(Some(context_id)).await?;

    let nodes = client.list_nodes().await?;
    let total_nodes = nodes.len();
    let ready_nodes = nodes
        .iter()
        .filter(|node| {
            node.status
                .as_ref()
                .and_then(|status| status.conditions.as_ref())
                .map(|conditions| {
                    conditions
                        .iter()
                        .any(|c| c.type_ == "Ready" && c.status == "True")
                })
                .unwrap_or(false)
        })
        .count();

    let pods = client.list_pods(None).await?;
    let total_pods = pods.len();
    let running_pods = pods
        .iter()
        .filter(|pod| {
            pod.status
                .as_ref()
                .and_then(|status| status.phase.as_deref())
                .unwrap_or("")
                == "Running"
        })
        .count();

    let namespaces = client.list_namespaces().await?;
    let namespace_count = namespaces.len();

    let deployments = client.list_deployments(None).await?;
    let deployment_count = deployments.len();

    let jobs = client.list_jobs(None).await?;
    let job_count = jobs.len();

    Ok(ClusterStats {
        total_nodes,
        ready_nodes,
        total_pods,
        running_pods,
        namespace_count,
        deployment_count,
        job_count,
    })
}

#[tauri::command]
pub async fn get_nodes(context_id: String) -> Result<Vec<NodeInfo>> {
    let client = create_client(Some(context_id)).await?;
    let nodes = client.list_nodes().await?;

    let node_infos = nodes
        .iter()
        .map(|node| {
            let name = node.metadata.name.clone().unwrap_or_default();
            let status = node
                .status
                .as_ref()
                .and_then(|status| status.conditions.as_ref())
                .and_then(|conditions| {
                    conditions.iter().find(|c| c.type_ == "Ready").map(|c| {
                        if c.status == "True" {
                            "Ready"
                        } else {
                            "NotReady"
                        }
                    })
                })
                .unwrap_or("Unknown")
                .to_string();
            let version = node
                .status
                .as_ref()
                .and_then(|status| status.node_info.as_ref())
                .map(|info| info.kubelet_version.clone())
                .unwrap_or_default();
            let os_image = node
                .status
                .as_ref()
                .and_then(|status| status.node_info.as_ref())
                .map(|info| info.os_image.clone())
                .unwrap_or_default();
            let cpu = node
                .status
                .as_ref()
                .and_then(|status| status.capacity.as_ref())
                .and_then(|capacity| capacity.get("cpu"))
                .map(|q| q.0.clone())
                .unwrap_or_default();
            let memory = node
                .status
                .as_ref()
                .and_then(|status| status.capacity.as_ref())
                .and_then(|capacity| capacity.get("memory"))
                .map(|q| q.0.clone())
                .unwrap_or_default();
            let creation_timestamp = node
                .metadata
                .creation_timestamp
                .as_ref()
                .map(|ts| ts.0.to_rfc3339());
            let internal_ip = node
                .status
                .as_ref()
                .and_then(|status| status.addresses.as_ref())
                .and_then(|addresses| {
                    addresses
                        .iter()
                        .find(|addr| addr.type_ == "InternalIP")
                        .map(|addr| addr.address.clone())
                });
            let external_ip = node
                .status
                .as_ref()
                .and_then(|status| status.addresses.as_ref())
                .and_then(|addresses| {
                    addresses
                        .iter()
                        .find(|addr| addr.type_ == "ExternalIP")
                        .map(|addr| addr.address.clone())
                });

            NodeInfo {
                name,
                status,
                version,
                os_image,
                cpu,
                memory,
                creation_timestamp,
                internal_ip,
                external_ip,
            }
        })
        .collect();

    Ok(node_infos)
}

#[tauri::command]
pub async fn get_pods(context_id: String) -> Result<Vec<PodInfo>> {
    let client = create_client(Some(context_id)).await?;
    let pods = client.list_pods(None).await?;

    let pod_infos = pods
        .iter()
        .map(|pod| {
            let name = pod.metadata.name.clone().unwrap_or_default();
            let namespace = pod.metadata.namespace.clone().unwrap_or_default();
            let status = pod
                .status
                .as_ref()
                .and_then(|status| status.phase.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            let node = pod
                .spec
                .as_ref()
                .and_then(|spec| spec.node_name.clone())
                .unwrap_or_default();
            let restarts = pod
                .status
                .as_ref()
                .and_then(|status| status.container_statuses.as_ref())
                .map(|statuses| statuses.iter().map(|cs| cs.restart_count).sum::<i32>())
                .unwrap_or(0);
            let total_containers = pod
                .spec
                .as_ref()
                .map(|spec| spec.containers.len())
                .unwrap_or(0);
            let ready_containers = pod
                .status
                .as_ref()
                .and_then(|status| status.container_statuses.as_ref())
                .map(|statuses| statuses.iter().filter(|cs| cs.ready).count())
                .unwrap_or(0);
            let creation_timestamp = pod
                .metadata
                .creation_timestamp
                .as_ref()
                .map(|ts| ts.0.to_rfc3339());

            PodInfo {
                name,
                namespace,
                status,
                node,
                restarts,
                ready_containers: Some(ready_containers),
                total_containers: Some(total_containers),
                creation_timestamp,
            }
        })
        .collect();

    Ok(pod_infos)
}
