import subprocess
import sys
import shutil
from pathlib import Path

def build():
    print("==================================================")
    print("  PROJECT KRISHNA - EXECUTABLE BUILD UTILITY")
    print("==================================================")
    
    # 1. Clean previous build folders
    for folder in ["build", "dist"]:
        path = Path(folder)
        if path.exists():
            print(f"Cleaning existing {folder} directory...")
            shutil.rmtree(path)
            
    spec_file = Path("KrishnaAI.spec")
    if spec_file.exists():
        spec_file.unlink()

    # 2. Build PyInstaller Command
    cmd = [
        "pyinstaller",
        "--onefile",
        "--name=KrishnaAI",
        # Copy frontend static files
        "--add-data", "frontend;frontend",
        # Copy backend dynamic plugins folder
        "--add-data", "backend/plugins;backend/plugins",
        # Hidden imports for dynamic plugin loader
        "--hidden-import=backend.plugins.weather_plugin",
        "--hidden-import=backend.plugins.whatsapp_plugin",
        "--hidden-import=backend.plugins.telegram_plugin",
        # Hidden imports for Uvicorn server runtime
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.http.h11_impl",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.protocols.websockets.websockets_impl",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.loops.asyncio",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=websockets.legacy.server",
        "run.py"
    ]
    
    print("\nRunning compilation command:")
    print(" ".join(cmd))
    print("\nStarting build (this may take up to 2 minutes)...\n")
    
    res = subprocess.run(cmd)
    
    if res.returncode == 0:
        # Copy credentials.env to dist folder if it exists
        cred_src = Path("credentials.env")
        cred_dest = Path("dist/credentials.env")
        if cred_src.exists():
            print("Copying credentials.env to dist folder...")
            shutil.copy(cred_src, cred_dest)
            
        print("\n==================================================")
        print("  BUILD COMPLETED SUCCESSFULLY!")
        print("==================================================")
        print("Your standalone executable is located at:")
        print(f" -> {Path('dist/KrishnaAI.exe').resolve()}")
        print("==================================================")
    else:
        print(f"\nBuild failed with exit code: {res.returncode}")

if __name__ == "__main__":
    build()
