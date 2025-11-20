use kube::config::Kubeconfig;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
enum Error {
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

// Terminal session management
struct TerminalSession {
    writer: Box<dyn std::io::Write + Send>,
    reader: Arc<Mutex<Box<dyn std::io::Read + Send>>>,
}

type TerminalSessions = Arc<Mutex<HashMap<String, TerminalSession>>>;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_kube_contexts() -> Result<Vec<String>> {
    let kubeconfig = Kubeconfig::read().map_err(Error::Kube)?;
    let context_names = kubeconfig
        .contexts
        .into_iter()
        .map(|ctx| ctx.name)
        .collect();
    Ok(context_names)
}

#[tauri::command]
async fn create_terminal_session(
    sessions: State<'_, TerminalSessions>,
    app_handle: tauri::AppHandle,
) -> Result<String> {
    let session_id = Uuid::new_v4().to_string();

    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| Error::Terminal(format!("Failed to create PTY: {}", e)))?;

    let cmd = CommandBuilder::new("/bin/zsh");
    let _child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| Error::Terminal(format!("Failed to spawn shell: {}", e)))?;

    let reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| Error::Terminal(format!("Failed to clone reader: {}", e)))?;

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| Error::Terminal(format!("Failed to take writer: {}", e)))?;

    let session = TerminalSession {
        writer: Box::new(writer),
        reader: Arc::new(Mutex::new(reader)),
    };

    // Start reading from terminal in background
    let session_id_clone = session_id.clone();
    let reader_clone = session.reader.clone();
    let app_handle_clone = app_handle.clone();

    let _read_task = tokio::spawn(async move {
        let mut buffer = [0u8; 1024];
        loop {
            if let Ok(mut reader) = reader_clone.try_lock() {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_handle_clone.emit(
                            "terminal-output",
                            serde_json::json!({
                                "session_id": session_id_clone,
                                "data": output
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
    });

    sessions.lock().unwrap().insert(session_id.clone(), session);

    Ok(session_id)
}

#[tauri::command]
async fn write_to_terminal(
    sessions: State<'_, TerminalSessions>,
    session_id: String,
    data: String,
) -> Result<()> {
    let mut sessions = sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        use std::io::Write;
        let bytes = data.as_bytes();
        let mut written = 0;
        while written < bytes.len() {
            match session.writer.write(&bytes[written..]) {
                Ok(n) => written += n,
                Err(e) => {
                    return Err(Error::Terminal(format!(
                        "Failed to write to terminal: {}",
                        e
                    )))
                }
            }
        }
    } else {
        return Err(Error::Terminal("Session not found".to_string()));
    }
    Ok(())
}

#[tauri::command]
async fn close_terminal_session(
    sessions: State<'_, TerminalSessions>,
    session_id: String,
) -> Result<()> {
    let mut sessions = sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let terminal_sessions: TerminalSessions = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(terminal_sessions)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_kube_contexts,
            create_terminal_session,
            write_to_terminal,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
