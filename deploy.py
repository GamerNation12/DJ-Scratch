import os
import paramiko
import time
import random
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
        # Initial connection with timeout
        transport = paramiko.Transport((host, port))
        transport.settimeout(30)
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
        
        def reconnect():
            """Attempt to reconnect to the server"""
            nonlocal transport, sftp
            try:
                transport.close()
            except:
                pass
            
            time.sleep(1)
            transport = paramiko.Transport((host, port))
            transport.settimeout(30)
            transport.connect(username=username, password=password)
            sftp = paramiko.SFTPClient.from_transport(transport)
            print("Reconnected to server")
        
        def upload_file_with_retry(local_path, remote_path, max_retries=5):
            """Upload file with exponential backoff retry logic"""
            base_delay = 1
            
            for attempt in range(max_retries):
                try:
                    # Check connection health before upload
                    try:
                        sftp.stat('/')
                    except:
                        print(f"Connection lost, reconnecting...")
                        reconnect()
                    
                    sftp.put(local_path, remote_path)
                    print(f"✓ Uploaded {local_path}")
                    return
                except Exception as e:
                    if attempt < max_retries - 1:
                        # Exponential backoff with jitter
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"✗ Upload failed for {local_path}: {str(e)[:80]}. Retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
                        time.sleep(delay)
                        
                        # Try to reconnect before next attempt
                        try:
                            reconnect()
                        except Exception as reconnect_err:
                            print(f"Reconnection failed: {reconnect_err}")
                    else:
                        raise Exception(f"Failed to upload {local_path} after {max_retries} attempts.")

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
            print("✓ Wrote .restart_flag to remote server.")
        except Exception as e:
            print(f"⚠ Could not write .restart_flag: {e}")

        print("✓ Deployment successful!")
    except Exception as e:
        print(f"✗ Deployment failed: {e}")
        sys.exit(1)
    finally:
        if 'transport' in locals():
            try:
                transport.close()
            except:
                pass

if __name__ == "__main__":
    deploy()



