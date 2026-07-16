import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getFiles, setFilesWanted } from '@/api/client'
import type { TorrentFile } from '@/api/types'
import { formatBytes, formatPercent } from '@/lib/format'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FilesPanel({ torrentId }: { torrentId: number }) {
  const [files, setFiles] = useState<TorrentFile[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = () => {
    getFiles(torrentId)
      .then((data) => setFiles(data.files))
      .catch(() => setFiles([]))
  }

  useEffect(load, [torrentId])

  if (files === null) return <p className="p-4 text-sm text-muted-foreground">Loading files...</p>
  if (files.length === 0) return <p className="p-4 text-sm text-muted-foreground">No files</p>

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(files.map((f) => f.index)) : new Set())
  }

  const toggleOne = (index: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  const applySelection = async (wanted: boolean) => {
    if (selected.size === 0) return
    try {
      await setFilesWanted(torrentId, Array.from(selected), wanted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update files')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between p-2">
        <span className="text-sm font-medium">Files ({files.length})</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => applySelection(true)}>
            Download
          </Button>
          <Button size="sm" variant="outline" onClick={() => applySelection(false)}>
            Don't download
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                title="Select all"
                checked={selected.size === files.length}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Download</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.index} className={cn(!file.wanted && 'opacity-50')}>
              <TableCell>
                <Checkbox
                  checked={selected.has(file.index)}
                  onCheckedChange={(checked) => toggleOne(file.index, checked === true)}
                />
              </TableCell>
              <TableCell className="max-w-96 truncate" title={file.name}>
                {file.name}
              </TableCell>
              <TableCell>{formatBytes(file.length)}</TableCell>
              <TableCell>{formatPercent(file.length > 0 ? file.bytesCompleted / file.length : 0)}</TableCell>
              <TableCell>{file.wanted ? '✓ Yes' : 'Skipped'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
