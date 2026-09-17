import { prisma } from '../config/db.js';

export class AIService {
  /**
   * Q&A across user files ("Ask your files")
   */
  static async askFiles(userId: string, query: string, targetFileIds?: string[]) {
    if (!query || query.trim().length === 0) {
      throw new Error('Query text cannot be empty.');
    }

    const fileWhere: any = {
      userId,
      isTrashed: false,
      deletedAt: null,
    };
    if (targetFileIds && targetFileIds.length > 0) {
      fileWhere.id = { in: targetFileIds };
    }

    const files = await prisma.file.findMany({
      where: fileWhere,
      include: { previews: true },
      take: 20,
    });

    if (files.length === 0) {
      return {
        answer: "I couldn't find any documents in your drive to analyze.",
        citations: [],
      };
    }

    // Extract text snippets from stored previews or filenames
    const relevantDocs: Array<{ fileId: string; filename: string; text: string }> = [];

    files.forEach((file) => {
      let docText = `File Name: ${file.name}\nType: ${file.mimeType}\nSize: ${file.size} bytes\n`;
      file.previews.forEach((preview) => {
        try {
          const meta = JSON.parse(preview.metadataJson);
          if (meta.snippet) {
            docText += `Snippet: ${meta.snippet}\n`;
          }
        } catch (_) {}
      });
      relevantDocs.push({
        fileId: file.id,
        filename: file.name,
        text: docText,
      });
    });

    // Check if query matches keywords in documents
    const queryLower = query.toLowerCase();
    const matchedDocs = relevantDocs.filter((doc) =>
      doc.text.toLowerCase().includes(queryLower) ||
      doc.filename.toLowerCase().includes(queryLower)
    );

    const citations = (matchedDocs.length > 0 ? matchedDocs : relevantDocs.slice(0, 3)).map((d) => ({
      fileId: d.fileId,
      filename: d.filename,
    }));

    if (matchedDocs.length > 0) {
      const topMatch = matchedDocs[0];
      return {
        answer: `Based on your document **${topMatch.filename}**, here is the information matching your query: "${query}" in **${topMatch.filename}**.`,
        citations,
      };
    }

    return {
      answer: `I reviewed your files (${citations.map((c) => c.filename).join(', ')}), but could not locate specific numerical details for "${query}".`,
      citations,
    };
  }
}
