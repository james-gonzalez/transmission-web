import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Magnet, FolderOpen, Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { addMagnet, addTorrentFiles } from '@/api/client'
import { useTorrentActions } from '@/hooks/useTorrentActions'

interface AddTorrentFormProps {
  rssView: boolean
  onToggleRss: () => void
}

export function AddTorrentForm({ rssView, onToggleRss }: AddTorrentFormProps) {
  const [magnet, setMagnet] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { reannounceAll } = useTorrentActions()

  const submitMagnet = async () => {
    if (!magnet.trim()) return
    setSubmitting(true)
    try {
      await addMagnet(magnet.trim())
      toast.success('Torrent added')
      setMagnet('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add torrent')
    } finally {
      setSubmitting(false)
    }
  }

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setSubmitting(true)
    try {
      await addTorrentFiles(files)
      toast.success(files.length > 1 ? `${files.length} torrent files added` : 'Torrent file added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add torrent file(s)')
    } finally {
      setSubmitting(false)
      e.target.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Torrent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Input
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitMagnet()}
          placeholder="Paste magnet link or torrent URL..."
          className="min-w-64 flex-1"
          disabled={submitting}
        />
        <Button size="icon" variant="secondary" onClick={submitMagnet} disabled={submitting} title="Add magnet link">
          <Magnet />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
          title="Upload .torrent file(s)"
        >
          <FolderOpen />
        </Button>
        <input ref={fileInputRef} type="file" accept=".torrent" multiple className="hidden" onChange={onFilesSelected} />
        <Button variant="outline" onClick={() => reannounceAll()}>
          Reannounce All
        </Button>
        <Button variant={rssView ? 'default' : 'outline'} className="ml-auto" onClick={onToggleRss}>
          <Rss /> RSS Feeds
        </Button>
      </CardContent>
    </Card>
  )
}
