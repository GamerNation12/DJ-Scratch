import { useEffect, useState } from 'react';

type Info = { progress: number | null; downloaded: boolean };

export default function UpdateBanner() {
  const [info, setInfo] = useState<Info>({ progress: null, downloaded: false });

  useEffect(() => {
    const w = window as unknown as {
      djscratch?: {
        onUpdateProgress: (cb: (v: number) => void) => void;
        onUpdateDownloaded: (cb: () => void) => void;
      };
    };
    w.djscratch?.onUpdateProgress((v) => setInfo({ progress: v, downloaded: false }));
    w.djscratch?.onUpdateDownloaded(() => setInfo({ progress: 100, downloaded: true }));
  }, []);

  if (info.progress === null) return null;

  return (
    <div className="mx-10 mt-4 bg-indigo-500/15 border border-indigo-500/40 rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex justify-between items-center text-sm font-bold text-indigo-200">
        <span>{info.downloaded ? 'Update ready — restart to install' : 'Downloading update…'}</span>
        <span>{info.progress}%</span>
      </div>
      <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden mt-2">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${info.progress}%` }} />
      </div>
    </div>
  );
}
