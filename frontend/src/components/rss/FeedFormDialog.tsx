import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { addFeed, updateFeed } from '@/api/client'
import type { Feed } from '@/api/types'

interface FeedFormDialogProps {
  open: boolean
  feed: Feed | null
  onClose: () => void
  onSaved: () => void
}

const emptyForm = { name: '', url: '', pattern: '.*', checkInterval: 15, enabled: true }

export function FeedFormDialog({ open, feed, onClose, onSaved }: FeedFormDialogProps) {
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return
    setForm(
      feed
        ? {
            name: feed.name,
            url: feed.url,
            pattern: feed.pattern,
            checkInterval: feed.checkInterval,
            enabled: feed.enabled,
          }
        : emptyForm,
    )
  }, [open, feed])

  const save = async () => {
    if (!form.name || !form.url || !form.pattern) {
      toast.error('Name, URL and pattern are required')
      return
    }
    try {
      if (feed) {
        await updateFeed({ id: feed.id, ...form })
      } else {
        await addFeed(form)
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save feed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{feed ? 'Edit RSS Feed' : 'Add RSS Feed'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="feed-name">Name</Label>
            <Input
              id="feed-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Favorite Torrents"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="feed-url">Feed URL</Label>
            <Input
              id="feed-url"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/feed.rss"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="feed-pattern">Match pattern (regex)</Label>
            <Input
              id="feed-pattern"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder=".*1080p.*|.*HEVC.*"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="feed-interval">Check interval (minutes)</Label>
            <Input
              id="feed-interval"
              type="number"
              min={5}
              max={1440}
              value={form.checkInterval}
              onChange={(e) => setForm({ ...form, checkInterval: parseInt(e.target.value, 10) || 15 })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="feed-enabled"
              checked={form.enabled}
              onCheckedChange={(c) => setForm({ ...form, enabled: c === true })}
            />
            <Label htmlFor="feed-enabled">Enabled</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
