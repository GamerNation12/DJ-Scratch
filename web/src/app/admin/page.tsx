import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Pool } from "@neondatabase/serverless";
import Link from "next/link";

async function getStats() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  let totalPlays = 0;
  let totalUsers = 0;
  
  try {
    const playsResult = await pool.query("SELECT COUNT(*) FROM listens");
    totalPlays = parseInt(playsResult.rows[0].count, 10);
    
    const usersResult = await pool.query("SELECT COUNT(*) FROM imported_users");
    totalUsers = parseInt(usersResult.rows[0].count, 10);
  } catch (e) {
    console.error("Failed to fetch stats:", e);
  } finally {
    await pool.end();
  }
  
  return { totalPlays, totalUsers };
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user as any)?.id !== "759433582107426816") {
    redirect("/");
  }

  const { totalPlays, totalUsers } = await getStats();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              The Goats DJ Admin
            </h1>
            <p className="text-gray-400 mt-2">Welcome back, Boss.</p>
          </div>
          <Link href="/api/auth/signout" className="px-5 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-medium transition-all">
            Sign Out
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Stat Card 1 */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all group">
            <h3 className="text-gray-400 font-medium mb-2">Total Database Scrobbles</h3>
            <p className="text-5xl font-black text-white group-hover:text-blue-400 transition-colors">
              {totalPlays.toLocaleString()}
            </p>
          </div>
          
          {/* Stat Card 2 */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all group">
            <h3 className="text-gray-400 font-medium mb-2">Imported Users</h3>
            <p className="text-5xl font-black text-white group-hover:text-purple-400 transition-colors">
              {totalUsers.toLocaleString()}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 rounded-2xl p-6">
             <h3 className="text-indigo-200 font-medium mb-4">Quick Actions</h3>
             <div className="space-y-3">
               <button className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-semibold transition-colors">
                 Sync Discord Commands
               </button>
               <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
                 Clear Duplicates
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
