import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getStats } from '@/api/client'
import type { SessionInfo, StatsDetail, SessionStats } from '@/api/types'
import { formatBytes, formatDuration, formatSpeed } from '@/lib/format'

interface StatsDialogProps {
  open: boolean
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b border-border py-1 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ratioOf(detail: StatsDetail | undefined): string {
  if (detail && detail.downloadedBytes > 0) return (detail.uploadedBytes / detail.downloadedBytes).toFixed(2)
  return '∞'
}

export function StatsDialog({ open, onClose }: StatsDialogProps) {
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStats(null)
    setError(null)
    getStats()
      .then((data) => {
        setStats(data.stats)
        setInfo(data.info)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error loading stats'))
  }, [open])

  const cur = stats?.['current-stats']
  const cum = stats?.['cumulative-stats']

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daemon Statistics</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !stats && <p className="text-sm text-muted-foreground">Loading...</p>}
        {stats && (
          <div className="flex flex-col gap-4">
            <section>
              <h4 className="mb-1 text-sm font-semibold text-primary">This session</h4>
              <Row label="Downloaded" value={formatBytes(cur?.downloadedBytes ?? 0)} />
              <Row label="Uploaded" value={formatBytes(cur?.uploadedBytes ?? 0)} />
              <Row label="Ratio" value={ratioOf(cur)} />
              <Row label="Files added" value={cur?.filesAdded ?? 0} />
              <Row label="Active for" value={formatDuration(cur?.secondsActive ?? 0)} />
            </section>
            <section>
              <h4 className="mb-1 text-sm font-semibold text-primary">All time</h4>
              <Row label="Downloaded" value={formatBytes(cum?.downloadedBytes ?? 0)} />
              <Row label="Uploaded" value={formatBytes(cum?.uploadedBytes ?? 0)} />
              <Row label="Ratio" value={ratioOf(cum)} />
              <Row label="Files added" value={cum?.filesAdded ?? 0} />
              <Row label="Sessions" value={cum?.sessionCount ?? 0} />
              <Row label="Total active" value={formatDuration(cum?.secondsActive ?? 0)} />
            </section>
            <section>
              <h4 className="mb-1 text-sm font-semibold text-primary">Torrents</h4>
              <Row label="Active" value={stats.activeTorrentCount} />
              <Row label="Paused" value={stats.pausedTorrentCount} />
              <Row label="Total" value={stats.torrentCount} />
            </section>
            <section>
              <h4 className="mb-1 text-sm font-semibold text-primary">Speeds</h4>
              <Row label="Download" value={formatSpeed(stats.downloadSpeed)} />
              <Row label="Upload" value={formatSpeed(stats.uploadSpeed)} />
            </section>
            <section>
              <h4 className="mb-1 text-sm font-semibold text-primary">Daemon</h4>
              <Row label="Version" value={info?.version || '—'} />
              <Row label="RPC version" value={info?.['rpc-version'] || '—'} />
              <Row label="Download dir" value={info?.['download-dir'] || '—'} />
              <Row label="Peer port" value={info?.['peer-port'] || '—'} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
