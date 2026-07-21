import os
import sys
import subprocess
import threading

def log_stream(stream, prefix):
    """Read lines from a stream and print them with a prefix."""
    for line in iter(stream.readline, ''):
        sys.stdout.write(f"[{prefix}] {line}")
        sys.stdout.flush()

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("====================================================")
    print("  Starting FashionFlow Unified Developer Environment")
    print("====================================================")

    # 1. Detect Python Interpreter (Use local .venv if present)
    venv_dir = os.path.join(root_dir, ".venv")
    if os.path.exists(venv_dir):
        if os.name == "nt":  # Windows
            python_executable = os.path.join(venv_dir, "Scripts", "python.exe")
        else:  # Unix/Linux/macOS
            python_executable = os.path.join(venv_dir, "bin", "python")
    else:
        python_executable = sys.executable

    print(f"[SYSTEM] Using Python interpreter: {python_executable}")

    # Start FastAPI Backend Subprocess
    backend_cmd = [python_executable, "app.py"]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    # 2. Start Next.js Frontend Subprocess
    if os.environ.get("IS_DOCKER") == "true" or os.environ.get("NODE_ENV") == "production":
        frontend_cmd = ["npm", "run", "start"]
        shell_val = False
    elif os.name == "nt":
        frontend_cmd = ["npm.cmd", "run", "dev"]
        shell_val = False
    else:
        frontend_cmd = ["npm", "run", "dev"]
        shell_val = False

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=shell_val,
        text=True,
        bufsize=1
    )

    # 3. Create threads to read stdout/stderr from both processes concurrently
    threads = [
        threading.Thread(target=log_stream, args=(backend_proc.stdout, "BACKEND")),
        threading.Thread(target=log_stream, args=(backend_proc.stderr, "BACKEND-ERR")),
        threading.Thread(target=log_stream, args=(frontend_proc.stdout, "FRONTEND")),
        threading.Thread(target=log_stream, args=(frontend_proc.stderr, "FRONTEND-ERR")),
    ]

    for t in threads:
        t.daemon = True
        t.start()

    print("\n[SYSTEM] Both servers started successfully.")
    print("[SYSTEM] Backend: http://127.0.0.1:8000")
    print("[SYSTEM] Frontend: http://localhost:3000")
    print("[SYSTEM] Press Ctrl+C to terminate both servers...\n")

    try:
        # Keep main thread alive while subprocesses are running
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n[SYSTEM] Terminating servers immediately...")
        # Force-kill to bypass Windows "Terminate batch job (Y/N)?" prompt
        backend_proc.kill()
        frontend_proc.kill()
        print("[SYSTEM] Both servers stopped.")

if __name__ == "__main__":
    main()
