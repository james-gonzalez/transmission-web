import type { TorrentStatus } from '@/api/types'

export function formatSpeed(bytes: number): string {
  if (bytes < 1024) return bytes + ' B/s'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB/s'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB/s'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  return (bytes / 1024 / 1024 / 1024 / 1024).toFixed(1) + ' TB'
}

export function formatPercent(pct: number): string {
  return (pct * 100).toFixed(1) + '%'
}

export function formatRatio(ratio: number): string {
  if (ratio < 0) return 'N/A'
  return ratio.toFixed(2)
}

export function formatETA(seconds: number): string {
  if (seconds < 0) return 'Unknown'
  if (seconds === 0) return 'Done'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return hours + 'h ' + minutes + 'm'
  if (minutes > 0) return minutes + 'm ' + secs + 's'
  return secs + 's'
}

const STATUS_TEXT: Record<TorrentStatus, string> = {
  0: 'Stopped',
  1: 'Queued (check)',
  2: 'Checking',
  3: 'Queued (dl)',
  4: 'Downloading',
  5: 'Queued (seed)',
  6: 'Seeding',
}

export function getStatusText(status: TorrentStatus): string {
  return STATUS_TEXT[status] ?? 'Unknown'
}

const STATUS_CLASS: Record<TorrentStatus, string> = {
  0: 'stopped',
  1: 'queued',
  2: 'queued',
  3: 'queued',
  4: 'downloading',
  5: 'queued',
  6: 'seeding',
}

export function getStatusClass(status: TorrentStatus): string {
  return STATUS_CLASS[status] ?? ''
}

export function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`
}

export function formatDuration(secondsInput: number): string {
  const seconds = Math.floor(secondsInput)
  if (seconds <= 0) return '0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d) parts.push(d + 'd')
  if (h) parts.push(h + 'h')
  if (m || parts.length === 0) parts.push(m + 'm')
  return parts.join(' ')
}

export function libraryRatio(torrents: { downloadedEver: number; uploadedEver: number }[]): number {
  let downloaded = 0
  let uploaded = 0
  for (const t of torrents) {
    downloaded += t.downloadedEver
    uploaded += t.uploadedEver
  }
  if (downloaded === 0) return 0
  return uploaded / downloaded
}
