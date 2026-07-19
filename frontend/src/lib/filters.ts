import { STATUS, type Torrent, type TorrentStatus } from '@/api/types'

export type FilterKey = 'all' | 'downloading' | 'seeding' | 'stopped' | 'queued'

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'downloading', label: 'Downloading' },
  { key: 'seeding', label: 'Seeding' },
  { key: 'stopped', label: 'Stopped' },
  { key: 'queued', label: 'Queued' },
]

const STATUS_BY_FILTER: Record<Exclude<FilterKey, 'all'>, TorrentStatus[]> = {
  downloading: [STATUS.DOWNLOADING],
  seeding: [STATUS.SEEDING],
  stopped: [STATUS.STOPPED],
  queued: [STATUS.QUEUED_CHECK, STATUS.CHECKING, STATUS.QUEUED_DOWNLOAD, STATUS.QUEUED_SEED],
}

export function matchesFilter(status: TorrentStatus, filter: FilterKey): boolean {
  if (filter === 'all') return true
  return STATUS_BY_FILTER[filter].includes(status)
}

export function countByFilter(torrents: Torrent[], filter: FilterKey): number {
  if (filter === 'all') return torrents.length
  return torrents.filter((t) => matchesFilter(t.status, filter)).length
}

export function filterTorrents(torrents: Torrent[], filter: FilterKey, search: string): Torrent[] {
  const query = search.trim().toLowerCase()
  return torrents.filter(
    (t) => matchesFilter(t.status, filter) && (query === '' || t.name.toLowerCase().includes(query)),
  )
}
