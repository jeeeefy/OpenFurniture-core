import type { DesignDocument } from '@/domain';
import { exportDesignFile, exportFileName } from '@/persistence/fileFormat';

/** Downloads text through a short-lived Blob URL (plan §5.2). */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function downloadDesign(doc: DesignDocument): void {
  const { fileName, json } = exportDesignFile(doc, __APP_VERSION__, new Date().toISOString());
  downloadText(fileName, json);
}

/** Damaged records are exported unchanged so that nothing is lost. */
export function downloadRaw(name: string, raw: unknown): void {
  downloadText(exportFileName(`${name}-raw`), JSON.stringify(raw, null, 2));
}
