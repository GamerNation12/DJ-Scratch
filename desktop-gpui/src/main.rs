#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

fn main() -> Result<()> {
    // Find the repo root from the exe location
    let exe_path = std::env::current_exe().unwrap_or_default();
    let repo_root = exe_path
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();
    let script = repo_root.join("build-all.ps1");

    println!("DJ Scratch Desktop Builder v2.2.10");
    println!("Running: {} -Release", script.display());

    let mut cmd = Command::new("powershell");
    cmd.arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(&script)
        .arg("-Release")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()?;

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                println!("{}", line);
            }
        }
    }

    let status = child.wait()?;
    if status.success() {
        println!("\n=== Build & Release Complete ===");
    } else {
        println!("\n=== Build & Release Failed ===");
        std::process::exit(1);
    }

    Ok(())
}
