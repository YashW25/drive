import React from 'react';
import { FileItem } from '../../context/DriveContext';
import { getFileCategory, isCodeFile } from '../../utils/fileTypes';
import { DocumentEditorModal } from './DocumentEditorModal';
import { SpreadsheetEditorModal } from './SpreadsheetEditorModal';
import { PresentationEditorModal } from './PresentationEditorModal';
import { VsCodeStudioModal } from './VsCodeStudioModal';

interface UniversalEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaveSuccess?: () => void;
  forceVsCode?: boolean;
}

export const UniversalEditorModal: React.FC<UniversalEditorModalProps> = ({
  file,
  onClose,
  onSaveSuccess,
  forceVsCode = false,
}) => {
  const category = getFileCategory(file.name, file.mimeType);

  if (forceVsCode || isCodeFile(file.name) || category === 'code' || category === 'web') {
    return <VsCodeStudioModal file={file} onClose={onClose} onSaveSuccess={onSaveSuccess} />;
  }

  switch (category) {
    case 'spreadsheet':
    case 'csv':
      return <SpreadsheetEditorModal file={file} onClose={onClose} onSaveSuccess={onSaveSuccess} />;
    case 'presentation':
      return <PresentationEditorModal file={file} onClose={onClose} onSaveSuccess={onSaveSuccess} />;
    case 'docx':
    case 'legacy_doc':
    case 'text':
    default:
      return <DocumentEditorModal file={file} onClose={onClose} onSaveSuccess={onSaveSuccess} />;
  }
};
