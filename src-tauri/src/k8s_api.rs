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
use serde_json::Value;
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

type Result<T> = std::result::Result<T, K8sError>;

pub async fn create_client(context: Option<String>) -> Result<Client> {
    let mut config = Config::infer().await?;
    if let Some(_ctx) = context {
        config.cluster_url = config.cluster_url; // TODO: switch context
    }
    let client = Client::try_from(config)?;
    Ok(client)
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
            let api: Api<Pod> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let pods: ObjectList<Pod> = api.list(&ListParams::default()).await?;
            pods.items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Deployments" => {
            let api: Api<Deployment> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Deployment> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Services" => {
            let api: Api<Service> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Service> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Nodes" => {
            let api: Api<Node> = Api::all(client);
            let items: ObjectList<Node> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Namespaces" => {
            let api: Api<Namespace> = Api::all(client);
            let items: ObjectList<Namespace> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ReplicaSets" => {
            let api: Api<ReplicaSet> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<ReplicaSet> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "StatefulSets" => {
            let api: Api<StatefulSet> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<StatefulSet> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "DaemonSets" => {
            let api: Api<DaemonSet> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<DaemonSet> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Jobs" => {
            let api: Api<Job> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Job> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "CronJobs" => {
            let api: Api<CronJob> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<CronJob> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ConfigMaps" => {
            let api: Api<ConfigMap> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<ConfigMap> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Secrets" => {
            let api: Api<Secret> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Secret> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Ingresses" => {
            let api: Api<Ingress> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Ingress> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "NetworkPolicies" => {
            let api: Api<NetworkPolicy> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<NetworkPolicy> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "PersistentVolumes" => {
            let api: Api<PersistentVolume> = Api::all(client);
            let items: ObjectList<PersistentVolume> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "PersistentVolumeClaims" => {
            let api: Api<PersistentVolumeClaim> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<PersistentVolumeClaim> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "StorageClasses" => {
            let api: Api<StorageClass> = Api::all(client);
            let items: ObjectList<StorageClass> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "Roles" => {
            let api: Api<Role> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<Role> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ClusterRoles" => {
            let api: Api<ClusterRole> = Api::all(client);
            let items: ObjectList<ClusterRole> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "RoleBindings" => {
            let api: Api<RoleBinding> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<RoleBinding> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ClusterRoleBindings" => {
            let api: Api<ClusterRoleBinding> = Api::all(client);
            let items: ObjectList<ClusterRoleBinding> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
                .map(|p| serde_json::to_value(p).unwrap())
                .collect()
        }
        "ServiceAccounts" => {
            let api: Api<ServiceAccount> = if let Some(ns) = namespace {
                Api::namespaced(client, &ns)
            } else {
                Api::all(client)
            };
            let items: ObjectList<ServiceAccount> = api.list(&ListParams::default()).await?;
            items
                .items
                .into_iter()
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
            let api: Api<Pod> = if let Some(ns) = &namespace {
                Api::namespaced(client, ns)
            } else {
                return Err(K8sError::Kube(kube::Error::Api(
                    kube::error::ErrorResponse {
                        status: "Failure".to_string(),
                        message: "Namespace required for Pod".to_string(),
                        reason: "BadRequest".to_string(),
                        code: 400,
                    },
                )));
            };
            let pod = api.get(&name).await?;
            serde_json::to_value(pod)?
        }
        "Deployment" => {
            let api: Api<Deployment> = if let Some(ns) = &namespace {
                Api::namespaced(client, ns)
            } else {
                return Err(K8sError::Kube(kube::Error::Api(
                    kube::error::ErrorResponse {
                        status: "Failure".to_string(),
                        message: "Namespace required for Deployment".to_string(),
                        reason: "BadRequest".to_string(),
                        code: 400,
                    },
                )));
            };
            let item = api.get(&name).await?;
            serde_json::to_value(item)?
        }
        "Service" => {
            let api: Api<Service> = if let Some(ns) = &namespace {
                Api::namespaced(client, ns)
            } else {
                return Err(K8sError::Kube(kube::Error::Api(
                    kube::error::ErrorResponse {
                        status: "Failure".to_string(),
                        message: "Namespace required for Service".to_string(),
                        reason: "BadRequest".to_string(),
                        code: 400,
                    },
                )));
            };
            let item = api.get(&name).await?;
            serde_json::to_value(item)?
        }
        "Node" => {
            let api: Api<Node> = Api::all(client);
            let item = api.get(&name).await?;
            serde_json::to_value(item)?
        }
        "Namespace" => {
            let api: Api<Namespace> = Api::all(client);
            let item = api.get(&name).await?;
            serde_json::to_value(item)?
        }
        _ => serde_json::json!({}),
    };

    Ok(resource)
}
