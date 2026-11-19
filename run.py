import sys
import os
import time
import webbrowser
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("krishna.launcher")

def check_dependencies():
    """Verify standard third-party libraries are present in environment."""
    required = ["fastapi", "uvicorn", "websockets", "psutil", "pyautogui", "dotenv", "PIL"]
    missing = []
    
    for lib in required:
        try:
            if lib == "dotenv":
                import dotenv
            elif lib == "PIL":
                import PIL
            else:
                __import__(lib)
        except ImportError:
            missing.append(lib)
            
    if missing:
        logger.warning(
            f"Missing required packages: {', '.join(missing)}. "
            "Please run: pip install -r requirements.txt"
        )
        return False
    return True

def launch():
    # Load settings
    from backend.config import Config
    
    logger.info("Initializing Project Krishna AI OS Backend Service...")
    
    host = Config.HOST
    port = Config.PORT
    url = f"http://{host}:{port}/"
    
    # Auto-open browser in a thread after a brief delay to let uvicorn initialize
    import threading
    def open_browser():
        time.sleep(1.5)
        logger.info(f"Diagnostics nominal. Loading frontend interface at: {url}")
        webbrowser.open(url)
        
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Launch Uvicorn server
    import uvicorn
    from backend.main import app
    logger.info(f"Starting server on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")

if __name__ == "__main__":
    # Ensure current directory is in sys.path
    current_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(current_dir))
    
    # Check dependencies first
    check_dependencies()
    
    # Run the server
    launch()
