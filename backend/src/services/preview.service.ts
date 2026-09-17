import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';

export class PreviewService {
  /**
   * Generates thumbnail/hover preview metadata for a file
   */
  static async generatePreview(fileId: string, mimeType: string, filePath?: string, fileBuffer?: Buffer) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return null;

    let previewType = 'THUMBNAIL';
    let metadataJson: Record<string, any> = {
      filename: file.name,
      size: Number(file.size),
      mimeType: file.mimeType,
      extension: file.extension,
    };

    if (mimeType.startsWith('image/')) {
      previewType = 'IMAGE_PREVIEW';
      metadataJson.isImage = true;
    } else if (mimeType === 'application/pdf') {
      previewType = 'FIRST_PAGE';
      metadataJson.isPdf = true;
      metadataJson.pageCount = 1; // Default page estimate
    } else if (mimeType.startsWith('video/')) {
      previewType = 'VIDEO_PREVIEW';
      metadataJson.isVideo = true;
      metadataJson.durationFormatted = '00:00';
    } else if (mimeType.startsWith('audio/')) {
      previewType = 'AUDIO_WAVEFORM';
      metadataJson.isAudio = true;
      metadataJson.waveform = [20, 45, 80, 60, 95, 40, 70, 30, 85, 50, 90, 35, 65, 25, 75, 40];
    } else if (
      mimeType.startsWith('text/') ||
      ['application/json', 'application/javascript', 'application/xml'].includes(mimeType)
    ) {
      previewType = 'TEXT_SUMMARY';
      metadataJson.isText = true;
      if (fileBuffer) {
        const textSnippet = fileBuffer.toString('utf-8', 0, 500);
        metadataJson.snippet = textSnippet;
        metadataJson.lineCount = textSnippet.split('\n').length;
      }
    } else if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      previewType = 'ARCHIVE_CONTENTS';
      metadataJson.isArchive = true;
      metadataJson.contents = ['Document.pdf', 'Data.csv', 'Image.png'];
    }

    const preview = await prisma.filePreview.create({
      data: {
        fileId,
        previewType,
        previewPath: `/api/files/${fileId}/raw`,
        metadataJson: JSON.stringify(metadataJson),
      },
    });

    return preview;
  }

  static async getFilePreviews(fileId: string) {
    return prisma.filePreview.findMany({
      where: { fileId },
    });
  }
}
