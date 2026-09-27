import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared file | DJ Scratch",
  description: "Shared file.",
  // Unlisted: reachable only by direct link, never indexed or linked on-site.
  robots: { index: false, follow: false },
};

function cleanId(raw: string): string | null {
  const id = (raw || "").trim();
  return /^[A-Za-z0-9_-]{10,80}$/.test(id) ? id : null;
}

export default async function SharedFile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fileId = cleanId(id);

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute w-[700px] h-[700px] bg-fuchsia-600/15 rounded-full blur-[130px] mix-blend-screen"></div>
        <div className="absolute w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] mix-blend-screen"></div>
      </div>
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-6">
        {fileId ? (
          <>
            <div className="w-full rounded-3xl overflow-hidden border-2 border-white/10 bg-black/40 shadow-2xl">
              <iframe
                src={`https://drive.google.com/file/d/${fileId}/preview`}
                className="w-full h-[70vh] min-h-[420px]"
                allow="autoplay; fullscreen"
                title="Shared file"
              />
            </div>
            <a
              href={`https://drive.google.com/file/d/${fileId}/view`}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-white text-zinc-950 font-extrabold rounded-2xl text-sm hover:scale-105 transition-all shadow-[6px_6px_0_rgba(255,47,179,0.9)]"
            >
              Open in Google Drive
            </a>
          </>
        ) : (
          <div className="p-8 rounded-3xl border-2 border-white/10 bg-white/5 text-center">
            <p className="text-zinc-300 font-semibold">That share link doesn&apos;t look right.</p>
          </div>
        )}
      </div>
    </div>
  );
}
