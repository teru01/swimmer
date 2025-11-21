use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::Error;

// Terminal session management
pub struct TerminalSession {
    pub writer: Box<dyn Write + Send>,
    pub reader: Arc<Mutex<Box<dyn Read + Send>>>,
}

pub type TerminalSessions = Arc<Mutex<HashMap<String, TerminalSession>>>;

#[tauri::command]
pub async fn create_terminal_session(
    sessions: State<'_, TerminalSessions>,
    app_handle: tauri::AppHandle,
    shell_path: String,
) -> Result<String, Error> {
    // Validate shell path exists
    if !std::path::Path::new(&shell_path).exists() {
        return Err(Error::Terminal(format!(
            "Shell not found: {}. Please check the path in preferences.",
            shell_path
        )));
    }

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

    let cmd = CommandBuilder::new(shell_path);
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

    sessions.lock().unwrap().insert(session_id.clone(), session);

    Ok(session_id)
}

// Write user input data to shell session
#[tauri::command]
pub async fn write_to_terminal(
    sessions: State<'_, TerminalSessions>,
    session_id: String,
    data: String,
) -> Result<(), Error> {
    let mut sessions = sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
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
        // Flush to ensure data is sent immediately
        session
            .writer
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
    let mut sessions = sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}
