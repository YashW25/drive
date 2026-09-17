import React, { useEffect, useState } from 'react';
import { Cpu, ShieldCheck, Hash, Terminal } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface BinaryExeViewerProps {
  url: string;
  filename: string;
}

export const BinaryExeViewer: React.FC<BinaryExeViewerProps> = ({ url, filename }) => {
  const [hexRows, setHexRows] = useState<{ offset: string; hex: string; ascii: string }[]>([]);
  const [isExecutable, setIsExecutable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const ext = getFileExtension(filename);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        const bytes = new Uint8Array(buffer.slice(0, 512));
        // Check MZ header (0x4D, 0x5A) for EXE/COM
        if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
          setIsExecutable(true);
        }

        const rows: { offset: string; hex: string; ascii: string }[] = [];
        for (let i = 0; i < bytes.length; i += 16) {
          const chunk = bytes.slice(i, i + 16);
          const offsetStr = i.toString(16).padStart(8, '0');
          const hexArr: string[] = [];
          let asciiStr = '';

          for (let b of chunk) {
            hexArr.push(b.toString(16).padStart(2, '0'));
            asciiStr += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
          }

          rows.push({
            offset: offsetStr,
            hex: hexArr.join(' '),
            ascii: asciiStr,
          });
        }
        setHexRows(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Analyzing Binary Header ({ext.toUpperCase()})...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header Info */}
      <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{filename}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="uppercase font-mono text-rose-400 font-bold">{ext} Binary File</span>
              {isExecutable && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified PE/MZ Signature
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Hex Dump Inspector */}
      <div className="flex-1 overflow-auto p-6 font-mono text-xs">
        <div className="mb-4 flex items-center gap-2 text-slate-400 text-[11px]">
          <Terminal className="w-3.5 h-3.5 text-brand-400" />
          <span>Hexadecimal Data Dump Header (First 512 bytes)</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-slate-300">
          <div className="grid grid-cols-12 font-bold text-slate-500 pb-2 mb-2 border-b border-slate-800 text-[11px]">
            <div className="col-span-3">Offset</div>
            <div className="col-span-6">Hex Bytes</div>
            <div className="col-span-3">ASCII</div>
          </div>

          <div className="space-y-1">
            {hexRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 hover:bg-slate-900/80 px-1 py-0.5 rounded">
                <div className="col-span-3 text-brand-400">{row.offset}</div>
                <div className="col-span-6 text-slate-200 tracking-wider">{row.hex}</div>
                <div className="col-span-3 text-emerald-400 font-sans">{row.ascii}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
