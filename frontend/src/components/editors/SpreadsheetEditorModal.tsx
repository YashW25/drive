import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileItem } from '../../context/DriveContext';
import { getFileRawUrl, uploadFileVersion } from '../../services/api';
import { getFileExtension } from '../../utils/fileTypes';
import {
  X,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Check,
  Calculator,
  Search,
} from 'lucide-react';

interface SpreadsheetEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const SpreadsheetEditorModal: React.FC<SpreadsheetEditorModalProps> = ({
  file,
  onClose,
  onSaveSuccess,
}) => {
  const [data, setData] = useState<string[][]>([
    ['Header 1', 'Header 2', 'Header 3'],
    ['Data 1', 'Data 2', 'Data 3'],
  ]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const ext = getFileExtension(file.name);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(getFileRawUrl(file.id))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!isMounted) return;
        try {
          const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
          if (wb.SheetNames && wb.SheetNames.length > 0) {
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: '',
              blankrows: false,
            });
            if (rows.length > 0) {
              const maxCols = Math.max(0, ...rows.map((r: any[]) => (Array.isArray(r) ? r.length : 0)));
              const formattedRows = rows.map((row: any[]) => {
                const paddedRow = new Array(maxCols).fill('');
                if (Array.isArray(row)) {
                  for (let c = 0; c < row.length; c++) {
                    const cell = row[c];
                    paddedRow[c] = cell !== undefined && cell !== null ? String(cell) : '';
                  }
                }
                return paddedRow;
              });
              setData(formattedRows);
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse spreadsheet with XLSX:', parseErr);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Spreadsheet fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [file.id]);

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newData = data.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        const newRow = [...row];
        newRow[colIndex] = value;
        return newRow;
      }
      return row;
    });
    setData(newData);
  };

  const addRow = () => {
    const colCount = data[0] ? data[0].length : 3;
    const newRow = new Array(colCount).fill('');
    setData([...data, newRow]);
  };

  const addColumn = () => {
    const colName = `Column ${data[0] ? data[0].length + 1 : 1}`;
    const newData = data.map((row, idx) => (idx === 0 ? [...row, colName] : [...row, '']));
    setData(newData);
  };

  const deleteRow = (rowIndex: number) => {
    if (data.length <= 1) return;
    setData(data.filter((_, idx) => idx !== rowIndex));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      let blob: Blob;
      if (ext === 'csv') {
        const csvOut = XLSX.utils.sheet_to_csv(ws);
        blob = new Blob([csvOut], { type: 'text/csv;charset=utf-8' });
      } else {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([wbout], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }

      await uploadFileVersion(file.id, blob, file.name);
      setSaving(false);
      setSaveSuccess(true);
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save spreadsheet:', err);
      setSaving(false);
    }
  };

  const maxCols = data.length > 0 ? Math.max(...data.map((r) => r.length)) : 0;

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col text-slate-100 animate-fade-in">
      {/* Header */}
      <header className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold truncate max-w-sm text-slate-100" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Spreadsheet Grid Editor • <span className="uppercase text-emerald-400 font-bold">{ext}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Column
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-md ${
              saveSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-brand-600 hover:bg-brand-500 active:scale-95'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save (Ctrl+S)'}
          </button>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 overflow-auto p-6 bg-slate-950 flex items-start justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium">Parsing Spreadsheet Dataset...</p>
          </div>
        ) : (
          <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs font-mono text-slate-200">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <th className="p-2.5 w-10 text-center border-r border-slate-800 text-[10px] select-none">#</th>
                    {Array.from({ length: maxCols }).map((_, colIdx) => (
                      <th key={colIdx} className="p-2.5 border-r border-slate-800 font-semibold text-emerald-400 text-left min-w-[140px]">
                        <input
                          type="text"
                          value={data[0]?.[colIdx] || ''}
                          onChange={(e) => updateCell(0, colIdx, e.target.value)}
                          className="bg-transparent text-emerald-400 font-bold focus:outline-none w-full truncate"
                          placeholder={`Col ${colIdx + 1}`}
                        />
                      </th>
                    ))}
                    <th className="p-2.5 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx + 1} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                      <td className="p-2.5 text-center border-r border-slate-800 text-slate-500 text-[10px] select-none">
                        {rowIdx + 1}
                      </td>
                      {Array.from({ length: maxCols }).map((_, colIdx) => {
                        const cellValue = row[colIdx] || '';
                        return (
                          <td key={colIdx} className="p-1 border-r border-slate-800/60 min-w-[140px]">
                            <input
                              type="text"
                              value={cellValue}
                              onChange={(e) => updateCell(rowIdx + 1, colIdx, e.target.value)}
                              className="w-full bg-transparent border-none focus:outline-none focus:bg-slate-800 text-slate-100 rounded px-1.5 py-0.5"
                            />
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <button
                          onClick={() => deleteRow(rowIdx + 1)}
                          className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-8 px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
        <div>
          Total Rows: <span className="text-slate-200 font-bold">{data.length}</span> • Columns:{' '}
          <span className="text-slate-200 font-bold">{data[0]?.length || 0}</span>
        </div>
        <div>Status: {saving ? 'Saving changes...' : 'Grid Ready'}</div>
      </footer>
    </div>
  );
};
