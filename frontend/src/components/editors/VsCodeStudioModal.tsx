import React, { useEffect, useState, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useDrive, FileItem, FolderItem } from '../../context/DriveContext';
import { getFileRawUrl, uploadFileVersion } from '../../services/api';
import { getFileExtension, getMonacoLanguage } from '../../utils/fileTypes';
import {
  X,
  Save,
  Code2,
  Check,
  Sidebar,
  FileCode,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Settings,
  Plus,
} from 'lucide-react';

interface VsCodeStudioModalProps {
  file: FileItem;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const VsCodeStudioModal: React.FC<VsCodeStudioModalProps> = ({
  file: initialFile,
  onClose,
  onSaveSuccess,
}) => {
  const { files: driveFiles, folders: driveFolders } = useDrive();

  // Multi-tab state
  const [openTabs, setOpenTabs] = useState<FileItem[]>([initialFile]);
  const [activeFileId, setActiveFileId] = useState<string>(initialFile.id);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [unsavedMap, setUnsavedMap] = useState<Record<string, boolean>>({});
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, boolean>>({});

  // Sidebar tree state
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});

  const editorRef = useRef<any>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const activeFile = openTabs.find((t) => t.id === activeFileId) || initialFile;
  const activeContent = tabContents[activeFile.id] ?? '';
  const isLoading = loadingMap[activeFile.id] ?? false;
  const hasUnsavedChanges = unsavedMap[activeFile.id] ?? false;
  const language = getMonacoLanguage(activeFile.name);

  // Load content for active file if not cached
  useEffect(() => {
    if (activeFile.id && tabContents[activeFile.id] === undefined && !loadingMap[activeFile.id]) {
      setLoadingMap((prev) => ({ ...prev, [activeFile.id]: true }));
      fetch(getFileRawUrl(activeFile.id))
        .then((res) => res.text())
        .then((text) => {
          setTabContents((prev) => ({ ...prev, [activeFile.id]: text }));
          setLoadingMap((prev) => ({ ...prev, [activeFile.id]: false }));
        })
        .catch(() => {
          setTabContents((prev) => ({ ...prev, [activeFile.id]: '// Failed to load file' }));
          setLoadingMap((prev) => ({ ...prev, [activeFile.id]: false }));
        });
    }
  }, [activeFile.id]);

  const openFileInTab = (targetFile: FileItem) => {
    if (!openTabs.some((t) => t.id === targetFile.id)) {
      setOpenTabs([...openTabs, targetFile]);
    }
    setActiveFileId(targetFile.id);
  };

  const closeTab = (fileIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t.id !== fileIdToClose);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setOpenTabs(remaining);
    if (activeFileId === fileIdToClose) {
      setActiveFileId(remaining[remaining.length - 1].id);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveActiveFile();
    });
  };

  const handleContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setTabContents((prev) => ({ ...prev, [activeFile.id]: value }));
      setUnsavedMap((prev) => ({ ...prev, [activeFile.id]: true }));
    }
  };

  const handleSaveActiveFile = async () => {
    try {
      const contentToSave = tabContents[activeFile.id] || '';
      const blob = new Blob([contentToSave], { type: 'text/plain;charset=utf-8' });
      await uploadFileVersion(activeFile.id, blob, activeFile.name);
      setUnsavedMap((prev) => ({ ...prev, [activeFile.id]: false }));
      setSaveSuccessMap((prev) => ({ ...prev, [activeFile.id]: true }));
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => {
        setSaveSuccessMap((prev) => ({ ...prev, [activeFile.id]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolderIds((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Helper to render folder tree in Explorer sidebar
  const renderFolderTree = (parentFolderId: string | null = null, depth = 0) => {
    const childFolders = driveFolders.filter((f) => f.parentFolderId === parentFolderId);
    const childFiles = driveFiles.filter((f) => (f as any).folderId === parentFolderId || (parentFolderId === null && !(f as any).folderId));

    return (
      <div className="space-y-0.5">
        {childFolders.map((folder) => {
          const isExpanded = expandedFolderIds[folder.id];
          return (
            <div key={folder.id} style={{ paddingLeft: `${depth * 12}px` }}>
              <button
                onClick={() => toggleFolderExpand(folder.id)}
                className="w-full flex items-center gap-1 px-2 py-1 hover:bg-[#2a2d2e] rounded text-slate-300 hover:text-white transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-brand-400 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-brand-400 shrink-0" />
                )}
                <span className="truncate font-medium">{folder.name}</span>
              </button>
              {isExpanded && renderFolderTree(folder.id, depth + 1)}
            </div>
          );
        })}

        {childFiles.map((f) => {
          const isActive = f.id === activeFile.id;
          return (
            <button
              key={f.id}
              onClick={() => openFileInTab(f)}
              style={{ paddingLeft: `${depth * 12 + 16}px` }}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors font-mono text-[11px] truncate ${
                isActive
                  ? 'bg-[#37373d] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#2a2d2e]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1e1e1e] flex flex-col text-slate-200 select-none animate-fade-in font-sans">
      {/* VS Code Title Bar */}
      <header className="h-9 px-3 bg-[#323233] border-b border-[#252526] flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-bold font-mono text-[11px]">
            <Code2 className="w-3.5 h-3.5" /> VS Code Studio
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            {activeFile.name} {hasUnsavedChanges && '• (Unsaved)'}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveActiveFile}
            className={`flex items-center gap-1 px-3 py-0.5 rounded text-[11px] font-medium text-white transition-all ${
              saveSuccessMap[activeFile.id]
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {saveSuccessMap[activeFile.id] ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saveSuccessMap[activeFile.id] ? 'Saved!' : 'Save (Ctrl+S)'}
          </button>

          <button onClick={onClose} className="p-1 hover:bg-[#464647] rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Activity Bar */}
        <div className="w-12 bg-[#333333] border-r border-[#252526] flex flex-col items-center py-2 space-y-4 shrink-0 text-slate-400">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded hover:text-white ${showSidebar ? 'text-white border-l-2 border-blue-500' : ''}`}
            title="Explorer"
          >
            <Sidebar className="w-5 h-5" />
          </button>
          <button className="p-2 hover:text-white" title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Full Directory Explorer Sidebar */}
        {showSidebar && (
          <aside className="w-64 bg-[#252526] border-r border-[#1e1e1e] flex flex-col shrink-0 text-xs overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#1e1e1e] flex items-center justify-between">
              <span>EXPLORER: PROJECT TREE</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {renderFolderTree(null)}
            </div>
          </aside>
        )}

        {/* Editor & Multi-Tab View */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* Multi-Tab Bar */}
          <div className="h-9 bg-[#252526] flex items-center border-b border-[#1e1e1e] px-1 text-xs overflow-x-auto">
            {openTabs.map((tab) => {
              const isActive = tab.id === activeFileId;
              const isTabUnsaved = unsavedMap[tab.id];
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveFileId(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 border-t-2 font-mono text-[11px] cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#1e1e1e] text-slate-100 border-blue-500 font-semibold'
                      : 'bg-[#2d2d2d] text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate max-w-[120px]">{tab.name}</span>
                  {isTabUnsaved && <span className="w-2 h-2 rounded-full bg-blue-400 ml-0.5" />}
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Monaco Editor Engine */}
          <div className="flex-1 relative">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-mono">Loading file in Monaco Engine...</p>
              </div>
            ) : (
              <Editor
                height="100%"
                language={language}
                value={activeContent}
                theme="vs-dark"
                onChange={handleContentChange}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 13,
                  fontFamily: 'Fira Code, Consolas, Monaco, monospace',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  padding: { top: 12 },
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* VS Code Status Bar */}
      <footer className="h-6 px-3 bg-[#007acc] text-white flex items-center justify-between text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 font-semibold">
            <Code2 className="w-3 h-3" /> VS Code Mode
          </span>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>LF</span>
          <span className="capitalize font-bold">{language}</span>
          <span>{hasUnsavedChanges ? 'Unsaved' : 'Saved'}</span>
        </div>
      </footer>
    </div>
  );
};
