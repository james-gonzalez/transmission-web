import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Feed } from '@/api/types'
import { formatDateTime } from '@/lib/format'

interface FeedCardProps {
  feed: Feed
  onEdit: (feed: Feed) => void
  onDelete: (feed: Feed) => void
  onCheckNow: (feed: Feed) => Promise<void>
  onViewLog: (feed: Feed) => void
}

export function FeedCard({ feed, onEdit, onDelete, onCheckNow, onViewLog }: FeedCardProps) {
  const [checking, setChecking] = useState(false)

  const handleCheckNow = async () => {
    setChecking(true)
    try {
      await onCheckNow(feed)
    } finally {
      setTimeout(() => setChecking(false), 2000)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{feed.name}</h3>
          <Badge variant={feed.enabled ? 'default' : 'secondary'}>
            {feed.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground" title={feed.url}>
          {feed.url}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground" title={feed.pattern}>
          {feed.pattern}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Interval: {feed.checkInterval}m</span>
          <span>Last checked: {feed.lastChecked ? formatDateTime(new Date(feed.lastChecked)) : 'Never'}</span>
          <span>Matches: {feed.matchCount}</span>
          {feed.lastError && <span className="text-destructive">Error: {feed.lastError}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={handleCheckNow} disabled={checking}>
            {checking ? 'Checking…' : 'Check Now'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onViewLog(feed)}>
            View Log
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(feed)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(feed)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
