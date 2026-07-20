// Mirrors the JSON shapes returned by the Go backend (main.go / rss.go).

export type TorrentStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6
// 0=stopped 1=queued-check 2=checking 3=queued-download 4=downloading 5=queued-seed 6=seeding

export const STATUS = {
  STOPPED: 0,
  QUEUED_CHECK: 1,
  CHECKING: 2,
  QUEUED_DOWNLOAD: 3,
  DOWNLOADING: 4,
  QUEUED_SEED: 5,
  SEEDING: 6,
} as const satisfies Record<string, TorrentStatus>

export interface Torrent {
  id: number
  name: string
  status: TorrentStatus
  percentDone: number
  rateDownload: number
  rateUpload: number
  uploadRatio: number
  sizeWhenDone: number
  downloadedEver: number
  uploadedEver: number
  peersConnected: number
  eta: number
  error: number
  errorString: string
  addedDate: number
  seedRatioLimit: number
  seedRatioMode: number
}

export interface StatsDetail {
  uploadedBytes: number
  downloadedBytes: number
  filesAdded: number
  sessionCount: number
  secondsActive: number
}

export interface SessionStats {
  activeTorrentCount: number
  pausedTorrentCount: number
  torrentCount: number
  downloadSpeed: number
  uploadSpeed: number
  'current-stats': StatsDetail
  'cumulative-stats': StatsDetail
}

export interface SessionInfo {
  version: string
  'rpc-version': number
  'download-dir': string
  'peer-port': number
  seedRatioLimit: number
  seedRatioLimited: boolean
}

export interface Peer {
  address: string
  clientName: string
  clientIsChoked: boolean
  clientIsInterested: boolean
  flagStr: string
  isDownloadingFrom: boolean
  isEncrypted: boolean
  isIncoming: boolean
  isUploadingTo: boolean
  isUTP: boolean
  peerIsChoked: boolean
  peerIsInterested: boolean
  port: number
  progress: number
  rateToClient: number
  rateToPeer: number
}

export interface TrackerStats {
  announce: string
  announceState: number
  downloadCount: number
  hasAnnounced: boolean
  hasScraped: boolean
  host: string
  id: number
  isBackup: boolean
  lastAnnouncePeerCount: number
  lastAnnounceResult: string
  lastAnnounceStartTime: number
  lastAnnounceSucceeded: boolean
  lastAnnounceTime: number
  lastScrapeResult: string
  lastScrapeStartTime: number
  lastScrapeSucceeded: boolean
  lastScrapeTime: number
  leecherCount: number
  nextAnnounceTime: number
  nextScrapeTime: number
  scrape: string
  scrapeState: number
  seederCount: number
  tier: number
}

export interface TorrentFile {
  index: number
  name: string
  length: number
  bytesCompleted: number
  wanted: boolean
}

export type Action =
  | { action: 'start'; id: number }
  | { action: 'stop'; id: number }
  | { action: 'remove'; id: number; deleteData: boolean }
  | { action: 'reannounce'; id: number }
  | { action: 'reannounce-all' }
  | { action: 'set-ratio'; id: number; ratio: number; ratioMode: number }
  | { action: 'set-global-ratio'; ratio: number; enabled: boolean }

export interface Feed {
  id: number
  name: string
  url: string
  pattern: string
  enabled: boolean
  checkInterval: number
  lastChecked: string
  lastError: string
  matchCount: number
}

export interface DownloadedItem {
  id: number
  feedId: number
  itemGuid: string
  itemTitle: string
  itemLink: string
  downloadedAt: string
}

export interface FeedCheckLog {
  id: number
  feedId: number
  checkedAt: string
  itemsFound: number
  itemsMatched: number
  itemsDownloaded: number
  sampleTitles: string
}

export interface StreamPayload {
  torrents: Torrent[] | null
  stats: SessionStats
}

export interface FreeSpace {
  path: string
  'size-bytes': number
  total_size: number
}
