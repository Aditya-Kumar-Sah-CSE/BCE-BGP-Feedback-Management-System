/**
 * Standard PDF Download Utility
 * Handles authenticated PDF downloads with content-type verification,
 * filename preservation from Content-Disposition, and memory cleanup.
 */

export interface DownloadPdfOptions {
  url: string;
  defaultFilename?: string;
  onError?: (error: Error | string) => void;
  onSuccess?: (filename: string) => void;
}

export interface DownloadPdfResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export async function downloadPdfFile(options: DownloadPdfOptions): Promise<DownloadPdfResult> {
  const { url, defaultFilename = 'download.pdf', onError, onSuccess } = options;

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/pdf, application/json, text/plain',
      },
    });

    if (!res.ok) {
      let errMsg = `PDF request failed with status ${res.status} (${res.statusText})`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errJson.message || errJson.detail || errMsg;
      } catch {
        const text = await res.text();
        if (text && text.length < 200) errMsg = text;
      }
      const error = new Error(errMsg);
      onError?.(error);
      return { success: false, error: errMsg };
    }

    const contentType = res.headers.get('content-type') || '';
    // Verify it is actually a PDF stream and not an HTML error or JSON payload
    if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
      let errorText = 'Unexpected response format received instead of PDF.';
      try {
        const json = await res.json();
        errorText = json.error || json.message || errorText;
      } catch {
        const text = await res.text();
        if (text && text.length < 200) errorText = text;
      }
      const error = new Error(errorText);
      onError?.(error);
      return { success: false, error: errorText };
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      const error = new Error('Received an empty PDF file.');
      onError?.(error);
      return { success: false, error: 'Empty file' };
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;

    // Parse filename from Content-Disposition header if provided by server
    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition) {
      // Handle standard filename="foo.pdf" and UTF-8 filename*=UTF-8''foo.pdf
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          filename = decodeURIComponent(utf8Match[1]);
        } catch {
          filename = utf8Match[1];
        }
      } else {
        const match = disposition.match(/filename="?([^";\n]+)"?/i);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke object URL after delay to release memory
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);

    onSuccess?.(filename);
    return { success: true, filename };
  } catch (err: any) {
    const message = err?.message || 'Network error occurred while downloading PDF.';
    onError?.(message);
    return { success: false, error: message };
  }
}
