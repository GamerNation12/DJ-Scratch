import os
import paramiko
from dotenv import load_dotenv

def deploy():
    load_dotenv()
    host = "mango.fps.ms"
    port = 2022
    username = "gamernation120.5be081c1"
    password = os.getenv("PTERO_PASSWORD")
    
    if not password:
        print("ERROR: PTERO_PASSWORD is not set in .env")
        return

    print(f"Connecting to {host}:{port} as {username}...")
    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        print("Connected! Syncing files...")
        
        # Files/Folders to sync
        sync_items = [
            "src",
            "main.py",
            "requirements.txt",
            ".env"
        ]
        
        def upload_dir(local_dir, remote_dir):
            try:
                sftp.mkdir(remote_dir)
            except IOError:
                pass
                
            for item in os.listdir(local_dir):
                if item == "__pycache__":
                    continue
                local_path = os.path.join(local_dir, item)
                remote_path = f"{remote_dir}/{item}"
                
                if os.path.isfile(local_path):
                    print(f"Uploading {local_path} -> {remote_path}")
                    sftp.put(local_path, remote_path)
                elif os.path.isdir(local_path):
                    upload_dir(local_path, remote_path)

        for item in sync_items:
            local_path = item
            remote_path = f"/{item}"
            if os.path.isfile(local_path):
                print(f"Uploading {local_path} -> {remote_path}")
                sftp.put(local_path, remote_path)
            elif os.path.isdir(local_path):
                upload_dir(local_path, remote_path)
                
        print("Deployment successful!")
    except Exception as e:
        print(f"Deployment failed: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    deploy()
