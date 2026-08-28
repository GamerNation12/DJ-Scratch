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

    import sys
    try:
        transport = paramiko.Transport((host, port))
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        print("Connected! Syncing files...")
        
        # Files/Folders to sync from discord-bot
        sync_items = [
            "discord-bot/src",
            "discord-bot/cogs",
            "discord-bot/main.py",
            "discord-bot/requirements.txt",
            ".env" # Keep .env in root for local testing
        ]
        
        def upload_file_with_retry(local_path, remote_path, retries=3):
            nonlocal transport, sftp
            for attempt in range(retries):
                try:
                    sftp.put(local_path, remote_path)
                    return
                except Exception as e:
                    print(f"Upload failed for {local_path}: {e}. Retrying ({attempt+1}/{retries})...")
                    import time
                    time.sleep(2)
                    try:
                        # Reconnect if connection dropped
                        transport.close()
                        transport = paramiko.Transport((host, port))
                        transport.connect(username=username, password=password)
                        sftp = paramiko.SFTPClient.from_transport(transport)
                    except:
                        pass
            raise Exception(f"Failed to upload {local_path} after {retries} attempts.")

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
                    upload_file_with_retry(local_path, remote_path)
                elif os.path.isdir(local_path):
                    upload_dir(local_path, remote_path)

        for item in sync_items:
            local_path = item
            # Strip "discord-bot/" from the remote path so it uploads to the server root
            remote_path = f"/{item.replace('discord-bot/', '')}"
            if os.path.isfile(local_path):
                print(f"Uploading {local_path} -> {remote_path}")
                upload_file_with_retry(local_path, remote_path)
            elif os.path.isdir(local_path):
                upload_dir(local_path, remote_path)
                
        # Write restart flag to tell the bot to restart

        try:
            with sftp.file('/.restart_flag', 'w') as f:
                f.write('restart')
            print("Wrote .restart_flag to remote server.")
        except Exception as e:
            print(f"Could not write .restart_flag: {e}")

        print("Deployment successful!")
    except Exception as e:
        print(f"Deployment failed: {e}")
        sys.exit(1)
    finally:
        if 'transport' in locals():
            transport.close()

if __name__ == "__main__":
    deploy()
