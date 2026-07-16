import type {
  Action,
  Feed,
  FeedCheckLog,
  FreeSpace,
  Peer,
  SessionInfo,
  SessionStats,
  Torrent,
  TorrentFile,
  TrackerStats,
} from './types'

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json')

  if (!isJson) {
    if (!res.ok) throw new Error((await res.text()) || res.statusText)
    return undefined as T
  }

  const data = await res.json()
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error as string)
  }
  if (!res.ok) throw new Error(res.statusText)
  return data as T
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// Go's encoding/json marshals nil slices as `null`, not `[]` — normalize so
// callers can always treat these as arrays.
function orEmpty<T>(list: T[] | null | undefined): T[] {
  return list ?? []
}

export async function getTorrents() {
  const data = await apiFetch<{ torrents: Torrent[] | null; stats: SessionStats }>('/api/torrents')
  return { ...data, torrents: orEmpty(data.torrents) }
}

export function getStats() {
  return apiFetch<{
    stats: SessionStats
    info: SessionInfo | null
    version: string
    freeSpace: FreeSpace | null
    portOpen: boolean
  }>('/api/stats')
}

export async function getPeers(id: number) {
  const data = await apiFetch<{ peers: Peer[] | null }>(`/api/peers?id=${id}`)
  return { peers: orEmpty(data.peers) }
}

export async function getTrackers(id: number) {
  const data = await apiFetch<{ trackers: TrackerStats[] | null }>(`/api/trackers?id=${id}`)
  return { trackers: orEmpty(data.trackers) }
}

export async function getFiles(id: number) {
  const data = await apiFetch<{ files: TorrentFile[] | null }>(`/api/files?id=${id}`)
  return { files: orEmpty(data.files) }
}

export function setFilesWanted(id: number, indices: number[], wanted: boolean) {
  return apiFetch<{ ok: boolean }>('/api/files/set', jsonPost({ id, indices, wanted }))
}

export function addMagnet(magnet: string) {
  const form = new FormData()
  form.set('magnet', magnet)
  return apiFetch<void>('/api/add', { method: 'POST', body: form })
}

export function addTorrentFiles(files: FileList) {
  const form = new FormData()
  for (const file of files) form.append('torrent-file', file)
  return apiFetch<void>('/api/add', { method: 'POST', body: form })
}

export function postAction(action: Action) {
  return apiFetch<{ status: string }>('/api/action', jsonPost(action))
}

export async function getFeeds() {
  const data = await apiFetch<{ feeds: Feed[] | null }>('/api/feeds')
  return { feeds: orEmpty(data.feeds) }
}

export function addFeed(feed: Omit<Feed, 'id' | 'lastChecked' | 'lastError' | 'matchCount'>) {
  return apiFetch<Feed>('/api/feeds/add', jsonPost(feed))
}

export function updateFeed(feed: Omit<Feed, 'lastChecked' | 'lastError' | 'matchCount'>) {
  return apiFetch<{ status: string }>('/api/feeds/update', jsonPost(feed))
}

export function deleteFeed(id: number) {
  return apiFetch<{ status: string }>(`/api/feeds/delete?id=${id}`, { method: 'POST' })
}

export function checkFeed(id: number) {
  return apiFetch<{ status: string }>(`/api/feeds/check?id=${id}`, { method: 'POST' })
}

export async function getFeedLogs(id: number) {
  const data = await apiFetch<{ logs: FeedCheckLog[] | null }>(`/api/feeds/logs?id=${id}`)
  return { logs: orEmpty(data.logs) }
}
