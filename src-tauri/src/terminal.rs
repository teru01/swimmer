use portable_pty::{native_pty_system, Child, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::Error;

pub struct TerminalSession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub reader: Arc<Mutex<Box<dyn Read + Send>>>,
    pub child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    pub temp_kubeconfig: Option<PathBuf>,
}

pub type TerminalSessions = Arc<Mutex<HashMap<String, TerminalSession>>>;

fn create_temp_kubeconfig(
    context_name: &str,
    kubeconfig_path: Option<&str>,
) -> Result<PathBuf, Error> {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("swimmer-kubeconfig-{}", Uuid::new_v4()));

    // Read the original kubeconfig
    let original_kubeconfig = if let Some(path) = kubeconfig_path {
        PathBuf::from(path)
    } else {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| Error::Terminal("Could not determine home directory".to_string()))?;
        home_dir.join(".kube/config")
    };

    if !original_kubeconfig.exists() {
        return Err(Error::Terminal("Original kubeconfig not found".to_string()));
    }

    let kubeconfig_content = fs::read_to_string(&original_kubeconfig)
        .map_err(|e| Error::Terminal(format!("Failed to read kubeconfig: {}", e)))?;

    // Parse and modify kubeconfig to set current-context
    let mut config: serde_yml::Value = serde_yml::from_str(&kubeconfig_content)
        .map_err(|e| Error::Terminal(format!("Failed to parse kubeconfig: {}", e)))?;

    if let Some(map) = config.as_mapping_mut() {
        map.insert(
            serde_yml::Value::String("current-context".to_string()),
            serde_yml::Value::String(context_name.to_string()),
        );
    }

    let modified_content = serde_yml::to_string(&config)
        .map_err(|e| Error::Terminal(format!("Failed to serialize kubeconfig: {}", e)))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&temp_file)
            .map_err(|e| Error::Terminal(format!("Failed to create temp kubeconfig: {}", e)))?;
        file.write_all(modified_content.as_bytes())
            .map_err(|e| Error::Terminal(format!("Failed to write temp kubeconfig: {}", e)))?;
    }
    #[cfg(not(unix))]
    {
        // On Windows, std::env::temp_dir() returns a per-user directory
        // (%USERPROFILE%\AppData\Local\Temp) with appropriate ACLs.
        fs::write(&temp_file, modified_content)
            .map_err(|e| Error::Terminal(format!("Failed to write temp kubeconfig: {}", e)))?;
    }

    Ok(temp_file)
}

#[tauri::command]
pub async fn create_terminal_session(
    sessions: State<'_, TerminalSessions>,
    kubeconfig_path: tauri::State<'_, crate::KubeconfigPath>,
    app_handle: tauri::AppHandle,
    shell_path: String,
    context_name: Option<String>,
) -> Result<String, Error> {
    // Validate shell path exists
    if !std::path::Path::new(&shell_path).exists() {
        return Err(Error::Terminal(format!(
            "Shell not found: {}. Please check the path in preferences.",
            shell_path
        )));
    }

    let session_id = Uuid::new_v4().to_string();

    // Create temp kubeconfig if context is specified
    let kc_path = kubeconfig_path
        .lock()
        .map_err(|e| Error::Lock(e.to_string()))?
        .clone();
    let temp_kubeconfig = if let Some(ref ctx) = context_name {
        Some(create_temp_kubeconfig(ctx, kc_path.as_deref())?)
    } else {
        None
    };

    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| Error::Terminal(format!("Failed to create PTY: {}", e)))?;

    let mut cmd = CommandBuilder::new(shell_path.clone());
    // Enable emacs mode via shell option if supported
    // zsh and bash support -o emacs option
    let shell_name = std::path::Path::new(&shell_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    if shell_name == "zsh" || shell_name == "bash" {
        cmd.arg("-o");
        cmd.arg("emacs");
    }

    // Set KUBECONFIG environment variable if temp kubeconfig was created
    if let Some(ref kubeconfig_path) = temp_kubeconfig {
        cmd.env("KUBECONFIG", kubeconfig_path.to_string_lossy().as_ref());
    }
    let child = pty_pair
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

    let writer = Arc::new(Mutex::new(Box::new(writer) as Box<dyn Write + Send>));

    let session = TerminalSession {
        writer,
        reader: Arc::new(Mutex::new(reader)),
        child: Arc::new(Mutex::new(child)),
        temp_kubeconfig,
    };

    // Start reading from terminal in background
    let session_id_clone = session_id.clone();
    let reader_clone = session.reader.clone();
    let app_handle_clone = app_handle.clone();

    let _read_task = tokio::task::spawn_blocking(move || {
        let mut buffer = [0u8; 4096];
        loop {
            let read_result = {
                match reader_clone.lock() {
                    Ok(mut reader) => reader.read(&mut buffer),
                    Err(_) => break,
                }
            };

            match read_result {
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
    });

    sessions
        .lock()
        .map_err(|e| Error::Lock(e.to_string()))?
        .insert(session_id.clone(), session);

    Ok(session_id)
}

// Write user input data to shell session
#[tauri::command]
pub async fn write_to_terminal(
    sessions: State<'_, TerminalSessions>,
    session_id: String,
    data: String,
) -> Result<(), Error> {
    let sessions = sessions.lock().map_err(|e| Error::Lock(e.to_string()))?;
    if let Some(session) = sessions.get(&session_id) {
        let bytes = data.as_bytes();
        let mut writer = session
            .writer
            .lock()
            .map_err(|e| Error::Lock(e.to_string()))?;
        let mut written = 0;
        while written < bytes.len() {
            match writer.write(&bytes[written..]) {
                Ok(n) => written += n,
                Err(e) => {
                    return Err(Error::Terminal(format!(
                        "Failed to write to terminal: {}",
                        e
                    )))
                }
            }
        }
        // Flush to ensure data is sent immediately
        writer
            .flush()
            .map_err(|e| Error::Terminal(format!("Failed to flush terminal: {}", e)))?;
    } else {
        return Err(Error::Terminal("Session not found".to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn close_terminal_session(
    sessions: State<'_, TerminalSessions>,
    session_id: String,
) -> Result<(), Error> {
    let mut sessions = sessions.lock().map_err(|e| Error::Lock(e.to_string()))?;
    if let Some(session) = sessions.remove(&session_id) {
        // Kill the child process
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
        // Clean up temp kubeconfig file
        if let Some(kubeconfig_path) = session.temp_kubeconfig {
            let _ = fs::remove_file(kubeconfig_path);
        }
    }
    Ok(())
}
