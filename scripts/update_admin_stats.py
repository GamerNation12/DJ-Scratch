import re

with open('web/src/app/admin/AdminClient.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the component signature
c = c.replace('export default function AdminClient({ data }: { data: any }) {', 'export default function AdminClient() {')

# Add state for stats
state_str = """  const [statsData, setStatsData] = useState<any>({ totalPlays: 0, totalUsers: 0, botStats: null, commandUsage: [] });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (session && (session.user as any)?.id === "759433582107426816") {
      fetchApi("/api/admin/stats")
        .then(res => res.json())
        .then(data => {
          if (!data.error) setStatsData(data);
          setStatsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setStatsLoading(false);
        });
    }
  }, [session]);
"""

c = c.replace('  const { data: session } = useSession();', '  const { data: session } = useSession();\n' + state_str)

# Replace the data destructuring
c = c.replace('const { totalPlays, totalUsers, botStats, commandUsage } = data;', 'const { totalPlays, totalUsers, botStats, commandUsage } = statsData;')

with open('web/src/app/admin/AdminClient.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

# Also update page.tsx to not pass data
with open('web/src/app/admin/page.tsx', 'r', encoding='utf-8') as f:
    page_c = f.read()

page_c = page_c.replace('const data = { totalPlays: 0, totalUsers: 0, botStats: null, commandUsage: [] };', '')
page_c = page_c.replace('return <AdminClient data={data} />;', 'return <AdminClient />;')

with open('web/src/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_c)
