import { apiFetch } from '@/lib/api';

export type TextbookStatus =
  | 'CREATED'
  | 'REQUESTED_BY_LEARNER'
  | 'SHARED_WITH_MANAGER'
  | 'SENT_TO_PRINT'
  | 'PRINTED';

// Human-readable labels for the status enum used across the module.
export const STATUS_LABELS: Record<TextbookStatus, string> = {
  CREATED: 'Created',
  REQUESTED_BY_LEARNER: 'Requested by Learner',
  SHARED_WITH_MANAGER: 'Shared with Manager',
  SENT_TO_PRINT: 'Sent to Print',
  PRINTED: 'Printed',
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status as TextbookStatus] ?? status;
}

export type NamedRef = { id: string; fullName: string };
export type TextbookRef = { id: string; name: string };

export type RequestSummary = {
  requestId: string;
  learner: NamedRef;
  textbook: TextbookRef;
  creator: NamedRef;
  currentStatus: TextbookStatus;
  createdAt: string;
  updatedAt: string;
};

export type StatusHistoryEntry = {
  status: TextbookStatus;
  changedAt: string;
  changedBy: string;
};

export type RequestDetail = RequestSummary & {
  statusHistory: StatusHistoryEntry[];
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FormOptions = {
  learners: NamedRef[];
  textbooks: TextbookRef[];
  statuses: TextbookStatus[];
};

export type ListParams = {
  page?: number;
  search?: string;
  status?: string;
  learnerId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type RequestInput = {
  learnerId: string;
  textbookId: string;
};

// Throws with the backend message so callers can surface a useful error.
async function readError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

// A textbook in the catalog, as returned by GET /api/textbooks.
export type CatalogTextbook = {
  id: string;
  textbookName: string;
  subject: string | null;
  hasFile: boolean;
  hasCover: boolean;
  originalName: string | null;
  fileSize: number | null;
  createdAt: string;
};

export async function fetchTextbooks(): Promise<CatalogTextbook[]> {
  const res = await apiFetch('/api/textbooks');
  if (!res.ok) throw new Error(await readError(res, 'Unable to load textbooks.'));
  const data = await res.json();
  return data.textbooks as CatalogTextbook[];
}

// Fetches the stored PDF and returns it as a Blob. We go through the frontend's
// own same-origin proxy route (/api/textbook-file/:id) instead of hitting the
// backend (:4000) directly: a cross-origin binary download from the browser was
// being reset (ERR_CONNECTION_RESET) by local security software. The proxy
// fetches the file server-side and streams it back from the same origin.
export async function fetchTextbookFile(id: string): Promise<Blob> {
  const res = await fetch(`/api/textbook-file/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await readError(res, 'Unable to load the PDF.'));
  return res.blob();
}

export type NewTextbookInput = {
  textbookName: string;
  subject?: string;
  pdf: File;
  // Optional pre-rendered first-page thumbnail (generated in the browser).
  cover?: Blob | null;
};

export type CreatedTextbook = {
  id: string;
  textbookName: string;
  subject: string | null;
  createdAt: string;
};

// Uploads a textbook + PDF as multipart/form-data. The browser sets the
// Content-Type (with boundary) automatically, so we must not set it ourselves.
export async function createTextbook(input: NewTextbookInput): Promise<CreatedTextbook> {
  const body = new FormData();
  body.append('textbookName', input.textbookName);
  if (input.subject) body.append('subject', input.subject);
  body.append('pdf', input.pdf);
  if (input.cover) body.append('cover', input.cover, 'cover.jpg');

  const res = await apiFetch('/api/textbooks', { method: 'POST', body });
  if (!res.ok) throw new Error(await readError(res, 'Could not add the textbook.'));
  const data = await res.json();
  return data.textbook as CreatedTextbook;
}

export async function deleteTextbook(id: string): Promise<void> {
  const res = await apiFetch(`/api/textbooks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Could not delete the textbook.'));
}

export async function fetchFormOptions(): Promise<FormOptions> {
  const res = await apiFetch('/api/textbook-requests/options');
  if (!res.ok) throw new Error(await readError(res, 'Unable to load form options.'));
  return res.json();
}

export async function fetchRequests(
  params: ListParams
): Promise<{ requests: RequestSummary[]; pagination: Pagination }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.learnerId) query.set('learnerId', params.learnerId);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/textbook-requests${suffix}`);
  if (!res.ok) throw new Error(await readError(res, 'Unable to load textbook requests.'));
  return res.json();
}

export async function fetchRequest(id: string): Promise<RequestDetail> {
  const res = await apiFetch(`/api/textbook-requests/${id}`);
  if (!res.ok) throw new Error(await readError(res, 'Unable to load textbook request.'));
  const data = await res.json();
  return data.request as RequestDetail;
}

export async function createRequest(input: RequestInput): Promise<string> {
  const res = await apiFetch('/api/textbook-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not create textbook request.'));
  const data = await res.json();
  return data.requestId as string;
}

export async function updateRequest(id: string, input: RequestInput): Promise<void> {
  const res = await apiFetch(`/api/textbook-requests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not update textbook request.'));
}

export async function deleteRequest(id: string): Promise<void> {
  const res = await apiFetch(`/api/textbook-requests/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Could not delete textbook request.'));
}
