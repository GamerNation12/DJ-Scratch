import os, re
commands = set()
for root, _, files in os.walk('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src'):
    for file in files:
        if file.endswith('.py'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                # find prefix commands
                prefix_cmds = re.findall(r'@commands\.command\(.*?name=[\'\"]([^\'\"]+)[\'\"]', content, re.DOTALL)
                for c in prefix_cmds: commands.add(c)
                # find slash commands
                slash_cmds = re.findall(r'@app_commands\.command\(.*?name=[\'\"]([^\'\"]+)[\'\"]', content, re.DOTALL)
                for c in slash_cmds: commands.add(c)

print('Found commands:', sorted(list(commands)))
