use async_trait::async_trait;
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, PersistentVolumeClaim, Pod, Secret, Service,
    ServiceAccount,
};
use k8s_openapi::api::networking::v1::{Ingress, NetworkPolicy};
use k8s_openapi::api::rbac::v1::{ClusterRole, ClusterRoleBinding, Role, RoleBinding};
use k8s_openapi::api::storage::v1::StorageClass;
use serde_json;

use crate::k8s_api::{K8sClient, K8sError, Result};

pub struct MockK8sClient;

impl MockK8sClient {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl K8sClient for MockK8sClient {
    async fn list_pods(&self, _namespace: Option<&str>) -> Result<Vec<Pod>> {
        let pods_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "Pod",
                "metadata": {
                    "name": "web-app-1",
                    "namespace": "default",
                    "uid": "pod-1",
                    "creationTimestamp": "2024-01-15T10:00:00Z",
                    "labels": {
                        "app": "web",
                        "version": "1.0"
                    }
                },
                "spec": {
                    "containers": [
                        {
                            "name": "web",
                            "image": "nginx:1.21"
                        }
                    ]
                },
                "status": {
                    "phase": "Running",
                    "podIP": "10.244.1.5",
                    "containerStatuses": [
                        {
                            "name": "web",
                            "ready": true,
                            "restartCount": 0,
                            "image": "nginx:1.21",
                            "imageID": "docker://sha256:abc123"
                        }
                    ]
                }
            },
            {
                "apiVersion": "v1",
                "kind": "Pod",
                "metadata": {
                    "name": "api-server-1",
                    "namespace": "default",
                    "uid": "pod-2",
                    "creationTimestamp": "2024-01-15T09:30:00Z",
                    "labels": {
                        "app": "api",
                        "version": "2.0"
                    }
                },
                "spec": {
                    "containers": [
                        {
                            "name": "api",
                            "image": "myapp/api:2.0"
                        }
                    ]
                },
                "status": {
                    "phase": "Running",
                    "podIP": "10.244.1.6",
                    "containerStatuses": [
                        {
                            "name": "api",
                            "ready": true,
                            "restartCount": 2,
                            "image": "myapp/api:2.0",
                            "imageID": "docker://sha256:def456"
                        }
                    ]
                }
            }
        ]"#;
        serde_json::from_str(pods_json).map_err(K8sError::Serialization)
    }

    async fn get_pod(&self, name: &str, namespace: &str) -> Result<Pod> {
        let pod_json = format!(
            r#"{{
                "apiVersion": "v1",
                "kind": "Pod",
                "metadata": {{
                    "name": "{}",
                    "namespace": "{}",
                    "uid": "pod-{}-uid",
                    "creationTimestamp": "2024-01-15T10:00:00Z"
                }},
                "spec": {{
                    "containers": [
                        {{
                            "name": "main",
                            "image": "nginx:1.21"
                        }}
                    ]
                }},
                "status": {{
                    "phase": "Running",
                    "podIP": "10.244.1.5",
                    "containerStatuses": [
                        {{
                            "name": "main",
                            "ready": true,
                            "restartCount": 0,
                            "image": "nginx:1.21",
                            "imageID": "docker://sha256:abc123"
                        }}
                    ]
                }}
            }}"#,
            name, namespace, name
        );
        serde_json::from_str(&pod_json).map_err(K8sError::Serialization)
    }

    async fn list_deployments(&self, _namespace: Option<&str>) -> Result<Vec<Deployment>> {
        let deployments_json = r#"[
            {
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {
                    "name": "web-deployment",
                    "namespace": "default",
                    "uid": "deploy-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "replicas": 3,
                    "selector": {
                        "matchLabels": {
                            "app": "web"
                        }
                    }
                },
                "status": {
                    "replicas": 3,
                    "readyReplicas": 3,
                    "availableReplicas": 3
                }
            },
            {
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {
                    "name": "api-deployment",
                    "namespace": "default",
                    "uid": "deploy-2",
                    "creationTimestamp": "2024-01-15T07:00:00Z"
                },
                "spec": {
                    "replicas": 2,
                    "selector": {
                        "matchLabels": {
                            "app": "api"
                        }
                    }
                },
                "status": {
                    "replicas": 2,
                    "readyReplicas": 2,
                    "availableReplicas": 2
                }
            }
        ]"#;
        serde_json::from_str(deployments_json).map_err(K8sError::Serialization)
    }

    async fn get_deployment(&self, name: &str, namespace: &str) -> Result<Deployment> {
        let deployment_json = format!(
            r#"{{
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {{
                    "name": "{}",
                    "namespace": "{}",
                    "uid": "deploy-{}-uid",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                }},
                "spec": {{
                    "replicas": 3,
                    "selector": {{
                        "matchLabels": {{
                            "app": "web"
                        }}
                    }}
                }},
                "status": {{
                    "replicas": 3,
                    "readyReplicas": 3,
                    "availableReplicas": 3
                }}
            }}"#,
            name, namespace, name
        );
        serde_json::from_str(&deployment_json).map_err(K8sError::Serialization)
    }

    async fn list_services(&self, _namespace: Option<&str>) -> Result<Vec<Service>> {
        let services_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "Service",
                "metadata": {
                    "name": "web-service",
                    "namespace": "default",
                    "uid": "svc-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "type": "ClusterIP",
                    "ports": [
                        {
                            "port": 80,
                            "targetPort": 8080
                        }
                    ],
                    "selector": {
                        "app": "web"
                    }
                },
                "status": {
                    "loadBalancer": {}
                }
            }
        ]"#;
        serde_json::from_str(services_json).map_err(K8sError::Serialization)
    }

    async fn get_service(&self, name: &str, namespace: &str) -> Result<Service> {
        let service_json = format!(
            r#"{{
                "apiVersion": "v1",
                "kind": "Service",
                "metadata": {{
                    "name": "{}",
                    "namespace": "{}",
                    "uid": "svc-{}-uid",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                }},
                "spec": {{
                    "type": "ClusterIP",
                    "ports": [
                        {{
                            "port": 80,
                            "targetPort": 8080
                        }}
                    ]
                }},
                "status": {{
                    "loadBalancer": {{}}
                }}
            }}"#,
            name, namespace, name
        );
        serde_json::from_str(&service_json).map_err(K8sError::Serialization)
    }

    async fn list_nodes(&self) -> Result<Vec<Node>> {
        let nodes_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "Node",
                "metadata": {
                    "name": "node-1",
                    "uid": "node-1-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z",
                    "labels": {
                        "kubernetes.io/os": "linux",
                        "node-role.kubernetes.io/worker": ""
                    }
                },
                "spec": {},
                "status": {
                    "conditions": [
                        {
                            "type": "Ready",
                            "status": "True"
                        }
                    ],
                    "nodeInfo": {
                        "kubeletVersion": "v1.28.0",
                        "osImage": "Ubuntu 22.04",
                        "containerRuntimeVersion": "containerd://1.7.0"
                    },
                    "capacity": {
                        "cpu": "4",
                        "memory": "8Gi"
                    },
                    "addresses": [
                        {
                            "type": "InternalIP",
                            "address": "192.168.1.10"
                        },
                        {
                            "type": "ExternalIP",
                            "address": "203.0.113.10"
                        }
                    ]
                }
            },
            {
                "apiVersion": "v1",
                "kind": "Node",
                "metadata": {
                    "name": "node-2",
                    "uid": "node-2-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z",
                    "labels": {
                        "kubernetes.io/os": "linux",
                        "node-role.kubernetes.io/worker": ""
                    }
                },
                "spec": {},
                "status": {
                    "conditions": [
                        {
                            "type": "Ready",
                            "status": "True"
                        }
                    ],
                    "nodeInfo": {
                        "kubeletVersion": "v1.28.0",
                        "osImage": "Ubuntu 22.04",
                        "containerRuntimeVersion": "containerd://1.7.0"
                    },
                    "capacity": {
                        "cpu": "8",
                        "memory": "16Gi"
                    },
                    "addresses": [
                        {
                            "type": "InternalIP",
                            "address": "192.168.1.11"
                        }
                    ]
                }
            }
        ]"#;
        serde_json::from_str(nodes_json).map_err(K8sError::Serialization)
    }

    async fn get_node(&self, name: &str) -> Result<Node> {
        let node_json = format!(
            r#"{{
                "apiVersion": "v1",
                "kind": "Node",
                "metadata": {{
                    "name": "{}",
                    "uid": "node-{}-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                }},
                "spec": {{}},
                "status": {{
                    "conditions": [
                        {{
                            "type": "Ready",
                            "status": "True"
                        }}
                    ],
                    "nodeInfo": {{
                        "kubeletVersion": "v1.28.0",
                        "osImage": "Ubuntu 22.04",
                        "containerRuntimeVersion": "containerd://1.7.0"
                    }},
                    "capacity": {{
                        "cpu": "4",
                        "memory": "8Gi"
                    }},
                    "addresses": [
                        {{
                            "type": "InternalIP",
                            "address": "192.168.1.10"
                        }}
                    ]
                }}
            }}"#,
            name, name
        );
        serde_json::from_str(&node_json).map_err(K8sError::Serialization)
    }

    async fn list_namespaces(&self) -> Result<Vec<Namespace>> {
        let namespaces_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                    "name": "default",
                    "uid": "ns-default-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "spec": {},
                "status": {
                    "phase": "Active"
                }
            },
            {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                    "name": "kube-system",
                    "uid": "ns-kube-system-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "spec": {},
                "status": {
                    "phase": "Active"
                }
            },
            {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                    "name": "production",
                    "uid": "ns-production-uid",
                    "creationTimestamp": "2024-01-10T00:00:00Z"
                },
                "spec": {},
                "status": {
                    "phase": "Active"
                }
            }
        ]"#;
        serde_json::from_str(namespaces_json).map_err(K8sError::Serialization)
    }

    async fn get_namespace(&self, name: &str) -> Result<Namespace> {
        let namespace_json = format!(
            r#"{{
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {{
                    "name": "{}",
                    "uid": "ns-{}-uid",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                }},
                "spec": {{}},
                "status": {{
                    "phase": "Active"
                }}
            }}"#,
            name, name
        );
        serde_json::from_str(&namespace_json).map_err(K8sError::Serialization)
    }

    async fn list_replicasets(&self, _namespace: Option<&str>) -> Result<Vec<ReplicaSet>> {
        let replicasets_json = r#"[
            {
                "apiVersion": "apps/v1",
                "kind": "ReplicaSet",
                "metadata": {
                    "name": "web-rs",
                    "namespace": "default",
                    "uid": "rs-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "replicas": 3,
                    "selector": {
                        "matchLabels": {
                            "app": "web"
                        }
                    }
                },
                "status": {
                    "replicas": 3,
                    "readyReplicas": 3
                }
            }
        ]"#;
        serde_json::from_str(replicasets_json).map_err(K8sError::Serialization)
    }

    async fn list_statefulsets(&self, _namespace: Option<&str>) -> Result<Vec<StatefulSet>> {
        let statefulsets_json = r#"[
            {
                "apiVersion": "apps/v1",
                "kind": "StatefulSet",
                "metadata": {
                    "name": "db-statefulset",
                    "namespace": "default",
                    "uid": "sts-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "replicas": 3,
                    "serviceName": "db-service",
                    "selector": {
                        "matchLabels": {
                            "app": "db"
                        }
                    }
                },
                "status": {
                    "replicas": 3,
                    "readyReplicas": 3
                }
            }
        ]"#;
        serde_json::from_str(statefulsets_json).map_err(K8sError::Serialization)
    }

    async fn list_daemonsets(&self, _namespace: Option<&str>) -> Result<Vec<DaemonSet>> {
        let daemonsets_json = r#"[
            {
                "apiVersion": "apps/v1",
                "kind": "DaemonSet",
                "metadata": {
                    "name": "logging-daemonset",
                    "namespace": "kube-system",
                    "uid": "ds-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "spec": {
                    "selector": {
                        "matchLabels": {
                            "app": "logging"
                        }
                    }
                },
                "status": {
                    "currentNumberScheduled": 2,
                    "numberReady": 2,
                    "desiredNumberScheduled": 2
                }
            }
        ]"#;
        serde_json::from_str(daemonsets_json).map_err(K8sError::Serialization)
    }

    async fn list_jobs(&self, _namespace: Option<&str>) -> Result<Vec<Job>> {
        let jobs_json = r#"[
            {
                "apiVersion": "batch/v1",
                "kind": "Job",
                "metadata": {
                    "name": "backup-job",
                    "namespace": "default",
                    "uid": "job-1",
                    "creationTimestamp": "2024-01-15T09:00:00Z"
                },
                "spec": {
                    "completions": 1,
                    "parallelism": 1
                },
                "status": {
                    "succeeded": 1,
                    "active": 0
                }
            }
        ]"#;
        serde_json::from_str(jobs_json).map_err(K8sError::Serialization)
    }

    async fn list_cronjobs(&self, _namespace: Option<&str>) -> Result<Vec<CronJob>> {
        let cronjobs_json = r#"[
            {
                "apiVersion": "batch/v1",
                "kind": "CronJob",
                "metadata": {
                    "name": "daily-backup",
                    "namespace": "default",
                    "uid": "cronjob-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "spec": {
                    "schedule": "0 2 * * *",
                    "jobTemplate": {
                        "spec": {
                            "template": {
                                "spec": {
                                    "containers": [
                                        {
                                            "name": "backup",
                                            "image": "backup:latest"
                                        }
                                    ],
                                    "restartPolicy": "OnFailure"
                                }
                            }
                        }
                    }
                },
                "status": {
                    "lastScheduleTime": "2024-01-15T02:00:00Z"
                }
            }
        ]"#;
        serde_json::from_str(cronjobs_json).map_err(K8sError::Serialization)
    }

    async fn list_configmaps(&self, _namespace: Option<&str>) -> Result<Vec<ConfigMap>> {
        let configmaps_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "ConfigMap",
                "metadata": {
                    "name": "app-config",
                    "namespace": "default",
                    "uid": "cm-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "data": {
                    "config.yaml": "key: value"
                }
            }
        ]"#;
        serde_json::from_str(configmaps_json).map_err(K8sError::Serialization)
    }

    async fn list_secrets(&self, _namespace: Option<&str>) -> Result<Vec<Secret>> {
        let secrets_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {
                    "name": "app-secret",
                    "namespace": "default",
                    "uid": "secret-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "type": "Opaque",
                "data": {}
            }
        ]"#;
        serde_json::from_str(secrets_json).map_err(K8sError::Serialization)
    }

    async fn list_ingresses(&self, _namespace: Option<&str>) -> Result<Vec<Ingress>> {
        let ingresses_json = r#"[
            {
                "apiVersion": "networking.k8s.io/v1",
                "kind": "Ingress",
                "metadata": {
                    "name": "web-ingress",
                    "namespace": "default",
                    "uid": "ingress-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "rules": [
                        {
                            "host": "example.com",
                            "http": {
                                "paths": [
                                    {
                                        "path": "/",
                                        "pathType": "Prefix",
                                        "backend": {
                                            "service": {
                                                "name": "web-service",
                                                "port": {
                                                    "number": 80
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                },
                "status": {
                    "loadBalancer": {}
                }
            }
        ]"#;
        serde_json::from_str(ingresses_json).map_err(K8sError::Serialization)
    }

    async fn list_networkpolicies(&self, _namespace: Option<&str>) -> Result<Vec<NetworkPolicy>> {
        let networkpolicies_json = r#"[
            {
                "apiVersion": "networking.k8s.io/v1",
                "kind": "NetworkPolicy",
                "metadata": {
                    "name": "web-policy",
                    "namespace": "default",
                    "uid": "np-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "podSelector": {
                        "matchLabels": {
                            "app": "web"
                        }
                    },
                    "policyTypes": ["Ingress", "Egress"]
                }
            }
        ]"#;
        serde_json::from_str(networkpolicies_json).map_err(K8sError::Serialization)
    }

    async fn list_persistentvolumes(&self) -> Result<Vec<PersistentVolume>> {
        let pvs_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "PersistentVolume",
                "metadata": {
                    "name": "pv-1",
                    "uid": "pv-1-uid",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "capacity": {
                        "storage": "10Gi"
                    },
                    "accessModes": ["ReadWriteOnce"],
                    "persistentVolumeReclaimPolicy": "Retain"
                },
                "status": {
                    "phase": "Available"
                }
            }
        ]"#;
        serde_json::from_str(pvs_json).map_err(K8sError::Serialization)
    }

    async fn list_persistentvolumeclaims(&self, _namespace: Option<&str>) -> Result<Vec<PersistentVolumeClaim>> {
        let pvcs_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "PersistentVolumeClaim",
                "metadata": {
                    "name": "db-pvc",
                    "namespace": "default",
                    "uid": "pvc-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "spec": {
                    "accessModes": ["ReadWriteOnce"],
                    "resources": {
                        "requests": {
                            "storage": "10Gi"
                        }
                    }
                },
                "status": {
                    "phase": "Bound"
                }
            }
        ]"#;
        serde_json::from_str(pvcs_json).map_err(K8sError::Serialization)
    }

    async fn list_storageclasses(&self) -> Result<Vec<StorageClass>> {
        let storageclasses_json = r#"[
            {
                "apiVersion": "storage.k8s.io/v1",
                "kind": "StorageClass",
                "metadata": {
                    "name": "fast-ssd",
                    "uid": "sc-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "provisioner": "kubernetes.io/aws-ebs",
                "parameters": {
                    "type": "gp3"
                }
            }
        ]"#;
        serde_json::from_str(storageclasses_json).map_err(K8sError::Serialization)
    }

    async fn list_roles(&self, _namespace: Option<&str>) -> Result<Vec<Role>> {
        let roles_json = r#"[
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "Role",
                "metadata": {
                    "name": "pod-reader",
                    "namespace": "default",
                    "uid": "role-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "rules": [
                    {
                        "apiGroups": [""],
                        "resources": ["pods"],
                        "verbs": ["get", "list"]
                    }
                ]
            }
        ]"#;
        serde_json::from_str(roles_json).map_err(K8sError::Serialization)
    }

    async fn list_clusterroles(&self) -> Result<Vec<ClusterRole>> {
        let clusterroles_json = r#"[
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "ClusterRole",
                "metadata": {
                    "name": "cluster-admin",
                    "uid": "cr-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "rules": [
                    {
                        "apiGroups": ["*"],
                        "resources": ["*"],
                        "verbs": ["*"]
                    }
                ]
            }
        ]"#;
        serde_json::from_str(clusterroles_json).map_err(K8sError::Serialization)
    }

    async fn list_rolebindings(&self, _namespace: Option<&str>) -> Result<Vec<RoleBinding>> {
        let rolebindings_json = r#"[
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "RoleBinding",
                "metadata": {
                    "name": "pod-reader-binding",
                    "namespace": "default",
                    "uid": "rb-1",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                },
                "roleRef": {
                    "apiGroup": "rbac.authorization.k8s.io",
                    "kind": "Role",
                    "name": "pod-reader"
                },
                "subjects": [
                    {
                        "kind": "User",
                        "name": "alice",
                        "apiGroup": "rbac.authorization.k8s.io"
                    }
                ]
            }
        ]"#;
        serde_json::from_str(rolebindings_json).map_err(K8sError::Serialization)
    }

    async fn list_clusterrolebindings(&self) -> Result<Vec<ClusterRoleBinding>> {
        let clusterrolebindings_json = r#"[
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "ClusterRoleBinding",
                "metadata": {
                    "name": "admin-binding",
                    "uid": "crb-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                },
                "roleRef": {
                    "apiGroup": "rbac.authorization.k8s.io",
                    "kind": "ClusterRole",
                    "name": "cluster-admin"
                },
                "subjects": [
                    {
                        "kind": "User",
                        "name": "admin",
                        "apiGroup": "rbac.authorization.k8s.io"
                    }
                ]
            }
        ]"#;
        serde_json::from_str(clusterrolebindings_json).map_err(K8sError::Serialization)
    }

    async fn list_serviceaccounts(&self, _namespace: Option<&str>) -> Result<Vec<ServiceAccount>> {
        let serviceaccounts_json = r#"[
            {
                "apiVersion": "v1",
                "kind": "ServiceAccount",
                "metadata": {
                    "name": "default",
                    "namespace": "default",
                    "uid": "sa-1",
                    "creationTimestamp": "2024-01-01T00:00:00Z"
                }
            },
            {
                "apiVersion": "v1",
                "kind": "ServiceAccount",
                "metadata": {
                    "name": "app-sa",
                    "namespace": "default",
                    "uid": "sa-2",
                    "creationTimestamp": "2024-01-15T08:00:00Z"
                }
            }
        ]"#;
        serde_json::from_str(serviceaccounts_json).map_err(K8sError::Serialization)
    }

    async fn apiserver_version(&self) -> Result<k8s_openapi::apimachinery::pkg::version::Info> {
        Ok(k8s_openapi::apimachinery::pkg::version::Info {
            major: "1".to_string(),
            minor: "28".to_string(),
            git_version: "v1.28.0".to_string(),
            git_commit: "mock".to_string(),
            git_tree_state: "clean".to_string(),
            build_date: "2024-01-01T00:00:00Z".to_string(),
            go_version: "go1.21.0".to_string(),
            compiler: "gc".to_string(),
            platform: "linux/amd64".to_string(),
        })
    }
}
