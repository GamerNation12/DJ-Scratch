with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We will replace the <select> block
new_select = """                      <select 
                        value={lockCommandName} 
                        onChange={(e) => setLockCommandName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="" disabled>Select a command...</option>
                        <optgroup label="Core Music">
                          <option value="fm">fm (Now Playing)</option>
                          <option value="recent">recent / rt</option>
                          <option value="track">track</option>
                          <option value="album">album</option>
                          <option value="artist">artist</option>
                          <option value="toptracks">toptracks / tt</option>
                          <option value="topalbums">topalbums</option>
                          <option value="topartists">topartists / ta</option>
                          <option value="artisttracks">artisttracks / at</option>
                          <option value="artistchart">artistchart</option>
                          <option value="chart">chart</option>
                        </optgroup>
                        <optgroup label="Social & Stats">
                          <option value="profile">profile</option>
                          <option value="whoknows">whoknows / wk</option>
                          <option value="whoknowsalbum">whoknowsalbum / wka</option>
                          <option value="whoknowstrack">whoknowstrack / wkt</option>
                          <option value="globalwhoknows">globalwhoknows</option>
                          <option value="globalwhoknowsalbum">globalwhoknowsalbum</option>
                          <option value="globalwhoknowstrack">globalwhoknowstrack</option>
                          <option value="crowns">crowns</option>
                          <option value="streak">streak</option>
                          <option value="taste">taste (compare)</option>
                          <option value="server">server</option>
                          <option value="serveralbums">serveralbums</option>
                          <option value="serverartists">serverartists</option>
                          <option value="servertracks">servertracks</option>
                        </optgroup>
                        <optgroup label="Games">
                          <option value="guess">guess</option>
                          <option value="scramble">scramble</option>
                          <option value="judge">judge</option>
                        </optgroup>
                        <optgroup label="System & Help">
                          <option value="login">login</option>
                          <option value="logout">logout</option>
                          <option value="help">help</option>
                          <option value="guide">guide</option>
                          <option value="settings">settings</option>
                          <option value="premium">premium</option>
                          <option value="import">import</option>
                          <option value="outofsync">outofsync</option>
                          <option value="deletedata">deletedata</option>
                          <option value="receipt">receipt</option>
                          <option value="bug">bug</option>
                          <option value="suggest">suggest</option>
                          <option value="updates">updates</option>
                          <option value="status">status</option>
                          <option value="privacy">privacy</option>
                          <option value="cd">cd</option>
                          <option value="cd2">cd2</option>
                        </optgroup>
                      </select>"""

text = re.sub(r'<select\s+value=\{lockCommandName\}.*?</select>', new_select, text, flags=re.DOTALL)

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated select block')
