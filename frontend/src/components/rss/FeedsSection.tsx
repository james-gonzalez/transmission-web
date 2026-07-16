import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FeedCard } from './FeedCard'
import { FeedFormDialog } from './FeedFormDialog'
import { FeedLogDialog } from './FeedLogDialog'
import { checkFeed, deleteFeed, getFeeds } from '@/api/client'
import type { Feed } from '@/api/types'

export function FeedsSection() {
  const [feeds, setFeeds] = useState<Feed[] | null>(null)
  const [formFeed, setFormFeed] = useState<Feed | null | undefined>(undefined)
  const [logFeed, setLogFeed] = useState<Feed | null>(null)

  const load = () => {
    getFeeds()
      .then((data) => setFeeds(data.feeds))
      .catch(() => setFeeds([]))
  }

  useEffect(load, [])

  const handleDelete = async (feed: Feed) => {
    if (!confirm(`Delete RSS feed "${feed.name}"?`)) return
    try {
      await deleteFeed(feed.id)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete feed')
    }
  }

  const handleCheckNow = async (feed: Feed) => {
    try {
      await checkFeed(feed.id)
      setTimeout(load, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check feed')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">RSS Feed Subscriptions</h2>
        <div className="flex gap-2">
          <Button onClick={() => setFormFeed(null)}>Add Feed</Button>
          <Button variant="outline" onClick={load}>
            Refresh List
          </Button>
        </div>
      </div>

      {feeds === null && <p className="text-sm text-muted-foreground">Loading RSS feeds...</p>}
      {feeds && feeds.length === 0 && (
        <div className="rounded-xl bg-card py-16 text-center">
          <h2 className="text-lg font-semibold">No RSS Feeds</h2>
          <p className="mt-1 text-sm text-muted-foreground">Click Add Feed to subscribe to a torrent RSS feed</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {feeds?.map((feed) => (
          <FeedCard
            key={feed.id}
            feed={feed}
            onEdit={setFormFeed}
            onDelete={handleDelete}
            onCheckNow={handleCheckNow}
            onViewLog={setLogFeed}
          />
        ))}
      </div>

      <FeedFormDialog
        open={formFeed !== undefined}
        feed={formFeed ?? null}
        onClose={() => setFormFeed(undefined)}
        onSaved={load}
      />
      <FeedLogDialog feed={logFeed} onClose={() => setLogFeed(null)} />
    </div>
  )
}
