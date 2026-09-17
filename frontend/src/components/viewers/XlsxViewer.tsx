import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Table, Search, AlertCircle, Copy, Check, FileSpreadsheet } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface XlsxViewerProps {
  url: string;
  filename: string;
}

export const XlsxViewer: React.FC<XlsxViewerProps> = ({ url, filename }) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const ext = getFileExtension(filename);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!isMounted) return;
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        setWorkbook(wb);
        if (wb.SheetNames && wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setActiveSheet(firstSheet);
          parseSheet(wb, firstSheet);
        } else {
          setError('No sheets found in workbook.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Spreadsheet parse error:', err);
          setError(err.message || 'Failed to parse Excel spreadsheet');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      setSheetData([]);
      return;
    }
    // Parse to 2D array matrix
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    setSheetData(data);
  };

  const handleSelectSheet = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    parseSheet(workbook, sheetName);
  };

  // Filter rows by search query
  const filteredData = sheetData.filter((row, rowIndex) => {
    if (rowIndex === 0) return true; // Always keep header row
    if (!searchQuery.trim()) return true;
    return row.some((cell) =>
      String(cell || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getColLetter = (index: number) => {
    let col = '';
    while (index >= 0) {
      col = String.fromCharCode((index % 26) + 65) + col;
      index = Math.floor(index / 26) - 1;
    }
    return col;
  };

  const handleCopyTable = () => {
    if (!sheetData || sheetData.length === 0) return;
    const text = sheetData.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Rendering Spreadsheet ({ext.toUpperCase()})...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-400 bg-rose-950/20 rounded-xl border border-rose-900/40 max-w-md">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
        <p className="text-sm font-semibold mb-1">Spreadsheet Render Notice</p>
        <p className="text-xs text-rose-300/80 mb-3">{error}</p>
      </div>
    );
  }

  const maxCols = Math.max(0, ...sheetData.map((row) => row.length));

  return (
    <div className="w-full h-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
      {/* Spreadsheet Control Header */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 font-heading truncate max-w-xs">{filename}</h4>
            <p className="text-[11px] text-slate-400">
              {sheetData.length.toLocaleString()} rows • {maxCols} columns
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in sheet..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          <button
            onClick={handleCopyTable}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            title="Copy Sheet Data"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sheet Selection Tabs */}
      {workbook && workbook.SheetNames.length > 1 && (
        <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] text-slate-500 font-semibold px-2">Worksheets:</span>
          {workbook.SheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSelectSheet(name)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeSheet === name
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Data Grid Table Area */}
      <div className="flex-1 overflow-auto bg-slate-950/70 relative">
        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No matching rows found in worksheet.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            {/* Table Header: Column Index A, B, C... */}
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 font-mono text-[11px]">
                <th className="w-12 py-2 px-3 text-center bg-slate-950/80 border-r border-slate-800 text-slate-600 select-none">
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, colIndex) => (
                  <th
                    key={colIndex}
                    className="py-2 px-3 border-r border-slate-800/80 font-bold text-slate-400 bg-slate-900/90 min-w-[120px]"
                  >
                    {getColLetter(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
              {filteredData.map((row, rowIndex) => {
                const isHeader = rowIndex === 0;
                return (
                  <tr
                    key={rowIndex}
                    className={`transition-colors hover:bg-slate-800/50 ${
                      isHeader ? 'bg-slate-900/40 font-bold text-slate-100' : 'even:bg-slate-950/40'
                    }`}
                  >
                    {/* Row Index Number */}
                    <td className="py-2 px-3 text-center bg-slate-950/60 border-r border-slate-800/80 text-slate-500 text-[10px] select-none">
                      {rowIndex + 1}
                    </td>

                    {/* Cell Values */}
                    {Array.from({ length: maxCols }).map((_, colIndex) => {
                      const cellValue = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
                      return (
                        <td
                          key={colIndex}
                          className="py-2 px-3 border-r border-slate-800/50 truncate max-w-xs text-xs"
                          title={cellValue}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Bar */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Worksheet: <strong className="text-slate-300 font-semibold">{activeSheet}</strong></span>
        <span>Showing {filteredData.length.toLocaleString()} of {sheetData.length.toLocaleString()} rows</span>
      </div>
    </div>
  );
};
