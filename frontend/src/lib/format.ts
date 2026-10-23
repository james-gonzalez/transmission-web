import type { TorrentStatus } from '@/api/types'

// Steps up a unit once the value would print as 1000 or more, so 1,033,000 B
// reads "1.0 MB" rather than "1008.8 KB".
function formatScaled(bytes: number, units: string[]): string {
  let value = bytes
  let i = 0
  while (value >= 999.95 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return i === 0 ? `${value} ${units[0]}` : `${value.toFixed(1)} ${units[i]}`
}

export function formatSpeed(bytes: number): string {
  return formatScaled(bytes, ['B/s', 'KB/s', 'MB/s', 'GB/s'])
}

export function formatBytes(bytes: number): string {
  return formatScaled(bytes, ['B', 'KB', 'MB', 'GB', 'TB'])
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

export type StatusTone = 'stopped' | 'queued' | 'downloading' | 'seeding'

const STATUS_TONE: Record<TorrentStatus, StatusTone> = {
  0: 'stopped',
  1: 'queued',
  2: 'queued',
  3: 'queued',
  4: 'downloading',
  5: 'queued',
  6: 'seeding',
}

export function getStatusTone(status: TorrentStatus): StatusTone {
  return STATUS_TONE[status] ?? 'stopped'
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

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatRelativeTime(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return 'just now'
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
