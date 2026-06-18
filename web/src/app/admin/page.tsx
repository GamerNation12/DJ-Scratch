import AdminClient from "./AdminClient";

export default function AdminDashboard() {
  // Stats fetching is temporarily disabled for static export
  const data = { totalPlays: 0, totalUsers: 0, botStats: null, commandUsage: [] };
  return <AdminClient data={data} />;
}
