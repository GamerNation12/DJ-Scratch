#![cfg_attr(not(debug_assertions), windows_subsystem = "console")]

use anyhow::Result;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

fn main() -> Result<()> {
    println!("DJ Scratch Desktop Builder v2.21.0");
    println!("=====================================");
    println!();
    println!("1. Build & Release (mobile APK + desktop EXE)");
    println!("2. Exit");
    println!();
    print!("Choose an option: ");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input)?;

    if input.trim() != "1" {
        return Ok(());
    }

    // Find the repo root from the exe location
    let exe_path = std::env::current_exe().unwrap_or_default();
    let repo_root = exe_path
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();
    let script = repo_root.join("build-all.ps1");

    println!("\nRunning: {} -Release", script.display());
    println!("----------------------------------------");

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
    }

    println!("\nPress Enter to exit...");
    let mut _exit = String::new();
    std::io::stdin().read_line(&mut _exit)?;

    Ok(())
}
