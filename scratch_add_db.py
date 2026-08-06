with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_func = """
async def is_command_disabled(command_name: str) -> str:
    rows = await db_fetch("SELECT reason FROM disabled_commands WHERE command_name = $1", command_name)
    if rows:
        return rows[0]['reason']
    return None
"""

if 'is_command_disabled' not in text:
    with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'a', encoding='utf-8') as f:
        f.write('\n' + new_func + '\n')
    print('Added is_command_disabled to database.py')
