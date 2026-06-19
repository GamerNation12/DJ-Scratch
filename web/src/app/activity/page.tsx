import ActivityClient from './ActivityClient';

export default function ActivityPage() {
  // Read the client ID from the server environment
  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
          <p>DISCORD_CLIENT_ID is not configured in your environment variables.</p>
        </div>
      </div>
    );
  }

  return <ActivityClient clientId={clientId} />;
}
