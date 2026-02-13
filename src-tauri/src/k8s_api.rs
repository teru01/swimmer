use async_trait::async_trait;
use futures::StreamExt;
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::autoscaling::v2::HorizontalPodAutoscaler;
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::core::v1::{
    ConfigMap, Endpoints, Event, LimitRange, Namespace, Node, PersistentVolume,
    PersistentVolumeClaim, Pod, ResourceQuota, Secret, Service, ServiceAccount,
};
use k8s_openapi::api::networking::v1::{Ingress, NetworkPolicy};
use k8s_openapi::api::rbac::v1::{ClusterRole, ClusterRoleBinding, Role, RoleBinding};
use k8s_openapi::api::storage::v1::StorageClass;
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
use kube::{
    api::{
        Api, ApiResource, DeleteParams, DynamicObject, ListParams, ObjectList, Patch, PatchParams,
    },
    config::{Config, InferConfigError, KubeConfigOptions, Kubeconfig, KubeconfigError},
    runtime::watcher,
    Client,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use thiserror::Error;

const CLIENT_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Hash, Eq, PartialEq, Clone)]
pub(crate) struct ClientCacheKey {
    context: Option<String>,
    kubeconfig_path: Option<String>,
}

pub(crate) struct CachedClient {
    client: Client,
    created_at: Instant,
}

pub type K8sClientPool = Arc<Mutex<HashMap<ClientCacheKey, CachedClient>>>;

