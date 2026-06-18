import os
import subprocess
from ftplib import FTP
from dotenv import load_dotenv

def deploy_web():
    load_dotenv()
    
    env = os.environ.copy()
    env["BUILD_STATIC"] = "true"
    env["NEXT_PUBLIC_API_URL"] = "https://the-goats-dj.vercel.app"
    
    api_dir = os.path.join("web", "src", "app", "api")
    hidden_api_dir = os.path.join("web", "src", "app", "_api_temp")
    
    if os.path.exists(api_dir):
        os.rename(api_dir, hidden_api_dir)

    try:
        result = subprocess.run("npm run build", shell=True, cwd="web", env=env)
    finally:
        if os.path.exists(hidden_api_dir):
            os.rename(hidden_api_dir, api_dir)

    if result.returncode != 0:
        print("Build failed. Stopping deployment.")
        return

    print("Build successful. Deploying to web host via FTP...")

    host = os.getenv("WEB_FTP_HOST", "lu-shared04.dapanel.net")
    port = int(os.getenv("WEB_FTP_PORT", "21"))
    username = os.getenv("WEB_FTP_USER", "")
    password = os.getenv("WEB_FTP_PASSWORD", "")
    
    if not username or not password:
        print("ERROR: WEB_FTP_USER and WEB_FTP_PASSWORD must be set in .env")
        return

    try:
        ftp = FTP()
        print(f"Connecting to {host}:{port}...")
        ftp.connect(host, port)
        ftp.login(username, password)
        print("Connected to web host!")
        
        local_dir = os.path.join("web", "out")
        remote_dir = "/domains/the-goats-dj.hostedbyfps.com/public_html"
        
        try:
            ftp.cwd(remote_dir)
        except Exception as e:
            print(f"Could not change to remote directory {remote_dir}: {e}")
            return
            
        # File clearing has been disabled to speed up deployment
            
        def upload_dir(ftp, local_path):
            for item in os.listdir(local_path):
                l_path = os.path.join(local_path, item)
                if os.path.isfile(l_path):
                    print(f"Uploading {l_path} -> {item}")
                    with open(l_path, 'rb') as f:
                        ftp.storbinary(f"STOR {item}", f)
                elif os.path.isdir(l_path):
                    try:
                        ftp.mkd(item)
                    except:
                        pass
                    ftp.cwd(item)
                    upload_dir(ftp, l_path)
                    ftp.cwd('..')
                    
        print(f"Uploading new website files from {local_dir}...")
        ftp.cwd(remote_dir)
        upload_dir(ftp, local_dir)
        
        print("Web Deployment successful!")
        ftp.quit()
    except Exception as e:
        print(f"Web Deployment failed: {e}")

if __name__ == "__main__":
    deploy_web()
