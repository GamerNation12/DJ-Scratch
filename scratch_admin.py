with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add command locks state
state_code = """
  const [lockedCommands, setLockedCommands] = useState<any[]>([]);
  const [lockCommandName, setLockCommandName] = useState("");
  const [lockReason, setLockReason] = useState("");
  
  const fetchLockedCommands = async () => {
    try {
      const res = await fetchApi("/api/admin/commands");
      if (res.ok) setLockedCommands(await res.json());
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleLockCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockCommandName || !lockReason) return toast.error("Missing fields");
    try {
      const res = await fetchApi("/api/admin/commands", {
        method: "POST",
        body: JSON.stringify({ command_name: lockCommandName, reason: lockReason })
      });
      if (res.ok) {
        toast.success("Command locked!");
        setLockCommandName("");
        setLockReason("");
        fetchLockedCommands();
      } else {
        toast.error("Failed to lock command");
      }
    } catch (e) {
      toast.error("Error locking command");
    }
  };
  
  const handleUnlockCommand = async (command_name: string) => {
    try {
      const res = await fetchApi(`/api/admin/commands?command=${command_name}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Command unlocked!");
        fetchLockedCommands();
      } else {
        toast.error("Failed to unlock");
      }
    } catch (e) {
      toast.error("Error unlocking command");
    }
  };
"""

text = text.replace('const [newAdminRole, setNewAdminRole] = useState("admin");', 'const [newAdminRole, setNewAdminRole] = useState("admin");\n' + state_code)

# 2. Add to useEffect
text = text.replace('if (activeTab === \'access\') fetchAdmins();', 'if (activeTab === \'access\') fetchAdmins();\n    if (activeTab === \'command-locks\') fetchLockedCommands();')

# 3. Add to desktop tabs
desktop_tab = """
            {(role === 'owner' || role === 'admin') && (
              <button onClick={() => setActiveTab('command-locks')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'command-locks' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Command Locks
              </button>
            )}
"""
text = text.replace('</nav>\n        </div>\n      </aside>', desktop_tab + '          </nav>\n        </div>\n      </aside>')

# 4. Add to mobile tabs
mobile_tab = "{(role === 'owner' || role === 'admin') && <button onClick={() => setActiveTab('command-locks')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'command-locks' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Command Locks</button>}"
text = text.replace('{(role === \'owner\' || role === \'admin\') && <button onClick={() => setActiveTab(\'chat-logs\')}', mobile_tab + '\n        {(role === \'owner\' || role === \'admin\') && <button onClick={() => setActiveTab(\'chat-logs\')}')

# 5. Add the actual UI panel
ui_panel = """
        {activeTab === 'command-locks' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Global Command Locks</h2>
              <p className="text-zinc-400 text-sm">Instantly disable commands globally for all users. Useful for maintenance or preventing abuse.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Lock Command
                  </h3>
                  <form onSubmit={handleLockCommand} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Command</label>
                      <select 
                        value={lockCommandName} 
                        onChange={(e) => setLockCommandName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="" disabled>Select a command...</option>
                        <optgroup label="Core Music">
                          <option value="fm">fm (Now Playing)</option>
                          <option value="playcount">playcount</option>
                          <option value="recent">recent</option>
                          <option value="topartists">topartists</option>
                          <option value="toptracks">toptracks</option>
                          <option value="topalbums">topalbums</option>
                        </optgroup>
                        <optgroup label="Social & Stats">
                          <option value="profile">profile</option>
                          <option value="whoknows">whoknows</option>
                          <option value="globalwhoknows">globalwhoknows</option>
                          <option value="crowns">crowns</option>
                          <option value="streak">streak</option>
                          <option value="compare">compare</option>
                          <option value="serverplaycount">serverplaycount</option>
                        </optgroup>
                        <optgroup label="System">
                          <option value="login">login</option>
                          <option value="logout">logout</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Reason for locking</label>
                      <input 
                        type="text" 
                        value={lockReason} 
                        onChange={(e) => setLockReason(e.target.value)}
                        placeholder="e.g. Undergoing maintenance"
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-zinc-700"
                        required
                      />
                    </div>
                    <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold py-2 rounded-lg transition-colors">
                      Lock Command
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/40 border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 font-medium text-zinc-400">Command</th>
                        <th className="px-4 py-3 font-medium text-zinc-400">Reason</th>
                        <th className="px-4 py-3 font-medium text-zinc-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {lockedCommands.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                            No commands are currently locked.
                          </td>
                        </tr>
                      ) : (
                        lockedCommands.map((c, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <span className="bg-zinc-800 text-white px-2 py-0.5 rounded text-xs font-mono">
                                /{c.command_name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{c.reason}</td>
                            <td className="px-4 py-3">
                              <button 
                                onClick={() => handleUnlockCommand(c.command_name)}
                                className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-medium transition-colors"
                              >
                                Unlock
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
"""

text = text.replace('{activeTab === \'terminal\' && <AdminTerminal />}', '{activeTab === \'terminal\' && <AdminTerminal />}\n' + ui_panel)

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated AdminClient.tsx')
