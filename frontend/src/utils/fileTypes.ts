export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'docx'
  | 'legacy_doc'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'code'
  | 'archive'
  | 'web'
  | 'msg'
  | 'csv'
  | 'binary';

export interface FileTypeInfo {
  category: FileCategory;
  label: string;
  color: string;
  iconName: string;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()!.toLowerCase();
}

export function isEditableFile(filename: string, mimeType: string = ''): boolean {
  const ext = getFileExtension(filename);
  const editableExtensions = [
    // Text & Docs
    'txt', 'md', 'markdown', 'rtf', 'docx', 'doc', 'odt', 'pages',
    // Spreadsheets
    'csv', 'xlsx', 'xls', 'ods',
    // Presentations
    'pptx', 'ppt', 'odp', 'key',
    // Web & Markup
    'html', 'htm', 'xml', 'xhtml', 'asp', 'aspx', 'css', 'scss', 'less', 'rss', 'json', 'yaml', 'yml',
    // Programming Code
    'c', 'cpp', 'h', 'hpp', 'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'cs', 'swift', 'pl', 'sh', 'bat', 'sql', 'php', 'rb', 'go', 'rs', 'kt', 'vue', 'env', 'config', 'yml', 'yaml'
  ];
  return editableExtensions.includes(ext) || filename.endsWith('.d.ts') || mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml');
}

export function isCodeFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  const codeExtensions = [
    'c', 'cpp', 'h', 'hpp', 'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'cs', 'swift', 'pl', 'sh', 'bat',
    'sql', 'php', 'rb', 'go', 'rs', 'kt', 'html', 'htm', 'css', 'scss', 'less', 'xml', 'json', 'yaml', 'yml', 'vue', 'md', 'markdown', 'env', 'config'
  ];
  return codeExtensions.includes(ext) || filename.endsWith('.d.ts') || filename.startsWith('.');
}

export function getFileCategory(filename: string, mimeType: string = ''): FileCategory {
  const ext = getFileExtension(filename);
  const mime = mimeType.toLowerCase();

  // 1. Program / Code Files & Dotfiles (CHECK BEFORE VIDEO / MIME TYPE CHECKS)
  const codeExts = [
    'c', 'cpp', 'h', 'hpp', 'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'cs', 'swift', 'pl', 'sh', 'bat',
    'json', 'xml', 'sql', 'php', 'rb', 'go', 'rs', 'kt', 'yaml', 'yml', 'vue', 'scss', 'less', 'env', 'config', 'gitignore', 'dockerfile'
  ];
  if (codeExts.includes(ext) || filename.endsWith('.d.ts') || filename.startsWith('.')) {
    return 'code';
  }

  // 2. PDF
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';

  // 3. Images
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'eps'];
  if (imageExts.includes(ext) || mime.startsWith('image/')) return 'image';

  // 4. Audio
  const audioExts = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'wma', 'snd', 'ra', 'au', 'm4a'];
  if (audioExts.includes(ext) || mime.startsWith('audio/')) return 'audio';

  // 5. Video (Exclude .ts and .tsx from video MIME checks!)
  const videoExts = ['mp4', 'webm', 'mov', '3gp', 'avi', 'mpg', 'mpeg', 'wmv', 'mkv'];
  if (videoExts.includes(ext) || (mime.startsWith('video/') && ext !== 'ts' && ext !== 'tsx' && !filename.endsWith('.d.ts'))) {
    return 'video';
  }

  // 6. DOCX / Text Documents
  if (['docx', 'doc', 'odt', 'pages', 'rtf'].includes(ext)) return 'docx';

  // Spreadsheets
  if (['xlsx', 'xls', 'ods'].includes(ext)) return 'spreadsheet';
  if (ext === 'csv' || mime.includes('csv')) return 'csv';

  // Presentations
  if (['pptx', 'ppt', 'odp', 'key'].includes(ext)) return 'presentation';

  // MSG (Outlook email)
  if (ext === 'msg') return 'msg';

  // 7. Archives
  const archiveExts = ['zip', 'rar', 'tar', 'gz', 'z', '7z', 'hqx', 'arj', 'arc', 'sit', 'bz2', 'xz'];
  if (archiveExts.includes(ext) || mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return 'archive';

  // 8. Web Pages
  const webExts = ['html', 'htm', 'xhtml', 'asp', 'aspx', 'css', 'rss'];
  if (webExts.includes(ext)) return 'web';

  // Executables / Data / Binaries
  if (['exe', 'com', 'dta', 'dll', 'so', 'bin', 'iso'].includes(ext)) return 'binary';

  // Plain Text / Markdown
  if (['txt', 'md', 'markdown'].includes(ext) || mime.startsWith('text/')) return 'text';

  return 'text';
}

export function getMonacoLanguage(filename: string): string {
  const ext = getFileExtension(filename);
  if (filename.endsWith('.d.ts') || ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'js' || ext === 'jsx') return 'javascript';

  switch (ext) {
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    case 'sql':
      return 'sql';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'sh':
      return 'shell';
    case 'bat':
      return 'bat';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

export function getPrismLanguage(filename: string): string {
  const ext = getFileExtension(filename);
  if (filename.endsWith('.d.ts') || ext === 'ts' || ext === 'tsx') return 'typescript';

  switch (ext) {
    case 'c':
    case 'cpp':
      return 'cpp';
    case 'java':
      return 'java';
    case 'py':
      return 'python';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'cs':
      return 'csharp';
    case 'swift':
      return 'swift';
    case 'pl':
      return 'perl';
    case 'sh':
      return 'bash';
    case 'bat':
      return 'batch';
    case 'html':
    case 'htm':
    case 'xhtml':
    case 'asp':
    case 'aspx':
      return 'markup';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'xml':
    case 'rss':
      return 'xml';
    case 'sql':
      return 'sql';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    default:
      return 'clike';
  }
}
