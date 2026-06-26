import os
import glob
import re

files = glob.glob('src/**/*.py', recursive=True)

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "print(" not in content:
        continue
    
    # Replace print(f"{Log.XXX}>>> MSG{Log.RESET}") -> log.info(f"MSG")
    # First, let's find all print statements
    lines = content.split('\n')
    has_changes = False
    
    for i, line in enumerate(lines):
        if 'print(' in line:
            # check if it uses Log
            if '{Log.' in line or '[PREFIX COMMAND]' in line or '[SLASH COMMAND]' in line or 'Connected to Postgres' in line or 'Loaded ' in line:
                # We want to replace it.
                # Remove {Log.XXX}
                clean_line = re.sub(r'\{Log\.[A-Z]+\}', '', line)
                # Remove >>> 
                clean_line = clean_line.replace('>>> ', '')
                # Replace print( with log.info(
                clean_line = clean_line.replace('print(', 'log.info(')
                
                # if the original was print("...") without f, and we removed >>>, it might be log.info("...")
                
                lines[i] = clean_line
                has_changes = True
            elif 'print(f"Error ' in line or 'print(f"Failed ' in line or 'print(f"Spotify fetch error' in line or 'print(f"Exception' in line:
                clean_line = line.replace('print(', 'log.error(')
                lines[i] = clean_line
                has_changes = True

    if has_changes:
        # Add import logging and log = logging.getLogger('goats') at the top if not present
        if 'import logging' not in '\n'.join(lines):
            # insert after import discord or first import
            insert_idx = 0
            for idx, l in enumerate(lines):
                if l.startswith('import ') or l.startswith('from '):
                    insert_idx = idx + 1
            
            lines.insert(insert_idx, 'import logging')
            lines.insert(insert_idx+1, 'log = logging.getLogger("goats")')
            
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"Patched {path}")

# Fix main.py too
with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()
if 'print("Starting the Goats DJ Bot...")' in content:
    content = content.replace('print("Starting the Goats DJ Bot...")', 'import logging\n    log = logging.getLogger("goats")\n    log.info("Starting the Goats DJ Bot...")')
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
