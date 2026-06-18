import PublicProfileClient from "./PublicProfileClient";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicProfileClient id={id} />;
}
