use async_trait::async_trait;
use k8s_openapi::api::apps::v1::{
    DaemonSet, Deployment, DeploymentSpec, DeploymentStatus, ReplicaSet, ReplicaSetSpec,
    ReplicaSetStatus, StatefulSet, StatefulSetSpec, StatefulSetStatus,
};
use k8s_openapi::api::autoscaling::v2::{
    HorizontalPodAutoscaler, HorizontalPodAutoscalerSpec, HorizontalPodAutoscalerStatus,
};
use k8s_openapi::api::batch::v1::{CronJob, CronJobSpec, CronJobStatus, Job, JobSpec, JobStatus};
use k8s_openapi::api::core::v1::{
    ConfigMap, Container, ContainerStatus, EndpointAddress, EndpointPort, EndpointSubset,
    Endpoints, Event, EventSource, LimitRange, LimitRangeItem, LimitRangeSpec, Namespace,
    NamespaceSpec, NamespaceStatus, Node, NodeAddress, NodeCondition, NodeSpec, NodeStatus,
    NodeSystemInfo, PersistentVolume, PersistentVolumeClaim, PersistentVolumeClaimSpec,
    PersistentVolumeClaimStatus, PersistentVolumeSpec, PersistentVolumeStatus, Pod, PodSpec,
    PodStatus, ResourceQuota, ResourceQuotaSpec, ResourceQuotaStatus, Secret, Service,
    ServiceAccount, ServiceSpec, ServiceStatus, VolumeResourceRequirements,
};
use k8s_openapi::api::networking::v1::{Ingress, NetworkPolicy};
use k8s_openapi::api::rbac::v1::{ClusterRole, ClusterRoleBinding, Role, RoleBinding};
use k8s_openapi::api::storage::v1::StorageClass;
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::{LabelSelector, ObjectMeta, Time};
use std::collections::BTreeMap;

use crate::k8s_api::{K8sClient, K8sError, Result};

pub struct MockK8sClient;

impl MockK8sClient {
    pub fn new() -> Self {
        Self
    }

    fn create_metadata(
        name: String,
        namespace: Option<String>,
        uid: String,
        creation_timestamp: Option<Time>,
        labels: Option<BTreeMap<String, String>>,
    ) -> ObjectMeta {
        ObjectMeta {
            name: Some(name),
            namespace,
            uid: Some(uid),
            creation_timestamp,
            labels,
            ..Default::default()
        }
    }

    fn create_pod(
        name: String,
        namespace: String,
        uid: String,
        creation_timestamp: Time,
        labels: BTreeMap<String, String>,
        container_name: String,
        image: String,
        pod_ip: String,
        phase: String,
        restart_count: i32,
    ) -> Pod {
        Pod {
            metadata: Self::create_metadata(
                name,
                Some(namespace),
                uid,
                Some(creation_timestamp),
                Some(labels),
            ),
            spec: Some(PodSpec {
                containers: vec![Container {
                    name: container_name.clone(),
                    image: Some(image.clone()),
                    ..Default::default()
                }],
                ..Default::default()
            }),
            status: Some(PodStatus {
                phase: Some(phase),
                pod_ip: Some(pod_ip),
                container_statuses: Some(vec![ContainerStatus {
                    name: container_name,
                    ready: true,
                    restart_count,
                    image: image,
                    image_id: "docker://sha256:abc123".to_string(),
                    ..Default::default()
                }]),
                ..Default::default()
            }),
        }
    }
}

#[async_trait]
impl K8sClient for MockK8sClient {
    async fn list_pods(&self, _namespace: Option<&str>) -> Result<Vec<Pod>> {
        let creation_time1 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time2 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T09:30:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        let mut labels1 = BTreeMap::new();
        labels1.insert("app".to_string(), "web".to_string());
        labels1.insert("version".to_string(), "1.0".to_string());

        let mut labels2 = BTreeMap::new();
        labels2.insert("app".to_string(), "api".to_string());
        labels2.insert("version".to_string(), "2.0".to_string());

        Ok(vec![
            Self::create_pod(
                "web-app-1".to_string(),
                "default".to_string(),
                "pod-1".to_string(),
                creation_time1,
                labels1,
                "web".to_string(),
                "nginx:1.21".to_string(),
                "10.244.1.5".to_string(),
                "Running".to_string(),
                0,
            ),
            Self::create_pod(
                "api-server-1".to_string(),
                "default".to_string(),
                "pod-2".to_string(),
                creation_time2,
                labels2,
                "api".to_string(),
                "myapp/api:2.0".to_string(),
                "10.244.1.6".to_string(),
                "Running".to_string(),
                2,
            ),
        ])
    }

