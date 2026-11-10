import type { JobIn, JobOut } from './packWorker';

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadText(name: string, text: string, type = 'text/plain'): void { downloadBlob(name, new Blob([text], { type })); }

export async function downloadZip(name: string, files: { name: string; content: string }[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.content);
  downloadBlob(name, await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('The browser does not allow copying here'));
}

export const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'file';

type JobRequest = JobIn extends infer J ? (J extends { id: number } ? Omit<J, 'id'> : never) : never;
export type JobProgress = { done: number; total: number; stage: 'read' | 'convert' | 'zip' };
export type JobResult = Extract<JobOut, { kind: 'done' }>;

let seq = 0;
export function runJob(req: JobRequest, onProgress?: (p: JobProgress) => void): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./packWorker.ts', import.meta.url), { type: 'module' });
    const id = ++seq;
    w.onmessage = (ev: MessageEvent<JobOut>) => {
      const m = ev.data;
      if (m.id !== id) return;
      if (m.kind === 'progress') onProgress?.(m);
      else if (m.kind === 'done') { w.terminate(); resolve(m); }
      else { w.terminate(); reject(new Error(m.error)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'The converter stopped')); };
    w.postMessage({ ...req, id } as JobIn);
  });
}
