use kube::config::Kubeconfig;
use thiserror::Error;

#[derive(Debug, Error)]
enum Error {
    #[error("Kube error: {0}")]
    Kube(#[from] kube::config::KubeconfigError),
    #[error("Internal error: {0}")]
    Internal(String),
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

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_kube_contexts() -> Result<Vec<String>> {
    let kubeconfig = Kubeconfig::read().map_err(Error::Kube)?;
    let context_names = kubeconfig.contexts.into_iter().map(|ctx| ctx.name).collect();
    Ok(context_names)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_kube_contexts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
