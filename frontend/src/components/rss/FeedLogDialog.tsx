import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getFeedLogs } from '@/api/client'
import type { Feed, FeedCheckLog } from '@/api/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface FeedLogDialogProps {
  feed: Feed | null
  onClose: () => void
}

function sampleTitles(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function FeedLogDialog({ feed, onClose }: FeedLogDialogProps) {
  const [logs, setLogs] = useState<FeedCheckLog[] | null>(null)

  useEffect(() => {
    if (!feed) return
    setLogs(null)
    getFeedLogs(feed.id)
      .then((data) => setLogs(data.logs))
      .catch(() => setLogs([]))
  }, [feed])

  return (
    <Dialog open={feed !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Feed Check Log: {feed?.name}</DialogTitle>
        </DialogHeader>
        {logs === null && <p className="text-sm text-muted-foreground">Loading...</p>}
        {logs && logs.length === 0 && <p className="text-sm text-muted-foreground">No checks logged yet</p>}
        {logs && logs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Checked</TableHead>
                <TableHead>Found</TableHead>
                <TableHead>Matched</TableHead>
                <TableHead>Downloaded</TableHead>
                <TableHead>Sample Titles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(new Date(log.checkedAt))}</TableCell>
                  <TableCell>{log.itemsFound}</TableCell>
                  <TableCell className={cn(log.itemsMatched > 0 && 'text-primary')}>{log.itemsMatched}</TableCell>
                  <TableCell className={cn(log.itemsDownloaded > 0 && 'font-semibold text-success')}>
                    {log.itemsDownloaded}
                  </TableCell>
                  <TableCell className="max-w-64">
                    {sampleTitles(log.sampleTitles).length === 0 ? (
                      'None'
                    ) : (
                      <ul className="text-xs text-muted-foreground">
                        {sampleTitles(log.sampleTitles).map((title, i) => (
                          <li key={i} className="truncate" title={title}>
                            {title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
