import { apiFetch } from '@/lib/api';

export type RequestStatus = 'RECEIVED' | 'SENT_TO_PRINT' | 'PRINTED';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  RECEIVED: 'Received',
  SENT_TO_PRINT: 'Sent to Print',
  PRINTED: 'Printed',
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status as RequestStatus] ?? status;
}

export type TextbookRequest = {
  requestId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  contactNumber: string;
  course: string;
  units: string;
  address: string;
  status: RequestStatus;
  trackingNumber: string | null;
  // Slot 1
  bookName1: string | null;
  hasFile: boolean;
  originalName: string | null;
  fileSize: number | null;
  // Slot 2
  bookName2: string | null;
  hasFile2: boolean;
  originalName2: string | null;
  fileSize2: number | null;
  // Slot 3
  bookName3: string | null;
  hasFile3: boolean;
  originalName3: string | null;
  fileSize3: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestEventType =
  | 'CREATED' | 'PDF_ATTACHED' | 'PDF_REMOVED' | 'SENT_TO_PRINT' | 'PRINTED' | 'REVERTED';

export type RequestEvent = {
  type: RequestEventType;
  detail: string | null;
  createdAt: string;
};

export const EVENT_LABELS: Record<RequestEventType, string> = {
  CREATED: 'Request created',
  PDF_ATTACHED: 'PDF attached',
  PDF_REMOVED: 'PDF removed',
  SENT_TO_PRINT: 'Sent to print',
  PRINTED: 'Printed',
  REVERTED: 'Reverted',
};

export function eventLabel(type: string) {
  return EVENT_LABELS[type as RequestEventType] ?? type;
}

export type RequestDetail = TextbookRequest & { events: RequestEvent[] };

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export type NewRequestInput = {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  course: string;
  units: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
};

const BASE = '/api/textbook-requests';

async function readError(res: Response, fallback: string) {
  try { const data = await res.json(); return data?.message || fallback; }
  catch { return fallback; }
}

function buildQuery(params: ListParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  return query.toString();
}

export async function fetchRequests(params: ListParams): Promise<{ requests: TextbookRequest[]; pagination: Pagination }> {
  const q = buildQuery(params);
  const res = await apiFetch(`${BASE}${q ? `?${q}` : ''}`);
  if (!res.ok) throw new Error(await readError(res, 'Unable to load requests.'));
  return res.json();
}

export async function fetchRequest(id: string): Promise<RequestDetail> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await readError(res, 'Unable to load the request.'));
  const data = await res.json();
  return data.request as RequestDetail;
}

export class DuplicateRequestError extends Error {}

export async function createRequest(input: NewRequestInput, force = false): Promise<TextbookRequest> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, force }) });
  if (res.status === 409) throw new DuplicateRequestError(await readError(res, 'A request from this email already exists.'));
  if (!res.ok) throw new Error(await readError(res, 'Could not create the request.'));
  const data = await res.json();
  return data.request as TextbookRequest;
}

export async function deleteRequest(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Could not delete the request.'));
}

export async function updateStatus(id: string, status: RequestStatus, trackingNumber?: string): Promise<TextbookRequest> {
  const res = await apiFetch(`${BASE}/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, trackingNumber }) });
  if (!res.ok) throw new Error(await readError(res, 'Could not update the status.'));
  const data = await res.json();
  return data.request as TextbookRequest;
}

export async function uploadPdf(id: string, pdf: File, slot: 1 | 2 | 3 = 1): Promise<TextbookRequest> {
  const body = new FormData();
  body.append('pdf', pdf);
  const res = await apiFetch(`${BASE}/${id}/pdf/${slot}`, { method: 'POST', body });
  if (!res.ok) throw new Error(await readError(res, 'Could not upload the PDF.'));
  const data = await res.json();
  return data.request as TextbookRequest;
}

export async function deletePdf(id: string, slot: 1 | 2 | 3 = 1): Promise<TextbookRequest> {
  const res = await apiFetch(`${BASE}/${id}/pdf/${slot}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Could not remove the PDF.'));
  const data = await res.json();
  return data.request as TextbookRequest;
}

export async function fetchPdf(id: string, slot: 1 | 2 | 3 = 1): Promise<Blob> {
  const res = await apiFetch(`${BASE}/${id}/pdf/${slot}`);
  if (!res.ok) throw new Error(await readError(res, 'Unable to load the PDF.'));
  return res.blob();
}

export async function updateBookNames(id: string, names: { bookName1?: string; bookName2?: string; bookName3?: string }): Promise<TextbookRequest> {
  const res = await apiFetch(`${BASE}/${id}/booknames`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(names) });
  if (!res.ok) throw new Error(await readError(res, 'Could not update book names.'));
  const data = await res.json();
  return data.request as TextbookRequest;
}

export async function fetchCsv(params: ListParams): Promise<Blob> {
  const q = buildQuery({ search: params.search, status: params.status });
  const res = await apiFetch(`${BASE}/export/csv${q ? `?${q}` : ''}`);
  if (!res.ok) throw new Error(await readError(res, 'Could not export CSV.'));
  return res.blob();
}
