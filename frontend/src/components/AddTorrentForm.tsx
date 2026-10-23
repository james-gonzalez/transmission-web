import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addMagnet, addTorrentFiles } from '@/api/client'

export function AddTorrentForm() {
  const [magnet, setMagnet] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    <div className="flex items-center gap-2">
      <Input
        value={magnet}
        onChange={(e) => setMagnet(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submitMagnet()}
        placeholder="Paste magnet link or torrent URL..."
        aria-label="Magnet link or torrent URL"
        className="min-w-0 flex-1"
        disabled={submitting}
      />
      <Button onClick={submitMagnet} disabled={submitting || !magnet.trim()}>
        <Plus /> Add
      </Button>
      <Button
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={submitting}
        aria-label="Upload .torrent file(s)"
        title="Upload .torrent file(s)"
      >
        <FolderOpen /> <span className="hidden sm:inline">Upload</span>
      </Button>
      <input ref={fileInputRef} type="file" accept=".torrent" multiple className="hidden" onChange={onFilesSelected} />
    </div>
  )
}
