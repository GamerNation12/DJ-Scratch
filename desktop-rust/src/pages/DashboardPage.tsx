export default function DashboardPage({ token, username }: { token: string; username: string }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-8">Dashboard</h1>
      <p className="text-zinc-400">Welcome back, {username}. Desktop app in progress — some features may be limited.</p>
    </div>
  );
}