#[derive(Debug, Error)]
pub enum K8sError {
    #[error("Kube error: {0}")]
    Kube(#[from] kube::Error),
    #[error("Config error: {0}")]
    Config(#[from] InferConfigError),
    #[error("Kubeconfig error: {0}")]
    KubeconfigError(#[from] KubeconfigError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Lock error: {0}")]
    Lock(String),
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CrdResourceInfo {
    pub kind: String,
    pub plural: String,
    pub version: String,
    pub scope: String,
    pub group: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CrdGroup {
    pub group: String,
    pub resources: Vec<CrdResourceInfo>,
}

macro_rules! define_k8s_trait {
    (
        namespaced: [$(($NType:ty, $n_list_fn:ident, $n_get_fn:ident)),* $(,)?],
        cluster: [$(($CType:ty, $c_list_fn:ident, $c_get_fn:ident)),* $(,)?]
    ) => {
        #[async_trait]
        pub trait K8sClient: Send + Sync {
            $(
                async fn $n_list_fn(&self, namespace: Option<&str>) -> Result<Vec<$NType>>;
                async fn $n_get_fn(&self, name: &str, namespace: &str) -> Result<$NType>;
            )*
            $(
                async fn $c_list_fn(&self) -> Result<Vec<$CType>>;
                async fn $c_get_fn(&self, name: &str) -> Result<$CType>;
            )*
            async fn list_crds(&self) -> Result<Vec<CustomResourceDefinition>>;
            async fn list_custom_resources(
                &self,
                group: &str,
                version: &str,
                plural: &str,
                scope: &str,
                namespace: Option<&str>,
            ) -> Result<Vec<Value>>;
            async fn get_custom_resource(
                &self,
                group: &str,
                version: &str,
                plural: &str,
                scope: &str,
                name: &str,
                namespace: Option<&str>,
            ) -> Result<Value>;
            async fn apiserver_version(&self) -> Result<k8s_openapi::apimachinery::pkg::version::Info>;
            async fn delete_resource(&self, kind: &str, name: &str, namespace: Option<&str>) -> Result<()>;
            async fn rollout_restart_deployment(&self, name: &str, namespace: &str) -> Result<()>;
        }
    };
}

macro_rules! define_k8s_impl {
    (
        namespaced: [$(($NType:ty, $n_list_fn:ident, $n_get_fn:ident)),* $(,)?],
        cluster: [$(($CType:ty, $c_list_fn:ident, $c_get_fn:ident)),* $(,)?]
    ) => {
        #[async_trait]
        impl K8sClient for RealK8sClient {
            $(
                async fn $n_list_fn(&self, namespace: Option<&str>) -> Result<Vec<$NType>> {
                    let api: Api<$NType> = if let Some(ns) = namespace {
                        Api::namespaced(self.client.clone(), ns)
                    } else {
                        Api::all(self.client.clone())
                    };
                    let items: ObjectList<$NType> = api.list(&ListParams::default()).await?;
                    Ok(items.items)
                }

                async fn $n_get_fn(&self, name: &str, namespace: &str) -> Result<$NType> {
                    let api: Api<$NType> = Api::namespaced(self.client.clone(), namespace);
                    Ok(api.get(name).await?)
                }
            )*
            $(
                async fn $c_list_fn(&self) -> Result<Vec<$CType>> {
                    let api: Api<$CType> = Api::all(self.client.clone());
                    let items: ObjectList<$CType> = api.list(&ListParams::default()).await?;
                    Ok(items.items)
                }

                async fn $c_get_fn(&self, name: &str) -> Result<$CType> {
                    let api: Api<$CType> = Api::all(self.client.clone());
                    Ok(api.get(name).await?)
                }
            )*

            async fn list_crds(&self) -> Result<Vec<CustomResourceDefinition>> {
                let api: Api<CustomResourceDefinition> = Api::all(self.client.clone());
                let items: ObjectList<CustomResourceDefinition> = api.list(&ListParams::default()).await?;
                Ok(items.items)
            }

            async fn list_custom_resources(
                &self,
                group: &str,
                version: &str,
                plural: &str,
                scope: &str,
                namespace: Option<&str>,
            ) -> Result<Vec<Value>> {
                let ar = ApiResource {
                    group: group.to_string(),
                    version: version.to_string(),
                    api_version: format!("{}/{}", group, version),
                    kind: String::new(),
                    plural: plural.to_string(),
                };
                let api: Api<DynamicObject> = match scope {
                    "Namespaced" => match namespace {
                        Some(ns) => Api::namespaced_with(self.client.clone(), ns, &ar),
                        None => Api::all_with(self.client.clone(), &ar),
                    },
                    _ => Api::all_with(self.client.clone(), &ar),
                };
                let items = api.list(&ListParams::default()).await?;
                let values: Vec<Value> = items
                    .items
                    .into_iter()
                    .map(|item| serde_json::to_value(item))
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                Ok(values)
            }

            async fn get_custom_resource(
                &self,
                group: &str,
                version: &str,
                plural: &str,
                scope: &str,
                name: &str,
                namespace: Option<&str>,
            ) -> Result<Value> {
                let ar = ApiResource {
                    group: group.to_string(),
                    version: version.to_string(),
                    api_version: format!("{}/{}", group, version),
                    kind: String::new(),
                    plural: plural.to_string(),
                };
                let api: Api<DynamicObject> = match scope {
                    "Namespaced" => match namespace {
                        Some(ns) => Api::namespaced_with(self.client.clone(), ns, &ar),
                        None => return Err(require_namespace("CustomResource")),
                    },
                    _ => Api::all_with(self.client.clone(), &ar),
                };
                let item = api.get(name).await?;
                Ok(serde_json::to_value(item)?)
            }

            async fn apiserver_version(&self) -> Result<k8s_openapi::apimachinery::pkg::version::Info> {
                Ok(self.client.apiserver_version().await?)
            }

            async fn delete_resource(&self, kind: &str, name: &str, namespace: Option<&str>) -> Result<()> {
                let dp = DeleteParams::default();
                match kind {
                    "Pod" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Pod"))?;
                        let api: Api<Pod> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Deployment" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Deployment"))?;
                        let api: Api<Deployment> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Service" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Service"))?;
                        let api: Api<Service> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "ReplicaSet" => {
                        let ns = namespace.ok_or_else(|| require_namespace("ReplicaSet"))?;
                        let api: Api<ReplicaSet> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "StatefulSet" => {
                        let ns = namespace.ok_or_else(|| require_namespace("StatefulSet"))?;
                        let api: Api<StatefulSet> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "DaemonSet" => {
                        let ns = namespace.ok_or_else(|| require_namespace("DaemonSet"))?;
                        let api: Api<DaemonSet> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Job" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Job"))?;
                        let api: Api<Job> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "CronJob" => {
                        let ns = namespace.ok_or_else(|| require_namespace("CronJob"))?;
                        let api: Api<CronJob> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "ConfigMap" => {
                        let ns = namespace.ok_or_else(|| require_namespace("ConfigMap"))?;
                        let api: Api<ConfigMap> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Secret" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Secret"))?;
                        let api: Api<Secret> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Ingress" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Ingress"))?;
                        let api: Api<Ingress> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "NetworkPolicy" => {
                        let ns = namespace.ok_or_else(|| require_namespace("NetworkPolicy"))?;
                        let api: Api<NetworkPolicy> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "PersistentVolume" => {
                        let api: Api<PersistentVolume> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "PersistentVolumeClaim" => {
                        let ns = namespace.ok_or_else(|| require_namespace("PersistentVolumeClaim"))?;
                        let api: Api<PersistentVolumeClaim> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "StorageClass" => {
                        let api: Api<StorageClass> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "Role" => {
                        let ns = namespace.ok_or_else(|| require_namespace("Role"))?;
                        let api: Api<Role> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "ClusterRole" => {
                        let api: Api<ClusterRole> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "RoleBinding" => {
                        let ns = namespace.ok_or_else(|| require_namespace("RoleBinding"))?;
                        let api: Api<RoleBinding> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "ClusterRoleBinding" => {
                        let api: Api<ClusterRoleBinding> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "ServiceAccount" => {
                        let ns = namespace.ok_or_else(|| require_namespace("ServiceAccount"))?;
                        let api: Api<ServiceAccount> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "Namespace" => {
                        let api: Api<Namespace> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "Node" => {
                        let api: Api<Node> = Api::all(self.client.clone());
                        api.delete(name, &dp).await?;
                    }
                    "HorizontalPodAutoscaler" => {
                        let ns = namespace.ok_or_else(|| require_namespace("HorizontalPodAutoscaler"))?;
                        let api: Api<HorizontalPodAutoscaler> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "LimitRange" => {
                        let ns = namespace.ok_or_else(|| require_namespace("LimitRange"))?;
                        let api: Api<LimitRange> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    "ResourceQuota" => {
                        let ns = namespace.ok_or_else(|| require_namespace("ResourceQuota"))?;
                        let api: Api<ResourceQuota> = Api::namespaced(self.client.clone(), ns);
                        api.delete(name, &dp).await?;
                    }
                    cr_kind if cr_kind.starts_with("cr:") => {
                        let parts: Vec<&str> = cr_kind[3..].splitn(4, '/').collect();
                        if parts.len() == 4 {
                            let ar = ApiResource {
                                group: parts[0].to_string(),
                                version: parts[1].to_string(),
                                api_version: format!("{}/{}", parts[0], parts[1]),
                                kind: String::new(),
                                plural: parts[2].to_string(),
                            };
                            let api: Api<DynamicObject> = match parts[3] {
                                "Namespaced" => match namespace {
                                    Some(ns) => Api::namespaced_with(self.client.clone(), ns, &ar),
                                    None => return Err(require_namespace("CustomResource")),
                                },
                                _ => Api::all_with(self.client.clone(), &ar),
                            };
                            api.delete(name, &dp).await?;
                        } else {
                            return Err(K8sError::Kube(kube::Error::Api(
                                kube::error::ErrorResponse {
                                    status: "Failure".to_string(),
                                    message: format!("Invalid custom resource kind format: {}", cr_kind),
                                    reason: "BadRequest".to_string(),
                                    code: 400,
                                },
                            )));
                        }
                    }
                    _ => {
                        return Err(K8sError::Kube(kube::Error::Api(
                            kube::error::ErrorResponse {
                                status: "Failure".to_string(),
                                message: format!("Unsupported resource kind for delete: {}", kind),
                                reason: "BadRequest".to_string(),
                                code: 400,
                            },
                        )));
                    }
                }
                Ok(())
            }

            async fn rollout_restart_deployment(&self, name: &str, namespace: &str) -> Result<()> {
                let api: Api<Deployment> = Api::namespaced(self.client.clone(), namespace);
                let now = chrono::Utc::now().to_rfc3339();
                let patch = serde_json::json!({
                    "spec": {
                        "template": {
                            "metadata": {
                                "annotations": {
                                    "kubectl.kubernetes.io/restartedAt": now
                                }
                            }
                        }
                    }
                });
                api.patch(name, &PatchParams::apply("swimmer"), &Patch::Merge(&patch))
                    .await?;
                Ok(())
            }
        }
    };
}

define_k8s_trait!(
    namespaced: [
        (Pod, list_pods, get_pod),
        (Deployment, list_deployments, get_deployment),
        (Service, list_services, get_service),
        (ReplicaSet, list_replicasets, get_replicaset),
        (StatefulSet, list_statefulsets, get_statefulset),
        (DaemonSet, list_daemonsets, get_daemonset),
        (Job, list_jobs, get_job),
        (CronJob, list_cronjobs, get_cronjob),
        (ConfigMap, list_configmaps, get_configmap),
        (Secret, list_secrets, get_secret),
        (Ingress, list_ingresses, get_ingress),
        (NetworkPolicy, list_networkpolicies, get_networkpolicy),
        (PersistentVolumeClaim, list_persistentvolumeclaims, get_persistentvolumeclaim),
        (Role, list_roles, get_role),
        (RoleBinding, list_rolebindings, get_rolebinding),
        (ServiceAccount, list_serviceaccounts, get_serviceaccount),
        (Endpoints, list_endpoints, get_endpoints),
        (Event, list_events, get_event),
        (HorizontalPodAutoscaler, list_horizontalpodautoscalers, get_horizontalpodautoscaler),
        (LimitRange, list_limitranges, get_limitrange),
        (ResourceQuota, list_resourcequotas, get_resourcequota),
    ],
    cluster: [
        (Node, list_nodes, get_node),
        (Namespace, list_namespaces, get_namespace),
        (PersistentVolume, list_persistentvolumes, get_persistentvolume),
        (StorageClass, list_storageclasses, get_storageclass),
        (ClusterRole, list_clusterroles, get_clusterrole),
        (ClusterRoleBinding, list_clusterrolebindings, get_clusterrolebinding),
    ]
);

pub struct RealK8sClient {
    client: Client,
}

impl RealK8sClient {
    pub async fn new(context: Option<String>, kubeconfig_path: Option<String>) -> Result<Self> {
        let config = if let Some(ctx) = context {
            let kubeconfig = if let Some(ref path) = kubeconfig_path {
                Kubeconfig::read_from(path)?
            } else {
                let home_dir = dirs::home_dir().ok_or_else(|| {
                    K8sError::Io(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Could not determine home directory",
                    ))
                })?;
                let default_path = home_dir.join(".kube/config");
                Kubeconfig::read_from(&default_path)?
            };

            let config_options = KubeConfigOptions {
                context: Some(ctx),
                cluster: None,
                user: None,
            };

            Config::from_custom_kubeconfig(kubeconfig, &config_options).await?
        } else {
            Config::infer().await?
        };

        let client = Client::try_from(config)?;
        Ok(Self { client })
    }
}

define_k8s_impl!(
    namespaced: [
        (Pod, list_pods, get_pod),
        (Deployment, list_deployments, get_deployment),
        (Service, list_services, get_service),
        (ReplicaSet, list_replicasets, get_replicaset),
        (StatefulSet, list_statefulsets, get_statefulset),
        (DaemonSet, list_daemonsets, get_daemonset),
        (Job, list_jobs, get_job),
        (CronJob, list_cronjobs, get_cronjob),
        (ConfigMap, list_configmaps, get_configmap),
        (Secret, list_secrets, get_secret),
        (Ingress, list_ingresses, get_ingress),
        (NetworkPolicy, list_networkpolicies, get_networkpolicy),
        (PersistentVolumeClaim, list_persistentvolumeclaims, get_persistentvolumeclaim),
        (Role, list_roles, get_role),
        (RoleBinding, list_rolebindings, get_rolebinding),
        (ServiceAccount, list_serviceaccounts, get_serviceaccount),
        (Endpoints, list_endpoints, get_endpoints),
        (Event, list_events, get_event),
        (HorizontalPodAutoscaler, list_horizontalpodautoscalers, get_horizontalpodautoscaler),
        (LimitRange, list_limitranges, get_limitrange),
        (ResourceQuota, list_resourcequotas, get_resourcequota),
    ],
    cluster: [
        (Node, list_nodes, get_node),
        (Namespace, list_namespaces, get_namespace),
        (PersistentVolume, list_persistentvolumes, get_persistentvolume),
        (StorageClass, list_storageclasses, get_storageclass),
        (ClusterRole, list_clusterroles, get_clusterrole),
        (ClusterRoleBinding, list_clusterrolebindings, get_clusterrolebinding),
    ]
);

pub use crate::mock_client::MockK8sClient;

async fn get_or_create_raw_client(
    pool: &K8sClientPool,
    context: Option<String>,
    kubeconfig_path: Option<String>,
) -> Result<Client> {
    let key = ClientCacheKey {
        context: context.clone(),
        kubeconfig_path: kubeconfig_path.clone(),
    };

    {
        let mut pool_guard = pool.lock().map_err(|e| K8sError::Lock(e.to_string()))?;
        pool_guard.retain(|_, v| v.created_at.elapsed() < CLIENT_CACHE_TTL);
        if let Some(cached) = pool_guard.get(&key) {
            return Ok(cached.client.clone());
        }
    }

    let real_client = RealK8sClient::new(context, kubeconfig_path).await?;
    let client = real_client.client.clone();

    {
        let mut pool_guard = pool.lock().map_err(|e| K8sError::Lock(e.to_string()))?;
        pool_guard.insert(
            key,
            CachedClient {
                client: client.clone(),
                created_at: Instant::now(),
            },
        );
    }

    Ok(client)
}

async fn get_or_create_client(
    pool: &K8sClientPool,
    context: Option<String>,
    kubeconfig_path: Option<String>,
) -> Result<Box<dyn K8sClient>> {
    let use_mock = env::var("USE_MOCK")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    if use_mock {
        Ok(Box::new(MockK8sClient::new()))
    } else {
        let client = get_or_create_raw_client(pool, context, kubeconfig_path).await?;
        Ok(Box::new(RealK8sClient { client }))
    }
}

fn serialize_resources<T: serde::Serialize>(items: Vec<T>) -> Vec<Value> {
    items
        .into_iter()
        .filter_map(|item| match serde_json::to_value(item) {
            Ok(v) => Some(v),
            Err(e) => {
                log::warn!("Failed to serialize resource: {}", e);
                None
            }
        })
        .collect()
}

#[tauri::command]
pub async fn list_resources(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
    kind: String,
    namespace: Option<String>,
) -> Result<Vec<Value>> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, context, kc_path).await?;

    let resources: Vec<Value> = match kind.as_str() {
        "Pods" => serialize_resources(client.list_pods(namespace.as_deref()).await?),
        "Deployments" => serialize_resources(client.list_deployments(namespace.as_deref()).await?),
        "Services" => serialize_resources(client.list_services(namespace.as_deref()).await?),
        "Nodes" => serialize_resources(client.list_nodes().await?),
        "Namespaces" => serialize_resources(client.list_namespaces().await?),
        "ReplicaSets" => serialize_resources(client.list_replicasets(namespace.as_deref()).await?),
        "StatefulSets" => {
            serialize_resources(client.list_statefulsets(namespace.as_deref()).await?)
        }
        "DaemonSets" => serialize_resources(client.list_daemonsets(namespace.as_deref()).await?),
        "Jobs" => serialize_resources(client.list_jobs(namespace.as_deref()).await?),
        "CronJobs" => serialize_resources(client.list_cronjobs(namespace.as_deref()).await?),
        "ConfigMaps" => serialize_resources(client.list_configmaps(namespace.as_deref()).await?),
        "Secrets" => serialize_resources(client.list_secrets(namespace.as_deref()).await?),
        "Ingresses" => serialize_resources(client.list_ingresses(namespace.as_deref()).await?),
        "NetworkPolicies" => {
            serialize_resources(client.list_networkpolicies(namespace.as_deref()).await?)
        }
        "PersistentVolumes" => serialize_resources(client.list_persistentvolumes().await?),
        "PersistentVolumeClaims" => serialize_resources(
            client
                .list_persistentvolumeclaims(namespace.as_deref())
                .await?,
        ),
        "StorageClasses" => serialize_resources(client.list_storageclasses().await?),
        "Roles" => serialize_resources(client.list_roles(namespace.as_deref()).await?),
        "ClusterRoles" => serialize_resources(client.list_clusterroles().await?),
        "RoleBindings" => {
            serialize_resources(client.list_rolebindings(namespace.as_deref()).await?)
        }
        "ClusterRoleBindings" => serialize_resources(client.list_clusterrolebindings().await?),
        "ServiceAccounts" => {
            serialize_resources(client.list_serviceaccounts(namespace.as_deref()).await?)
        }
        "Endpoints" => serialize_resources(client.list_endpoints(namespace.as_deref()).await?),
        "Events" => serialize_resources(client.list_events(namespace.as_deref()).await?),
        "HorizontalPodAutoscalers" => serialize_resources(
            client
                .list_horizontalpodautoscalers(namespace.as_deref())
                .await?,
        ),
        "LimitRanges" => serialize_resources(client.list_limitranges(namespace.as_deref()).await?),
        "ResourceQuotas" => {
            serialize_resources(client.list_resourcequotas(namespace.as_deref()).await?)
        }
        "CRDs" => serialize_resources(client.list_crds().await?),
        cr_kind if cr_kind.starts_with("cr:") => {
            let parts: Vec<&str> = cr_kind[3..].splitn(4, '/').collect();
            if parts.len() == 4 {
                client
                    .list_custom_resources(
                        parts[0],
                        parts[1],
                        parts[2],
                        parts[3],
                        namespace.as_deref(),
                    )
                    .await?
            } else {
                return Err(K8sError::Kube(kube::Error::Api(
                    kube::error::ErrorResponse {
                        status: "Failure".to_string(),
                        message: format!("Invalid custom resource kind format: {}", cr_kind),
                        reason: "BadRequest".to_string(),
                        code: 400,
                    },
                )));
            }
        }
        _ => vec![],
    };

    Ok(resources)
}

fn require_namespace(kind: &str) -> K8sError {
    K8sError::Kube(kube::Error::Api(kube::error::ErrorResponse {
        status: "Failure".to_string(),
        message: format!("Namespace required for {}", kind),
        reason: "BadRequest".to_string(),
        code: 400,
    }))
}

#[tauri::command]
pub async fn get_resource_detail(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
    kind: String,
    name: String,
    namespace: Option<String>,
) -> Result<Value> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, context, kc_path).await?;
    let namespace_for_events = namespace.clone();

    let resource: Value = match kind.as_str() {
        "Pod" => {
            let ns = namespace.ok_or_else(|| require_namespace("Pod"))?;
            let pod = client.get_pod(&name, &ns).await?;
            serde_json::to_value(pod)?
        }
        "Deployment" => {
            let ns = namespace.ok_or_else(|| require_namespace("Deployment"))?;
            let item = client.get_deployment(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Service" => {
            let ns = namespace.ok_or_else(|| require_namespace("Service"))?;
            let item = client.get_service(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "ReplicaSet" => {
            let ns = namespace.ok_or_else(|| require_namespace("ReplicaSet"))?;
            let item = client.get_replicaset(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "StatefulSet" => {
            let ns = namespace.ok_or_else(|| require_namespace("StatefulSet"))?;
            let item = client.get_statefulset(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "DaemonSet" => {
            let ns = namespace.ok_or_else(|| require_namespace("DaemonSet"))?;
            let item = client.get_daemonset(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Job" => {
            let ns = namespace.ok_or_else(|| require_namespace("Job"))?;
            let item = client.get_job(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "CronJob" => {
            let ns = namespace.ok_or_else(|| require_namespace("CronJob"))?;
            let item = client.get_cronjob(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "ConfigMap" => {
            let ns = namespace.ok_or_else(|| require_namespace("ConfigMap"))?;
            let item = client.get_configmap(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Secret" => {
            let ns = namespace.ok_or_else(|| require_namespace("Secret"))?;
            let item = client.get_secret(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Ingress" => {
            let ns = namespace.ok_or_else(|| require_namespace("Ingress"))?;
            let item = client.get_ingress(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "NetworkPolicy" => {
            let ns = namespace.ok_or_else(|| require_namespace("NetworkPolicy"))?;
            let item = client.get_networkpolicy(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "PersistentVolumeClaim" => {
            let ns = namespace.ok_or_else(|| require_namespace("PersistentVolumeClaim"))?;
            let item = client.get_persistentvolumeclaim(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Role" => {
            let ns = namespace.ok_or_else(|| require_namespace("Role"))?;
            let item = client.get_role(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "RoleBinding" => {
            let ns = namespace.ok_or_else(|| require_namespace("RoleBinding"))?;
            let item = client.get_rolebinding(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "ServiceAccount" => {
            let ns = namespace.ok_or_else(|| require_namespace("ServiceAccount"))?;
            let item = client.get_serviceaccount(&name, &ns).await?;
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
        "PersistentVolume" => {
            let item = client.get_persistentvolume(&name).await?;
            serde_json::to_value(item)?
        }
        "StorageClass" => {
            let item = client.get_storageclass(&name).await?;
            serde_json::to_value(item)?
        }
        "ClusterRole" => {
            let item = client.get_clusterrole(&name).await?;
            serde_json::to_value(item)?
        }
        "ClusterRoleBinding" => {
            let item = client.get_clusterrolebinding(&name).await?;
            serde_json::to_value(item)?
        }
        "Endpoints" => {
            let ns = namespace.ok_or_else(|| require_namespace("Endpoints"))?;
            let item = client.get_endpoints(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "Event" => {
            let ns = namespace.ok_or_else(|| require_namespace("Event"))?;
            let item = client.get_event(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "HorizontalPodAutoscaler" => {
            let ns = namespace.ok_or_else(|| require_namespace("HorizontalPodAutoscaler"))?;
            let item = client.get_horizontalpodautoscaler(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "LimitRange" => {
            let ns = namespace.ok_or_else(|| require_namespace("LimitRange"))?;
            let item = client.get_limitrange(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        "ResourceQuota" => {
            let ns = namespace.ok_or_else(|| require_namespace("ResourceQuota"))?;
            let item = client.get_resourcequota(&name, &ns).await?;
            serde_json::to_value(item)?
        }
        cr_kind if cr_kind.starts_with("cr:") => {
            let parts: Vec<&str> = cr_kind[3..].splitn(4, '/').collect();
            if parts.len() == 4 {
                client
                    .get_custom_resource(
                        parts[0],
                        parts[1],
                        parts[2],
                        parts[3],
                        &name,
                        namespace.as_deref(),
                    )
                    .await?
            } else {
                return Err(K8sError::Kube(kube::Error::Api(
                    kube::error::ErrorResponse {
                        status: "Failure".to_string(),
                        message: format!("Invalid custom resource kind format: {}", cr_kind),
                        reason: "BadRequest".to_string(),
                        code: 400,
                    },
                )));
            }
        }
        _ => serde_json::json!({}),
    };

    let event_supported_kinds = [
        "Pod",
        "Deployment",
        "ReplicaSet",
        "StatefulSet",
        "DaemonSet",
        "Service",
        "Job",
        "CronJob",
        "ConfigMap",
        "Secret",
        "PersistentVolume",
        "PersistentVolumeClaim",
    ];

    let events: Vec<Value> = if event_supported_kinds.contains(&kind.as_str()) {
        let ns = namespace_for_events.as_deref();
        let all_events = client.list_events(ns).await?;
        let filtered_events: Vec<Event> = all_events
            .into_iter()
            .filter(|event| {
                let involved_object = &event.involved_object;
                involved_object.kind.as_deref() == Some(&kind)
                    && involved_object.name.as_deref() == Some(&name)
                    && (involved_object.namespace.as_deref() == ns
                        || (involved_object.namespace.is_none() && ns.is_none()))
            })
            .collect();
        filtered_events
            .into_iter()
            .filter_map(|e| serde_json::to_value(e).ok())
            .collect()
    } else {
        vec![]
    };

    Ok(serde_json::json!({
        "resource": resource,
        "events": events,
    }))
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
pub async fn get_cluster_overview_info(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context_id: String,
) -> Result<ClusterOverviewInfo> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, Some(context_id.clone()), kc_path).await?;
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
pub async fn get_cluster_stats(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context_id: String,
) -> Result<ClusterStats> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, Some(context_id), kc_path).await?;

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
pub async fn list_crd_groups(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
) -> Result<Vec<CrdGroup>> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, context, kc_path).await?;
    let crds = client.list_crds().await?;

    let mut groups: HashMap<String, Vec<CrdResourceInfo>> = HashMap::new();

    for crd in crds {
        let group = crd.spec.group.clone();
        let kind = crd.spec.names.kind.clone();
        let plural = crd.spec.names.plural.clone();
        let scope = crd.spec.scope.clone();

        let version = crd
            .spec
            .versions
            .iter()
            .find(|v| v.served)
            .map(|v| v.name.clone())
            .unwrap_or_default();

        let info = CrdResourceInfo {
            kind,
            plural,
            version,
            scope,
            group: group.clone(),
        };

        groups.entry(group).or_default().push(info);
    }

    let mut result: Vec<CrdGroup> = groups
        .into_iter()
        .map(|(group, mut resources)| {
            resources.sort_by(|a, b| a.kind.cmp(&b.kind));
            CrdGroup { group, resources }
        })
        .collect();
    result.sort_by(|a, b| a.group.cmp(&b.group));

    Ok(result)
}

pub type WatcherHandle = Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>;

#[derive(Clone, Serialize)]
struct ResourceWatchEvent {
    event_type: String,
    resource: Value,
}

fn run_watcher<T>(app: AppHandle, api: Api<T>, watch_id: String) -> tokio::task::JoinHandle<()>
where
    T: kube::Resource
        + serde::de::DeserializeOwned
        + serde::Serialize
        + Clone
        + std::fmt::Debug
        + Send
        + 'static,
    <T as kube::Resource>::DynamicType: Default,
{
    let stream = watcher(api, watcher::Config::default());

    tokio::spawn(async move {
        log::info!("Watch stream task started for watch_id: {}", watch_id);
        futures::pin_mut!(stream);
        while let Some(result) = stream.next().await {
            log::debug!("Watch stream received event for watch_id: {}", watch_id);
            match result {
                Ok(event) => {
                    use kube::runtime::watcher::Event;
                    let (event_type, resource) = match event {
                        Event::Apply(obj) => ("modified", obj),
                        Event::Delete(obj) => ("deleted", obj),
                        Event::InitApply(obj) => ("modified", obj),
                        Event::Init | Event::InitDone => continue,
                    };

                    if let Ok(value) = serde_json::to_value(&resource) {
                        let _ = app.emit(
                            &format!("resource-watch-{}", watch_id),
                            ResourceWatchEvent {
                                event_type: event_type.to_string(),
                                resource: value,
                            },
                        );
                    }
                }
                Err(e) => {
                    log::warn!("Watch error (will retry): {}", e);
                }
            }
        }
    })
}

fn watch_namespaced_or_all<T>(
    app: AppHandle,
    client: Client,
    namespace: Option<String>,
    watch_id: String,
) -> tokio::task::JoinHandle<()>
where
    T: kube::Resource<Scope = kube::core::NamespaceResourceScope>
        + serde::de::DeserializeOwned
        + serde::Serialize
        + Clone
        + std::fmt::Debug
        + Send
        + 'static,
    <T as kube::Resource>::DynamicType: Default,
{
    let api: Api<T> = if let Some(ns) = namespace.as_deref() {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };
    run_watcher(app, api, watch_id)
}

fn watch_cluster_scoped<T>(
    app: AppHandle,
    client: Client,
    watch_id: String,
) -> tokio::task::JoinHandle<()>
where
    T: kube::Resource<Scope = kube::core::ClusterResourceScope>
        + serde::de::DeserializeOwned
        + serde::Serialize
        + Clone
        + std::fmt::Debug
        + Send
        + 'static,
    <T as kube::Resource>::DynamicType: Default,
{
    let api: Api<T> = Api::all(client);
    run_watcher(app, api, watch_id)
}

#[tauri::command]
pub async fn start_watch_resources(
    app: AppHandle,
    watcher_handle: tauri::State<'_, WatcherHandle>,
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
    kind: String,
    namespace: Option<String>,
) -> Result<String> {
    log::info!(
        "start_watch_resources called: kind={}, namespace={:?}, context={:?}",
        kind,
        namespace,
        context
    );
    let watch_id = uuid::Uuid::new_v4().to_string();
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();

    let client = get_or_create_raw_client(&client_pool, context, kc_path).await?;

    log::info!(
        "Starting watch for kind: {}, namespace: {:?}, watch_id: {}",
        kind,
        namespace,
        watch_id
    );

    let handle = match kind.as_str() {
        "Pods" => watch_namespaced_or_all::<Pod>(app, client, namespace, watch_id.clone()),
        "Deployments" => {
            watch_namespaced_or_all::<Deployment>(app, client, namespace, watch_id.clone())
        }
        "Services" => watch_namespaced_or_all::<Service>(app, client, namespace, watch_id.clone()),
        "Nodes" => watch_cluster_scoped::<Node>(app, client, watch_id.clone()),
        "Namespaces" => watch_cluster_scoped::<Namespace>(app, client, watch_id.clone()),
        "ReplicaSets" => {
            watch_namespaced_or_all::<ReplicaSet>(app, client, namespace, watch_id.clone())
        }
        "StatefulSets" => {
            watch_namespaced_or_all::<StatefulSet>(app, client, namespace, watch_id.clone())
        }
        "DaemonSets" => {
            watch_namespaced_or_all::<DaemonSet>(app, client, namespace, watch_id.clone())
        }
        "Jobs" => watch_namespaced_or_all::<Job>(app, client, namespace, watch_id.clone()),
        "CronJobs" => watch_namespaced_or_all::<CronJob>(app, client, namespace, watch_id.clone()),
        "ConfigMaps" => {
            watch_namespaced_or_all::<ConfigMap>(app, client, namespace, watch_id.clone())
        }
        "Secrets" => watch_namespaced_or_all::<Secret>(app, client, namespace, watch_id.clone()),
        "Ingresses" => watch_namespaced_or_all::<Ingress>(app, client, namespace, watch_id.clone()),
        _ => {
            log::warn!("Unsupported resource kind for watch: {}", kind);
            return Ok(watch_id);
        }
    };

    watcher_handle
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .insert(watch_id.clone(), handle);
    Ok(watch_id)
}

#[tauri::command]
pub async fn stop_watch_resources(
    watcher_handle: tauri::State<'_, WatcherHandle>,
    watch_id: String,
) -> Result<()> {
    if let Some(handle) = watcher_handle
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .remove(&watch_id)
    {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_resource(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
    kind: String,
    name: String,
    namespace: Option<String>,
) -> Result<()> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, context, kc_path).await?;
    client
        .delete_resource(&kind, &name, namespace.as_deref())
        .await
}

#[tauri::command]
pub async fn rollout_restart_deployment(
    client_pool: tauri::State<'_, K8sClientPool>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    context: Option<String>,
    name: String,
    namespace: String,
) -> Result<()> {
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| K8sError::Lock(e.to_string()))?
        .clone();
    let client = get_or_create_client(&client_pool, context, kc_path).await?;
    client.rollout_restart_deployment(&name, &namespace).await
}
