'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTextbook } from '@/lib/textbooks';
import { generatePdfCover } from '@/lib/pdfCover';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddTextbookForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textbookName, setTextbookName] = useState('');
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function selectFile(candidate: File | undefined) {
    setError('');
    if (!candidate) return;
    if (candidate.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }
    setFile(candidate);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!textbookName.trim()) {
      setError('Please enter a textbook name.');
      return;
    }
    if (!file) {
      setError('Please attach a PDF file.');
      return;
    }

    setSaving(true);
    try {
      // Render a small first-page thumbnail in the browser so the catalog can
      // show lightweight covers. Best-effort — upload proceeds even if it fails.
      const cover = await generatePdfCover(file);
      const created = await createTextbook({
        textbookName: textbookName.trim(),
        subject: subject.trim() || undefined,
        pdf: file,
        cover,
      });
      setSuccess(`"${created.textbookName}" was added to the catalog.`);
      setTextbookName('');
      setSubject('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the textbook.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        Textbook Name
        <input
          className="input"
          type="text"
          value={textbookName}
          onChange={(event) => setTextbookName(event.target.value)}
          placeholder="e.g. Introduction to Algorithms"
          required
        />
      </label>

      <label>
        Subject <span className="field-optional">(optional)</span>
        <input
          className="input"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="e.g. Computer Science"
        />
      </label>

      <div>
        <span className="field-label">Textbook PDF</span>
        <div
          className={`dropzone${dragOver ? ' dropzone-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="dropzone-input"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          {file ? (
            <div className="dropzone-file">
              <span className="dropzone-file-name">📄 {file.name}</span>
              <span className="dropzone-file-size">{formatSize(file.size)}</span>
              <button
                type="button"
                className="btn secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <strong>Drag &amp; drop</strong> a PDF here, or{' '}
              <span className="dropzone-browse">browse</span>
              <small>PDF only</small>
            </div>
          )}
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Uploading...' : 'Add Textbook'}
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => router.push('/textbooks')}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
