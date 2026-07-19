import type { Torrent } from '@/api/types'

export type SortKey = 'added' | 'name' | 'progress' | 'download' | 'upload' | 'ratio' | 'size'

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'added', label: 'Date added' },
  { key: 'name', label: 'Name' },
  { key: 'progress', label: 'Progress' },
  { key: 'download', label: 'Download speed' },
  { key: 'upload', label: 'Upload speed' },
  { key: 'ratio', label: 'Ratio' },
  { key: 'size', label: 'Size' },
]

// All comparators sort descending (largest/newest first) except name, which is
// alphabetical — the ordering that reads most naturally for each field.
const COMPARATORS: Record<SortKey, (a: Torrent, b: Torrent) => number> = {
  added: (a, b) => b.addedDate - a.addedDate,
  name: (a, b) => a.name.localeCompare(b.name),
  progress: (a, b) => b.percentDone - a.percentDone,
  download: (a, b) => b.rateDownload - a.rateDownload,
  upload: (a, b) => b.rateUpload - a.rateUpload,
  ratio: (a, b) => b.uploadRatio - a.uploadRatio,
  size: (a, b) => b.sizeWhenDone - a.sizeWhenDone,
}

export function sortTorrents(torrents: Torrent[], sort: SortKey): Torrent[] {
  return [...torrents].sort(COMPARATORS[sort])
}
