mod k8s_api;
mod mock_client;
mod terminal;

use kube::config::Kubeconfig;
use log::LevelFilter;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;

use terminal::TerminalSessions;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Kube error: {0}")]
    Kube(#[from] kube::config::KubeconfigError),
    #[error("Terminal error: {0}")]
    Terminal(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type Result<T> = std::result::Result<T, Error>;

#[tauri::command]
async fn get_kube_contexts() -> Result<Vec<String>> {
    let use_mock = std::env::var("USE_MOCK")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    if use_mock {
        Ok(vec![
            "gke_project-a_asia-northeast1_cluster-1".to_string(),
            "gke_project-a_asia-northeast1_cluster-2".to_string(),
            "gke_project-b_us-central1_cluster-1".to_string(),
            "gke_project-b_us-central1_cluster-2".to_string(),
            "arn:aws:eks:ap-northeast-1:123456789012:cluster/eks-cluster-1".to_string(),
            "arn:aws:eks:ap-northeast-1:123456789012:cluster/eks-cluster-2".to_string(),
            "arn:aws:eks:us-west-2:123456789012:cluster/eks-cluster-3".to_string(),
            "docker-desktop".to_string(),
            "minikube".to_string(),
            "kind-cluster".to_string(),
            "custom-context-1".to_string(),
            "custom-context-2".to_string(),
        ])
    } else {
        let kubeconfig = Kubeconfig::read().map_err(Error::Kube)?;
        let context_names = kubeconfig
            .contexts
            .into_iter()
            .map(|ctx| ctx.name)
            .collect();
        Ok(context_names)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let terminal_sessions: TerminalSessions = Arc::new(Mutex::new(HashMap::new()));
    let watcher_handle: k8s_api::WatcherHandle = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Debug)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(terminal_sessions)
        .manage(watcher_handle)
        .invoke_handler(tauri::generate_handler![
            get_kube_contexts,
            terminal::create_terminal_session,
            terminal::write_to_terminal,
            terminal::close_terminal_session,
            k8s_api::list_resources,
            k8s_api::get_resource_detail,
            k8s_api::get_cluster_overview_info,
            k8s_api::get_cluster_stats,
            k8s_api::start_watch_resources,
            k8s_api::stop_watch_resources
        ])
        .setup(|app| {
            use tauri::{menu::*, Emitter};

            // メニューバーを作成
            let menu = MenuBuilder::new(app)
                .items(&[&SubmenuBuilder::new(app, "swimmer")
                    .items(&[
                        &MenuItemBuilder::with_id("preferences", "Preferences...")
                            .accelerator("CmdOrCtrl+,")
                            .build(app)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, Some("Quit"))?,
                    ])
                    .build()?])
                .build()?;

            app.set_menu(menu)?;

            // メニューイベントハンドラ
            app.on_menu_event(|app, event| {
                if event.id() == "preferences" {
                    let _ = app.emit("menu-preferences", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
