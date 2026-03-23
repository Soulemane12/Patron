interface SplitOptions {
  maxChunkSize?: number; // Maximum characters per chunk
  maxRowsPerChunk?: number; // Maximum rows per chunk
  preserveHeaders?: boolean; // Whether to include headers in each chunk
}

interface BatchChunk {
  id: string;
  data: string;
  chunkIndex: number;
  totalChunks: number;
  rowCount: number;
  hasHeaders: boolean;
}

interface SplitResult {
  chunks: BatchChunk[];
  metadata: {
    originalSize: number;
    totalRows: number;
    splitReason: 'size' | 'rows' | 'both';
    headers?: string;
  };
}

export class BatchSplitter {
  private static readonly DEFAULT_MAX_CHUNK_SIZE = 50000; // 50KB per chunk
  private static readonly DEFAULT_MAX_ROWS_PER_CHUNK = 100; // 100 rows per chunk

  static shouldSplit(data: string, options?: SplitOptions): boolean {
    const maxChunkSize = options?.maxChunkSize || this.DEFAULT_MAX_CHUNK_SIZE;
    const maxRowsPerChunk = options?.maxRowsPerChunk || this.DEFAULT_MAX_ROWS_PER_CHUNK;

    const lines = data.split('\n').filter(line => line.trim());

    return data.length > maxChunkSize || lines.length > maxRowsPerChunk;
  }

  static split(data: string, options: SplitOptions = {}): SplitResult {
    const maxChunkSize = options.maxChunkSize || this.DEFAULT_MAX_CHUNK_SIZE;
    const maxRowsPerChunk = options.maxRowsPerChunk || this.DEFAULT_MAX_ROWS_PER_CHUNK;
    const preserveHeaders = options.preserveHeaders ?? true;

    const lines = data.split('\n').filter(line => line.trim());
    const originalSize = data.length;

    // Detect if first line contains headers
    const firstLine = lines[0] || '';
    const hasHeaders = this.detectHeaders(firstLine);
    const headers = hasHeaders ? firstLine : '';

    // Start from data rows (skip headers if present)
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    const chunks: BatchChunk[] = [];

    let currentChunk: string[] = [];
    let currentChunkSize = 0;
    let chunkIndex = 0;

    // Add headers to first chunk if preserving headers
    if (hasHeaders && preserveHeaders) {
      currentChunk.push(headers);
      currentChunkSize = headers.length;
    }

    for (const line of dataLines) {
      const lineSize = line.length + 1; // +1 for newline

      // Check if adding this line would exceed limits
      const wouldExceedSize = currentChunkSize + lineSize > maxChunkSize;
      const wouldExceedRows = currentChunk.length >= maxRowsPerChunk + (hasHeaders && preserveHeaders ? 1 : 0);

      if ((wouldExceedSize || wouldExceedRows) && currentChunk.length > (hasHeaders && preserveHeaders ? 1 : 0)) {
        // Save current chunk
        chunks.push({
          id: `chunk_${chunkIndex}`,
          data: currentChunk.join('\n'),
          chunkIndex,
          totalChunks: 0, // Will be set later
          rowCount: currentChunk.length - (hasHeaders && preserveHeaders ? 1 : 0),
          hasHeaders: hasHeaders && preserveHeaders
        });

        // Start new chunk
        chunkIndex++;
        currentChunk = [];
        currentChunkSize = 0;

        // Add headers to new chunk if preserving headers
        if (hasHeaders && preserveHeaders) {
          currentChunk.push(headers);
          currentChunkSize = headers.length;
        }
      }

      // Add line to current chunk
      currentChunk.push(line);
      currentChunkSize += lineSize;
    }

    // Add final chunk if it has content
    if (currentChunk.length > (hasHeaders && preserveHeaders ? 1 : 0)) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        data: currentChunk.join('\n'),
        chunkIndex,
        totalChunks: 0, // Will be set later
        rowCount: currentChunk.length - (hasHeaders && preserveHeaders ? 1 : 0),
        hasHeaders: hasHeaders && preserveHeaders
      });
    }

    // Update totalChunks for all chunks
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length;
    });

    // Determine split reason
    let splitReason: 'size' | 'rows' | 'both' = 'size';
    if (originalSize > maxChunkSize && lines.length > maxRowsPerChunk) {
      splitReason = 'both';
    } else if (lines.length > maxRowsPerChunk) {
      splitReason = 'rows';
    }

    return {
      chunks,
      metadata: {
        originalSize,
        totalRows: dataLines.length,
        splitReason,
        headers: hasHeaders ? headers : undefined
      }
    };
  }

  static combine(chunks: BatchChunk[], preserveHeaders: boolean = true): string {
    if (chunks.length === 0) return '';

    // Sort chunks by index to ensure correct order
    const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

    let combinedData: string[] = [];

    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const lines = chunk.data.split('\n').filter(line => line.trim());

      if (i === 0) {
        // First chunk: include all lines
        combinedData.push(...lines);
      } else {
        // Subsequent chunks: skip headers if they exist and we're preserving them
        const linesToAdd = chunk.hasHeaders && preserveHeaders ? lines.slice(1) : lines;
        combinedData.push(...linesToAdd);
      }
    }

    return combinedData.join('\n');
  }

  private static detectHeaders(firstLine: string): boolean {
    // Check for common header patterns
    const headerPatterns = [
      /rep\s*id/i,
      /street\s*address/i,
      /installation\s*date/i,
      /fiber\s*plan/i,
      /order\s*date/i,
      /customer\s*name/i,
      /email/i,
      /phone/i
    ];

    return headerPatterns.some(pattern => pattern.test(firstLine));
  }

  static getChunkInfo(data: string): { shouldSplit: boolean; estimatedChunks: number; reason: string } {
    const lines = data.split('\n').filter(line => line.trim());
    const size = data.length;

    const sizeChunks = Math.ceil(size / this.DEFAULT_MAX_CHUNK_SIZE);
    const rowChunks = Math.ceil(lines.length / this.DEFAULT_MAX_ROWS_PER_CHUNK);
    const estimatedChunks = Math.max(sizeChunks, rowChunks);

    let reason = '';
    if (size > this.DEFAULT_MAX_CHUNK_SIZE) {
      reason += `Data size (${Math.round(size / 1000)}KB) exceeds limit (${Math.round(this.DEFAULT_MAX_CHUNK_SIZE / 1000)}KB). `;
    }
    if (lines.length > this.DEFAULT_MAX_ROWS_PER_CHUNK) {
      reason += `Row count (${lines.length}) exceeds limit (${this.DEFAULT_MAX_ROWS_PER_CHUNK}).`;
    }

    return {
      shouldSplit: estimatedChunks > 1,
      estimatedChunks,
      reason: reason.trim() || 'Data is within limits'
    };
  }
}