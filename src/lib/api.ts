import type { Job, Library, RemoteCollection } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(detail.error ?? `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  library: () => request<Library>('/api/library'),
  collections: (refresh = false) =>
    request<RemoteCollection[]>(`/api/collections${refresh ? '?refresh=1' : ''}`),
  jobs: () => request<{ jobs: Job[]; active: boolean }>('/api/jobs'),
  fetchCollection: (collection_id: string, size: string) =>
    request<Job>('/api/fetch', {
      method: 'POST',
      body: JSON.stringify({ collection_id, size }),
    }),
  cancelJob: (id: string) =>
    request<{ cancelled: boolean }>('/api/jobs/cancel', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  reindex: () => request<{ filled: number }>('/api/reindex', { method: 'POST', body: '{}' }),
}
