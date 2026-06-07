'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import {
  FormOptions,
  createRequest,
  fetchFormOptions,
  fetchRequest,
  updateRequest,
} from '@/lib/textbooks';

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; requestId: string };

export default function TextbookRequestForm(props: Props) {
  const router = useRouter();
  const { session } = useSession();
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [form, setForm] = useState({ learnerId: '', textbookId: '' });
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = props.mode === 'edit';

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const loadedOptions = await fetchFormOptions();
        if (!active) return;
        setOptions(loadedOptions);

        if (props.mode === 'edit') {
          const request = await fetchRequest(props.requestId);
          if (!active) return;
          setForm({
            learnerId: request.learner.id,
            textbookId: request.textbook.id,
          });
          setCreatorName(request.creator.fullName);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load the form.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
    // props.mode / requestId are stable for a given mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In create mode the creator is the logged-in user (set server-side too).
  useEffect(() => {
    if (!isEdit && session) setCreatorName(session.fullName);
  }, [isEdit, session]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.learnerId) {
      setError('Please select a learner.');
      return;
    }
    if (!form.textbookId) {
      setError('Please select a textbook.');
      return;
    }

    setSaving(true);
    try {
      if (props.mode === 'edit') {
        await updateRequest(props.requestId, form);
        router.push(`/textbooks/${props.requestId}`);
      } else {
        const requestId = await createRequest(form);
        router.push(`/textbooks/${requestId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the request.');
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        Learner
        <select
          className="select"
          value={form.learnerId}
          onChange={(event) => updateField('learnerId', event.target.value)}
          required
        >
          <option value="">Select Learner</option>
          {options?.learners.map((learner) => (
            <option key={learner.id} value={learner.id}>
              {learner.fullName}
            </option>
          ))}
        </select>
      </label>

      <label>
        Textbook Name
        <select
          className="select"
          value={form.textbookId}
          onChange={(event) => updateField('textbookId', event.target.value)}
          required
        >
          <option value="">Select Textbook</option>
          {options?.textbooks.map((textbook) => (
            <option key={textbook.id} value={textbook.id}>
              {textbook.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Author / Creator
        <input className="input" type="text" value={creatorName} readOnly />
      </label>

      {error ? <div className="alert">{error}</div> : null}

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Request'}
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
