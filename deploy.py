import os
import warnings
try:
    from cryptography.utils import CryptographyDeprecationWarning
    warnings.filterwarnings("ignore", category=CryptographyDeprecationWarning)
except Exception:
    pass
import paramiko
import socket
import time
import random
from dotenv import load_dotenv

def _describe_conn_error(e):
    if isinstance(e, socket.gaierror):
        return (f"DNS can't resolve '{e}'. The hostname may have changed — "
                "check the SFTP details in your Pterodactyl panel.")
    if isinstance(e, ConnectionRefusedError):
        return ("Connection refused: the host is reachable but nothing accepts "
                "SFTP on that port. Check that the server is Online (not suspended) "
                "in your Pterodactyl panel, that the SFTP host/port are still correct, "
                "and that no firewall blocks GitHub Actions runner IPs.")
    if isinstance(e, socket.timeout):
        return ("Connection timed out: packets go nowhere. Likely routing/firewall "
                "or the host is down.")
    if isinstance(e, paramiko.AuthenticationException):
        return "Authentication failed: PTERO_PASSWORD is wrong or expired — update the repo secret."
    return str(e)

def _connect(host, port, username, password, tries=5):
    last = None
    for attempt in range(tries):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(30)
            sock.connect((host, port))
            transport = paramiko.Transport(sock)
            transport.connect(username=username, password=password)
            return transport, paramiko.SFTPClient.from_transport(transport)
        except Exception as e:
            last = e
            if attempt < tries - 1:
                delay = 2 ** attempt + random.uniform(0, 1)
                print(f"Connect attempt {attempt + 1}/{tries} failed ({e}). Retrying in {delay:.1f}s...")
                time.sleep(delay)
    raise ConnectionError(f"Could not connect to {host}:{port} after {tries} attempts. {_describe_conn_error(last)}")

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
        transport, sftp = _connect(host, port, username, password)
        print("Connected! Syncing files...")
        
        sync_items = [
            "discord-bot/src",
            "discord-bot/cogs",
            "discord-bot/main.py",
            "discord-bot/requirements.txt",
            ".env"
        ]
        
        def reconnect():
            nonlocal transport, sftp
            try:
                transport.close()
            except:
                pass

            time.sleep(1)
            transport, sftp = _connect(host, port, username, password, tries=3)
            print("Reconnected to server")
        
        def upload_file_with_retry(local_path, remote_path, max_retries=5):
            base_delay = 1
            for attempt in range(max_retries):
                try:
                    try:
                        sftp.stat('/')
                    except:
                        print(f"Connection lost, reconnecting...")
                        reconnect()
                    sftp.put(local_path, remote_path)
                    print(f"? Uploaded {local_path}")
                    return
                except Exception as e:
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"? Upload failed for {local_path}: {str(e)[:80]}. Retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
                        time.sleep(delay)
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
            remote_path = f"/{item.replace('discord-bot/', '')}"
            if os.path.isfile(local_path):
                print(f"Uploading {local_path} -> {remote_path}")
                upload_file_with_retry(local_path, remote_path)
            elif os.path.isdir(local_path):
                upload_dir(local_path, remote_path)
                
        try:
            # Restrict remote .env so other users on the host can't read secrets.
            try:
                sftp.chmod('/.env', 0o600)
            except Exception:
                pass
        except Exception:
            pass

        try:
            with sftp.file('/.restart_flag', 'w') as f:
                f.write('restart')
            print("? Wrote .restart_flag to remote server.")
        except Exception as e:
            print(f"? Could not write .restart_flag: {e}")

        print("? Deployment successful!")
    except Exception as e:
        print(f"? Deployment failed: {e}")
        sys.exit(1)
    finally:
        if 'transport' in locals():
            try:
                transport.close()
            except:
                pass

if __name__ == "__main__":
    deploy()
