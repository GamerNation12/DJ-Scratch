import os
import asyncio
import asyncpg
from dotenv import load_dotenv

async def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("No DATABASE_URL")
        return
    
    print(f"Connecting to database...")
    conn = await asyncpg.connect(db_url)
    
    print("Checking constraints on imported_users...")
    try:
        # Check if there are any duplicate IDs first, which would prevent adding a PK
        duplicates = await conn.fetch("SELECT id, COUNT(*) FROM imported_users GROUP BY id HAVING COUNT(*) > 1")
        if duplicates:
            print(f"Found {len(duplicates)} duplicate IDs! Cleaning up...")
            for dup in duplicates:
                id_val = dup['id']
                # Keep one and delete the rest
                await conn.execute("""
                    DELETE FROM imported_users 
                    WHERE id = $1 AND ctid NOT IN (
                        SELECT ctid FROM imported_users WHERE id = $1 LIMIT 1
                    )
                """, id_val)
            print("Cleanup complete.")
            
        await conn.execute("ALTER TABLE imported_users ADD PRIMARY KEY (id);")
        print("Added PRIMARY KEY to imported_users(id)")
    except asyncpg.exceptions.InvalidTableDefinitionError as e:
        print(f"Primary key might already exist or cannot be added: {e}")
    except Exception as e:
        print(f"Error adding primary key: {e}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
