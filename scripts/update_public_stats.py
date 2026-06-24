import re

with open('web/src/app/api/public/stats/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the usersResult query
c = c.replace('const usersResult = await pool.query("SELECT COUNT(*) FROM imported_users");', 'const usersResult = await pool.query("SELECT COUNT(*) FROM user_settings WHERE lastfm_username IS NOT NULL");')

# Replace the botStatsResult block to also extract serverCount
old_block = """    let activeMembers = 0;
    if (botStatsResult.rows.length > 0) {
      const stats = JSON.parse(botStatsResult.rows[0].value);
      activeMembers = stats.member_count || 0;
    }"""
new_block = """    let activeMembers = 0;
    let serverCount = 0;
    if (botStatsResult.rows.length > 0) {
      const stats = JSON.parse(botStatsResult.rows[0].value);
      activeMembers = stats.member_count || 0;
      serverCount = stats.server_count || 0;
    }"""
c = c.replace(old_block, new_block)

# Replace the return statement
c = c.replace('return NextResponse.json({ totalUsers, activeMembers, topAvatars: validAvatars });', 'return NextResponse.json({ totalUsers, activeMembers, serverCount, topAvatars: validAvatars });')
c = c.replace('return NextResponse.json({ totalUsers: 0, activeMembers: 0, topAvatars: [] }, { status: 500 });', 'return NextResponse.json({ totalUsers: 0, activeMembers: 0, serverCount: 0, topAvatars: [] }, { status: 500 });')

with open('web/src/app/api/public/stats/route.ts', 'w', encoding='utf-8') as f:
    f.write(c)

# Now update the page.tsx text
with open('web/src/app/page.tsx', 'r', encoding='utf-8') as f:
    page_c = f.read()

old_text = """Join <span className="text-white font-bold">{stats.totalUsers ? stats.totalUsers.toLocaleString() : '...'} registered users</span> across <br className="sm:hidden" /><span className="text-white font-bold">{stats.activeMembers ? stats.activeMembers.toLocaleString() : '...'} Discord members</span> using the bot right now."""
new_text = """Join <span className="text-white font-bold">{stats.totalUsers ? stats.totalUsers.toLocaleString() : '...'} Last.fm users</span> in <span className="text-white font-bold">{stats.serverCount ? stats.serverCount.toLocaleString() : '...'} servers</span> across <br className="sm:hidden" /><span className="text-white font-bold">{stats.activeMembers ? stats.activeMembers.toLocaleString() : '...'} Discord members</span> using the bot right now."""
page_c = page_c.replace(old_text, new_text)

with open('web/src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_c)
