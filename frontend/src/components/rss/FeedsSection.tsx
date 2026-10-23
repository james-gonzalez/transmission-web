import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FeedCard } from './FeedCard'
import { FeedFormDialog } from './FeedFormDialog'
import { FeedLogDialog } from './FeedLogDialog'
import { checkFeed, deleteFeed, getFeeds } from '@/api/client'
import type { Feed } from '@/api/types'

export function FeedsSection() {
  const [feeds, setFeeds] = useState<Feed[] | null>(null)
  const [formFeed, setFormFeed] = useState<Feed | null | undefined>(undefined)
  const [logFeed, setLogFeed] = useState<Feed | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Feed | null>(null)
  // Remember the last target so its name stays visible during the close animation.
  const [shownDelete, setShownDelete] = useState(deleteTarget)
  if (deleteTarget && deleteTarget !== shownDelete) setShownDelete(deleteTarget)

  const load = () => {
    getFeeds()
      .then((data) => setFeeds(data.feeds))
      .catch(() => setFeeds([]))
  }

  useEffect(load, [])

  const handleDelete = async (feed: Feed) => {
    setDeleteTarget(null)
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
            onDelete={setDeleteTarget}
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
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete RSS Feed</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{shownDelete?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
