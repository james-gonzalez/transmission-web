import { useEffect, useState } from 'react'
import { getTrackers } from '@/api/client'
import type { TrackerStats } from '@/api/types'
import { formatDateTime } from '@/lib/format'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function TrackersPanel({ torrentId }: { torrentId: number }) {
  const [trackers, setTrackers] = useState<TrackerStats[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getTrackers(torrentId)
      .then((data) => !cancelled && setTrackers(data.trackers))
      .catch(() => !cancelled && setTrackers([]))
    return () => {
      cancelled = true
    }
  }, [torrentId])

  if (trackers === null) return <p className="p-4 text-sm text-muted-foreground">Loading trackers...</p>
  if (trackers.length === 0) return <p className="p-4 text-sm text-muted-foreground">No trackers</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracker</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Seeders</TableHead>
          <TableHead>Leechers</TableHead>
          <TableHead>Last Announce</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trackers.map((tracker) => (
          <TableRow key={tracker.id}>
            <TableCell className="max-w-64 truncate" title={tracker.announce}>
              {tracker.host}
            </TableCell>
            <TableCell>{tracker.tier}</TableCell>
            <TableCell>
              {tracker.lastAnnounceSucceeded ? (
                <span className="text-success">✓ Success</span>
              ) : (
                <span className="text-destructive" title={tracker.lastAnnounceResult}>
                  ✗ Failed
                </span>
              )}
            </TableCell>
            <TableCell>{tracker.seederCount}</TableCell>
            <TableCell>{tracker.leecherCount}</TableCell>
            <TableCell>
              {tracker.lastAnnounceTime > 0 ? formatDateTime(new Date(tracker.lastAnnounceTime * 1000)) : 'Never'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