    async fn get_pod(&self, name: &str, namespace: &str) -> Result<Pod> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        Ok(Self::create_pod(
            name.to_string(),
            namespace.to_string(),
            format!("pod-{}-uid", name),
            creation_time,
            labels,
            "main".to_string(),
            "nginx:1.21".to_string(),
            "10.244.1.5".to_string(),
            "Running".to_string(),
            0,
        ))
    }

    async fn list_deployments(&self, _namespace: Option<&str>) -> Result<Vec<Deployment>> {
        let creation_time1 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time2 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T07:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        let mut labels1 = BTreeMap::new();
        labels1.insert("app".to_string(), "web".to_string());

        let mut labels2 = BTreeMap::new();
        labels2.insert("app".to_string(), "api".to_string());

        let mut selector_labels1 = BTreeMap::new();
        selector_labels1.insert("app".to_string(), "web".to_string());

        let mut selector_labels2 = BTreeMap::new();
        selector_labels2.insert("app".to_string(), "api".to_string());

        Ok(vec![
            Deployment {
                metadata: Self::create_metadata(
                    "web-deployment".to_string(),
                    Some("default".to_string()),
                    "deploy-1".to_string(),
                    Some(creation_time1),
                    Some(labels1),
                ),
                spec: Some(DeploymentSpec {
                    replicas: Some(3),
                    selector: LabelSelector {
                        match_labels: Some(selector_labels1),
                        ..Default::default()
                    },
                    ..Default::default()
                }),
                status: Some(DeploymentStatus {
                    replicas: Some(3),
                    ready_replicas: Some(3),
                    available_replicas: Some(3),
                    ..Default::default()
                }),
            },
            Deployment {
                metadata: Self::create_metadata(
                    "api-deployment".to_string(),
                    Some("default".to_string()),
                    "deploy-2".to_string(),
                    Some(creation_time2),
                    Some(labels2),
                ),
                spec: Some(DeploymentSpec {
                    replicas: Some(2),
                    selector: LabelSelector {
                        match_labels: Some(selector_labels2),
                        ..Default::default()
                    },
                    ..Default::default()
                }),
                status: Some(DeploymentStatus {
                    replicas: Some(2),
                    ready_replicas: Some(2),
                    available_replicas: Some(2),
                    ..Default::default()
                }),
            },
        ])
    }

    async fn get_deployment(&self, name: &str, namespace: &str) -> Result<Deployment> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "web".to_string());

        Ok(Deployment {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("deploy-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(DeploymentSpec {
                replicas: Some(3),
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(DeploymentStatus {
                replicas: Some(3),
                ready_replicas: Some(3),
                available_replicas: Some(3),
                ..Default::default()
            }),
        })
    }

    async fn list_services(&self, _namespace: Option<&str>) -> Result<Vec<Service>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        let mut selector = BTreeMap::new();
        selector.insert("app".to_string(), "web".to_string());

        Ok(vec![Service {
            metadata: Self::create_metadata(
                "web-service".to_string(),
                Some("default".to_string()),
                "svc-1".to_string(),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(ServiceSpec {
                type_: Some("ClusterIP".to_string()),
                ports: Some(vec![k8s_openapi::api::core::v1::ServicePort {
                    port: 80,
                    target_port: Some(
                        k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(8080),
                    ),
                    ..Default::default()
                }]),
                selector: Some(selector),
                ..Default::default()
            }),
            status: Some(ServiceStatus {
                load_balancer: Some(Default::default()),
                ..Default::default()
            }),
        }])
    }

    async fn get_service(&self, name: &str, namespace: &str) -> Result<Service> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        Ok(Service {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("svc-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(ServiceSpec {
                type_: Some("ClusterIP".to_string()),
                ports: Some(vec![k8s_openapi::api::core::v1::ServicePort {
                    port: 80,
                    target_port: Some(
                        k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(8080),
                    ),
                    ..Default::default()
                }]),
                ..Default::default()
            }),
            status: Some(ServiceStatus {
                load_balancer: Some(Default::default()),
                ..Default::default()
            }),
        })
    }

    async fn list_nodes(&self) -> Result<Vec<Node>> {
        let creation_time1 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time2 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        let mut labels1 = BTreeMap::new();
        labels1.insert("kubernetes.io/os".to_string(), "linux".to_string());
        labels1.insert("node-role.kubernetes.io/worker".to_string(), "".to_string());

        let mut labels2 = BTreeMap::new();
        labels2.insert("kubernetes.io/os".to_string(), "linux".to_string());
        labels2.insert("node-role.kubernetes.io/worker".to_string(), "".to_string());

        let mut capacity1 = BTreeMap::new();
        capacity1.insert("cpu".to_string(), Quantity("4".to_string()));
        capacity1.insert("memory".to_string(), Quantity("8Gi".to_string()));

        let mut capacity2 = BTreeMap::new();
        capacity2.insert("cpu".to_string(), Quantity("8".to_string()));
        capacity2.insert("memory".to_string(), Quantity("16Gi".to_string()));

        Ok(vec![
            Node {
                metadata: Self::create_metadata(
                    "node-1".to_string(),
                    None,
                    "node-1-uid".to_string(),
                    Some(creation_time1),
                    Some(labels1),
                ),
                spec: Some(NodeSpec::default()),
                status: Some(NodeStatus {
                    conditions: Some(vec![NodeCondition {
                        type_: "Ready".to_string(),
                        status: "True".to_string(),
                        ..Default::default()
                    }]),
                    node_info: Some(NodeSystemInfo {
                        kubelet_version: "v1.28.0".to_string(),
                        os_image: "Ubuntu 22.04".to_string(),
                        container_runtime_version: "containerd://1.7.0".to_string(),
                        ..Default::default()
                    }),
                    capacity: Some(capacity1),
                    addresses: Some(vec![
                        NodeAddress {
                            type_: "InternalIP".to_string(),
                            address: "192.168.1.10".to_string(),
                        },
                        NodeAddress {
                            type_: "ExternalIP".to_string(),
                            address: "203.0.113.10".to_string(),
                        },
                    ]),
                    ..Default::default()
                }),
            },
            Node {
                metadata: Self::create_metadata(
                    "node-2".to_string(),
                    None,
                    "node-2-uid".to_string(),
                    Some(creation_time2),
                    Some(labels2),
                ),
                spec: Some(NodeSpec::default()),
                status: Some(NodeStatus {
                    conditions: Some(vec![NodeCondition {
                        type_: "Ready".to_string(),
                        status: "True".to_string(),
                        ..Default::default()
                    }]),
                    node_info: Some(NodeSystemInfo {
                        kubelet_version: "v1.28.0".to_string(),
                        os_image: "Ubuntu 22.04".to_string(),
                        container_runtime_version: "containerd://1.7.0".to_string(),
                        ..Default::default()
                    }),
                    capacity: Some(capacity2),
                    addresses: Some(vec![NodeAddress {
                        type_: "InternalIP".to_string(),
                        address: "192.168.1.11".to_string(),
                    }]),
                    ..Default::default()
                }),
            },
        ])
    }

    async fn get_node(&self, name: &str) -> Result<Node> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("kubernetes.io/os".to_string(), "linux".to_string());

        let mut capacity = BTreeMap::new();
        capacity.insert("cpu".to_string(), Quantity("4".to_string()));
        capacity.insert("memory".to_string(), Quantity("8Gi".to_string()));

        Ok(Node {
            metadata: Self::create_metadata(
                name.to_string(),
                None,
                format!("node-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(NodeSpec::default()),
            status: Some(NodeStatus {
                conditions: Some(vec![NodeCondition {
                    type_: "Ready".to_string(),
                    status: "True".to_string(),
                    ..Default::default()
                }]),
                node_info: Some(NodeSystemInfo {
                    kubelet_version: "v1.28.0".to_string(),
                    os_image: "Ubuntu 22.04".to_string(),
                    container_runtime_version: "containerd://1.7.0".to_string(),
                    ..Default::default()
                }),
                capacity: Some(capacity),
                addresses: Some(vec![NodeAddress {
                    type_: "InternalIP".to_string(),
                    address: "192.168.1.10".to_string(),
                }]),
                ..Default::default()
            }),
        })
    }

    async fn list_namespaces(&self) -> Result<Vec<Namespace>> {
        let creation_time1 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time1_clone = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time2 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-10T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![
            Namespace {
                metadata: Self::create_metadata(
                    "default".to_string(),
                    None,
                    "ns-default-uid".to_string(),
                    Some(creation_time1),
                    None,
                ),
                spec: Some(NamespaceSpec::default()),
                status: Some(NamespaceStatus {
                    phase: Some("Active".to_string()),
                    conditions: None,
                }),
            },
            Namespace {
                metadata: Self::create_metadata(
                    "kube-system".to_string(),
                    None,
                    "ns-kube-system-uid".to_string(),
                    Some(creation_time1_clone),
                    None,
                ),
                spec: Some(NamespaceSpec::default()),
                status: Some(NamespaceStatus {
                    phase: Some("Active".to_string()),
                    conditions: None,
                }),
            },
            Namespace {
                metadata: Self::create_metadata(
                    "production".to_string(),
                    None,
                    "ns-production-uid".to_string(),
                    Some(creation_time2),
                    None,
                ),
                spec: Some(NamespaceSpec::default()),
                status: Some(NamespaceStatus {
                    phase: Some("Active".to_string()),
                    conditions: None,
                }),
            },
        ])
    }

    async fn get_namespace(&self, name: &str) -> Result<Namespace> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(Namespace {
            metadata: Self::create_metadata(
                name.to_string(),
                None,
                format!("ns-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(NamespaceSpec::default()),
            status: Some(NamespaceStatus {
                phase: Some("Active".to_string()),
                conditions: None,
            }),
        })
    }

    async fn list_replicasets(&self, _namespace: Option<&str>) -> Result<Vec<ReplicaSet>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "web".to_string());

        Ok(vec![ReplicaSet {
            metadata: Self::create_metadata(
                "web-rs".to_string(),
                Some("default".to_string()),
                "rs-1".to_string(),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(ReplicaSetSpec {
                replicas: Some(3),
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(ReplicaSetStatus {
                replicas: 3,
                ready_replicas: Some(3),
                ..Default::default()
            }),
        }])
    }

    async fn get_replicaset(&self, name: &str, namespace: &str) -> Result<ReplicaSet> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "web".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "web".to_string());

        Ok(ReplicaSet {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("rs-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(ReplicaSetSpec {
                replicas: Some(3),
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(ReplicaSetStatus {
                replicas: 3,
                ready_replicas: Some(3),
                ..Default::default()
            }),
        })
    }

    async fn list_statefulsets(&self, _namespace: Option<&str>) -> Result<Vec<StatefulSet>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "db".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "db".to_string());

        Ok(vec![StatefulSet {
            metadata: Self::create_metadata(
                "db-statefulset".to_string(),
                Some("default".to_string()),
                "sts-1".to_string(),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(StatefulSetSpec {
                replicas: Some(3),
                service_name: "db-service".to_string(),
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(StatefulSetStatus {
                replicas: 3,
                ready_replicas: Some(3),
                ..Default::default()
            }),
        }])
    }

    async fn get_statefulset(&self, name: &str, namespace: &str) -> Result<StatefulSet> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "db".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "db".to_string());

        Ok(StatefulSet {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("sts-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(StatefulSetSpec {
                replicas: Some(3),
                service_name: "db-service".to_string(),
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(StatefulSetStatus {
                replicas: 3,
                ready_replicas: Some(3),
                ..Default::default()
            }),
        })
    }

    async fn list_daemonsets(&self, _namespace: Option<&str>) -> Result<Vec<DaemonSet>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "logging".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "logging".to_string());

        Ok(vec![DaemonSet {
            metadata: Self::create_metadata(
                "logging-daemonset".to_string(),
                Some("kube-system".to_string()),
                "ds-1".to_string(),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(k8s_openapi::api::apps::v1::DaemonSetSpec {
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(k8s_openapi::api::apps::v1::DaemonSetStatus {
                current_number_scheduled: 2,
                number_ready: 2,
                desired_number_scheduled: 2,
                ..Default::default()
            }),
        }])
    }

    async fn get_daemonset(&self, name: &str, namespace: &str) -> Result<DaemonSet> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut labels = BTreeMap::new();
        labels.insert("app".to_string(), "logging".to_string());

        let mut selector_labels = BTreeMap::new();
        selector_labels.insert("app".to_string(), "logging".to_string());

        Ok(DaemonSet {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("ds-{}-uid", name),
                Some(creation_time),
                Some(labels),
            ),
            spec: Some(k8s_openapi::api::apps::v1::DaemonSetSpec {
                selector: LabelSelector {
                    match_labels: Some(selector_labels),
                    ..Default::default()
                },
                ..Default::default()
            }),
            status: Some(k8s_openapi::api::apps::v1::DaemonSetStatus {
                current_number_scheduled: 2,
                number_ready: 2,
                desired_number_scheduled: 2,
                ..Default::default()
            }),
        })
    }

    async fn list_jobs(&self, _namespace: Option<&str>) -> Result<Vec<Job>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T09:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![Job {
            metadata: Self::create_metadata(
                "backup-job".to_string(),
                Some("default".to_string()),
                "job-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(JobSpec {
                completions: Some(1),
                parallelism: Some(1),
                ..Default::default()
            }),
            status: Some(JobStatus {
                succeeded: Some(1),
                active: Some(0),
                ..Default::default()
            }),
        }])
    }

    async fn get_job(&self, name: &str, namespace: &str) -> Result<Job> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T09:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(Job {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("job-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(JobSpec {
                completions: Some(1),
                parallelism: Some(1),
                ..Default::default()
            }),
            status: Some(JobStatus {
                succeeded: Some(1),
                active: Some(0),
                ..Default::default()
            }),
        })
    }

    async fn list_cronjobs(&self, _namespace: Option<&str>) -> Result<Vec<CronJob>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let last_schedule_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T02:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![CronJob {
            metadata: Self::create_metadata(
                "daily-backup".to_string(),
                Some("default".to_string()),
                "cronjob-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(CronJobSpec {
                schedule: "0 2 * * *".to_string(),
                ..Default::default()
            }),
            status: Some(CronJobStatus {
                last_schedule_time: Some(last_schedule_time),
                ..Default::default()
            }),
        }])
    }

    async fn get_cronjob(&self, name: &str, namespace: &str) -> Result<CronJob> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let last_schedule_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T02:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(CronJob {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("cronjob-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(CronJobSpec {
                schedule: "0 2 * * *".to_string(),
                ..Default::default()
            }),
            status: Some(CronJobStatus {
                last_schedule_time: Some(last_schedule_time),
                ..Default::default()
            }),
        })
    }

    async fn list_configmaps(&self, _namespace: Option<&str>) -> Result<Vec<ConfigMap>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut data = BTreeMap::new();
        data.insert("config.yaml".to_string(), "key: value".to_string());

        Ok(vec![ConfigMap {
            metadata: Self::create_metadata(
                "app-config".to_string(),
                Some("default".to_string()),
                "cm-1".to_string(),
                Some(creation_time),
                None,
            ),
            data: Some(data),
            ..Default::default()
        }])
    }

    async fn get_configmap(&self, name: &str, namespace: &str) -> Result<ConfigMap> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut data = BTreeMap::new();
        data.insert("config.yaml".to_string(), "key: value".to_string());

        Ok(ConfigMap {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("cm-{}-uid", name),
                Some(creation_time),
                None,
            ),
            data: Some(data),
            ..Default::default()
        })
    }

    async fn list_secrets(&self, _namespace: Option<&str>) -> Result<Vec<Secret>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![Secret {
            metadata: Self::create_metadata(
                "app-secret".to_string(),
                Some("default".to_string()),
                "secret-1".to_string(),
                Some(creation_time),
                None,
            ),
            type_: Some("Opaque".to_string()),
            data: Some(BTreeMap::new()),
            ..Default::default()
        }])
    }

    async fn get_secret(&self, name: &str, namespace: &str) -> Result<Secret> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(Secret {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("secret-{}-uid", name),
                Some(creation_time),
                None,
            ),
            type_: Some("Opaque".to_string()),
            data: Some(BTreeMap::new()),
            ..Default::default()
        })
    }

    async fn list_ingresses(&self, _namespace: Option<&str>) -> Result<Vec<Ingress>> {
        Ok(vec![])
    }

    async fn get_ingress(&self, _name: &str, _namespace: &str) -> Result<Ingress> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "Ingress not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_networkpolicies(&self, _namespace: Option<&str>) -> Result<Vec<NetworkPolicy>> {
        Ok(vec![])
    }

    async fn get_networkpolicy(&self, _name: &str, _namespace: &str) -> Result<NetworkPolicy> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "NetworkPolicy not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_persistentvolumes(&self) -> Result<Vec<PersistentVolume>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut capacity = BTreeMap::new();
        capacity.insert("storage".to_string(), Quantity("10Gi".to_string()));

        Ok(vec![PersistentVolume {
            metadata: Self::create_metadata(
                "pv-1".to_string(),
                None,
                "pv-1-uid".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(PersistentVolumeSpec {
                capacity: Some(capacity),
                access_modes: Some(vec!["ReadWriteOnce".to_string()]),
                persistent_volume_reclaim_policy: Some("Retain".to_string()),
                ..Default::default()
            }),
            status: Some(PersistentVolumeStatus {
                phase: Some("Available".to_string()),
                ..Default::default()
            }),
        }])
    }

    async fn get_persistentvolume(&self, name: &str) -> Result<PersistentVolume> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut capacity = BTreeMap::new();
        capacity.insert("storage".to_string(), Quantity("10Gi".to_string()));

        Ok(PersistentVolume {
            metadata: Self::create_metadata(
                name.to_string(),
                None,
                format!("pv-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(PersistentVolumeSpec {
                capacity: Some(capacity),
                access_modes: Some(vec!["ReadWriteOnce".to_string()]),
                persistent_volume_reclaim_policy: Some("Retain".to_string()),
                ..Default::default()
            }),
            status: Some(PersistentVolumeStatus {
                phase: Some("Available".to_string()),
                ..Default::default()
            }),
        })
    }

    async fn list_persistentvolumeclaims(
        &self,
        _namespace: Option<&str>,
    ) -> Result<Vec<PersistentVolumeClaim>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut requests = BTreeMap::new();
        requests.insert("storage".to_string(), Quantity("10Gi".to_string()));

        Ok(vec![PersistentVolumeClaim {
            metadata: Self::create_metadata(
                "db-pvc".to_string(),
                Some("default".to_string()),
                "pvc-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(PersistentVolumeClaimSpec {
                access_modes: Some(vec!["ReadWriteOnce".to_string()]),
                resources: Some(VolumeResourceRequirements {
                    requests: Some(requests),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            status: Some(PersistentVolumeClaimStatus {
                phase: Some("Bound".to_string()),
                ..Default::default()
            }),
        }])
    }

    async fn get_persistentvolumeclaim(
        &self,
        name: &str,
        namespace: &str,
    ) -> Result<PersistentVolumeClaim> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut requests = BTreeMap::new();
        requests.insert("storage".to_string(), Quantity("10Gi".to_string()));

        Ok(PersistentVolumeClaim {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("pvc-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(PersistentVolumeClaimSpec {
                access_modes: Some(vec!["ReadWriteOnce".to_string()]),
                resources: Some(VolumeResourceRequirements {
                    requests: Some(requests),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            status: Some(PersistentVolumeClaimStatus {
                phase: Some("Bound".to_string()),
                ..Default::default()
            }),
        })
    }

    async fn list_storageclasses(&self) -> Result<Vec<StorageClass>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut parameters = BTreeMap::new();
        parameters.insert("type".to_string(), "gp3".to_string());

        Ok(vec![StorageClass {
            metadata: Self::create_metadata(
                "fast-ssd".to_string(),
                None,
                "sc-1".to_string(),
                Some(creation_time),
                None,
            ),
            provisioner: "kubernetes.io/aws-ebs".to_string(),
            parameters: Some(parameters),
            ..Default::default()
        }])
    }

    async fn get_storageclass(&self, name: &str) -> Result<StorageClass> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut parameters = BTreeMap::new();
        parameters.insert("type".to_string(), "gp3".to_string());

        Ok(StorageClass {
            metadata: Self::create_metadata(
                name.to_string(),
                None,
                format!("sc-{}-uid", name),
                Some(creation_time),
                None,
            ),
            provisioner: "kubernetes.io/aws-ebs".to_string(),
            parameters: Some(parameters),
            ..Default::default()
        })
    }

    async fn list_roles(&self, _namespace: Option<&str>) -> Result<Vec<Role>> {
        Ok(vec![])
    }

    async fn get_role(&self, _name: &str, _namespace: &str) -> Result<Role> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "Role not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_clusterroles(&self) -> Result<Vec<ClusterRole>> {
        Ok(vec![])
    }

    async fn get_clusterrole(&self, _name: &str) -> Result<ClusterRole> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "ClusterRole not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_rolebindings(&self, _namespace: Option<&str>) -> Result<Vec<RoleBinding>> {
        Ok(vec![])
    }

    async fn get_rolebinding(&self, _name: &str, _namespace: &str) -> Result<RoleBinding> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "RoleBinding not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_clusterrolebindings(&self) -> Result<Vec<ClusterRoleBinding>> {
        Ok(vec![])
    }

    async fn get_clusterrolebinding(&self, _name: &str) -> Result<ClusterRoleBinding> {
        Err(K8sError::Kube(kube::Error::Api(
            kube::error::ErrorResponse {
                status: "Failure".to_string(),
                message: "ClusterRoleBinding not found".to_string(),
                reason: "NotFound".to_string(),
                code: 404,
            },
        )))
    }

    async fn list_serviceaccounts(&self, _namespace: Option<&str>) -> Result<Vec<ServiceAccount>> {
        let creation_time1 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let creation_time2 = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T08:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![
            ServiceAccount {
                metadata: Self::create_metadata(
                    "default".to_string(),
                    Some("default".to_string()),
                    "sa-1".to_string(),
                    Some(creation_time1),
                    None,
                ),
                automount_service_account_token: None,
                image_pull_secrets: None,
                secrets: None,
            },
            ServiceAccount {
                metadata: Self::create_metadata(
                    "app-sa".to_string(),
                    Some("default".to_string()),
                    "sa-2".to_string(),
                    Some(creation_time2),
                    None,
                ),
                automount_service_account_token: None,
                image_pull_secrets: None,
                secrets: None,
            },
        ])
    }

    async fn get_serviceaccount(&self, name: &str, namespace: &str) -> Result<ServiceAccount> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(ServiceAccount {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("sa-{}-uid", name),
                Some(creation_time),
                None,
            ),
            automount_service_account_token: None,
            image_pull_secrets: None,
            secrets: None,
        })
    }

    async fn list_endpoints(&self, _namespace: Option<&str>) -> Result<Vec<Endpoints>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![Endpoints {
            metadata: Self::create_metadata(
                "web-service".to_string(),
                Some("default".to_string()),
                "ep-1".to_string(),
                Some(creation_time),
                None,
            ),
            subsets: Some(vec![EndpointSubset {
                addresses: Some(vec![
                    EndpointAddress {
                        ip: "10.244.1.5".to_string(),
                        hostname: None,
                        node_name: None,
                        target_ref: None,
                    },
                    EndpointAddress {
                        ip: "10.244.1.6".to_string(),
                        hostname: None,
                        node_name: None,
                        target_ref: None,
                    },
                ]),
                ports: Some(vec![EndpointPort {
                    name: Some("http".to_string()),
                    port: 80,
                    protocol: Some("TCP".to_string()),
                    app_protocol: None,
                }]),
                ..Default::default()
            }]),
        }])
    }

    async fn get_endpoints(&self, name: &str, namespace: &str) -> Result<Endpoints> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(Endpoints {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("ep-{}-uid", name),
                Some(creation_time),
                None,
            ),
            subsets: Some(vec![EndpointSubset {
                addresses: Some(vec![EndpointAddress {
                    ip: "10.244.1.5".to_string(),
                    hostname: None,
                    node_name: None,
                    target_ref: None,
                }]),
                ports: Some(vec![EndpointPort {
                    name: Some("http".to_string()),
                    port: 80,
                    protocol: Some("TCP".to_string()),
                    app_protocol: None,
                }]),
                ..Default::default()
            }]),
        })
    }

    async fn list_events(&self, _namespace: Option<&str>) -> Result<Vec<Event>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let first_timestamp = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let last_timestamp = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:05:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![Event {
            metadata: Self::create_metadata(
                "web-app-1.1234567890".to_string(),
                Some("default".to_string()),
                "evt-1".to_string(),
                Some(creation_time),
                None,
            ),
            action: Some("Started".to_string()),
            count: Some(1),
            event_time: None,
            first_timestamp: Some(first_timestamp),
            involved_object: Default::default(),
            last_timestamp: Some(last_timestamp),
            message: Some("Container started".to_string()),
            reason: Some("Started".to_string()),
            related: None,
            reporting_component: Some("kubelet".to_string()),
            reporting_instance: Some("node-1".to_string()),
            series: None,
            source: Some(EventSource {
                component: Some("kubelet".to_string()),
                host: Some("node-1".to_string()),
            }),
            type_: Some("Normal".to_string()),
        }])
    }

    async fn get_event(&self, name: &str, namespace: &str) -> Result<Event> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let first_timestamp = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let last_timestamp = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:05:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(Event {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("evt-{}-uid", name),
                Some(creation_time),
                None,
            ),
            action: Some("Started".to_string()),
            count: Some(1),
            event_time: None,
            first_timestamp: Some(first_timestamp),
            involved_object: Default::default(),
            last_timestamp: Some(last_timestamp),
            message: Some("Container started".to_string()),
            reason: Some("Started".to_string()),
            related: None,
            reporting_component: Some("kubelet".to_string()),
            reporting_instance: Some("node-1".to_string()),
            series: None,
            source: Some(EventSource {
                component: Some("kubelet".to_string()),
                host: Some("node-1".to_string()),
            }),
            type_: Some("Normal".to_string()),
        })
    }

    async fn list_horizontalpodautoscalers(
        &self,
        _namespace: Option<&str>,
    ) -> Result<Vec<HorizontalPodAutoscaler>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(vec![HorizontalPodAutoscaler {
            metadata: Self::create_metadata(
                "web-hpa".to_string(),
                Some("default".to_string()),
                "hpa-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(HorizontalPodAutoscalerSpec {
                scale_target_ref: Default::default(),
                min_replicas: Some(2),
                max_replicas: 10,
                metrics: None,
                behavior: None,
            }),
            status: Some(HorizontalPodAutoscalerStatus {
                observed_generation: None,
                last_scale_time: None,
                current_replicas: Some(3),
                desired_replicas: 3,
                current_metrics: None,
                conditions: None,
            }),
        }])
    }

    async fn get_horizontalpodautoscaler(
        &self,
        name: &str,
        namespace: &str,
    ) -> Result<HorizontalPodAutoscaler> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );

        Ok(HorizontalPodAutoscaler {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("hpa-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(HorizontalPodAutoscalerSpec {
                scale_target_ref: Default::default(),
                min_replicas: Some(2),
                max_replicas: 10,
                metrics: None,
                behavior: None,
            }),
            status: Some(HorizontalPodAutoscalerStatus {
                observed_generation: None,
                last_scale_time: None,
                current_replicas: Some(3),
                desired_replicas: 3,
                current_metrics: None,
                conditions: None,
            }),
        })
    }

    async fn list_limitranges(&self, _namespace: Option<&str>) -> Result<Vec<LimitRange>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut default_requests = BTreeMap::new();
        default_requests.insert("cpu".to_string(), Quantity("100m".to_string()));
        default_requests.insert("memory".to_string(), Quantity("128Mi".to_string()));

        Ok(vec![LimitRange {
            metadata: Self::create_metadata(
                "default-limits".to_string(),
                Some("default".to_string()),
                "lr-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(LimitRangeSpec {
                limits: vec![LimitRangeItem {
                    type_: "Container".to_string(),
                    max: None,
                    min: None,
                    default: Some(default_requests.clone()),
                    default_request: None,
                    max_limit_request_ratio: None,
                }],
            }),
        }])
    }

    async fn get_limitrange(&self, name: &str, namespace: &str) -> Result<LimitRange> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut default_requests = BTreeMap::new();
        default_requests.insert("cpu".to_string(), Quantity("100m".to_string()));
        default_requests.insert("memory".to_string(), Quantity("128Mi".to_string()));

        Ok(LimitRange {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("lr-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(LimitRangeSpec {
                limits: vec![LimitRangeItem {
                    type_: "Container".to_string(),
                    max: None,
                    min: None,
                    default: Some(default_requests),
                    default_request: None,
                    max_limit_request_ratio: None,
                }],
            }),
        })
    }

    async fn list_resourcequotas(&self, _namespace: Option<&str>) -> Result<Vec<ResourceQuota>> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut hard = BTreeMap::new();
        hard.insert("pods".to_string(), Quantity("10".to_string()));
        hard.insert("requests.cpu".to_string(), Quantity("4".to_string()));
        hard.insert("requests.memory".to_string(), Quantity("8Gi".to_string()));

        Ok(vec![ResourceQuota {
            metadata: Self::create_metadata(
                "default-quota".to_string(),
                Some("default".to_string()),
                "rq-1".to_string(),
                Some(creation_time),
                None,
            ),
            spec: Some(ResourceQuotaSpec {
                hard: Some(hard.clone()),
                scope_selector: None,
                scopes: None,
            }),
            status: Some(ResourceQuotaStatus {
                hard: Some(hard.clone()),
                used: Some(hard),
            }),
        }])
    }

    async fn get_resourcequota(&self, name: &str, namespace: &str) -> Result<ResourceQuota> {
        let creation_time = Time(
            chrono::DateTime::parse_from_rfc3339("2024-01-15T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc),
        );
        let mut hard = BTreeMap::new();
        hard.insert("pods".to_string(), Quantity("10".to_string()));
        hard.insert("requests.cpu".to_string(), Quantity("4".to_string()));
        hard.insert("requests.memory".to_string(), Quantity("8Gi".to_string()));

        Ok(ResourceQuota {
            metadata: Self::create_metadata(
                name.to_string(),
                Some(namespace.to_string()),
                format!("rq-{}-uid", name),
                Some(creation_time),
                None,
            ),
            spec: Some(ResourceQuotaSpec {
                hard: Some(hard.clone()),
                scope_selector: None,
                scopes: None,
            }),
            status: Some(ResourceQuotaStatus {
                hard: Some(hard.clone()),
                used: Some(hard),
            }),
        })
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
