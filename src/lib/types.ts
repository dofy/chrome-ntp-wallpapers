export interface LocalImage {
  id: string
  collection_id: string
  collection_name: string
  title: string
  artist: string
  file: string
  thumb: string
  bytes: number
  width: number | null
  height: number | null
  source_url: string
  note: string
  mtime: number
}

export interface Library {
  images: LocalImage[]
  total_bytes: number
  collections: string[]
  artists: string[]
}

export interface RemoteCollection {
  id: string
  name: string
  preview_url: string
  downloaded: number
}

export interface Job {
  id: string
  collection_id: string
  collection_name: string
  size: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  total: number
  done: number
  skipped: number
  failed: number
  current: string
  error: string
  log: string[]
  started_at: number
  finished_at: number | null
}

export type SortKey = 'collection' | 'title' | 'artist' | 'bytes' | 'recent'
