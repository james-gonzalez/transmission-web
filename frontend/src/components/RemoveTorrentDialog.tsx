import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Torrent } from '@/api/types'

interface RemoveTorrentDialogProps {
  torrent: Torrent | null
  onClose: () => void
  onConfirm: (id: number, deleteData: boolean) => void
}

export function RemoveTorrentDialog({ torrent, onClose, onConfirm }: RemoveTorrentDialogProps) {
  const [deleteData, setDeleteData] = useState(false)

  return (
    <Dialog
      open={torrent !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setDeleteData(false)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Torrent</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Remove <span className="font-medium text-foreground">{torrent?.name}</span>?
        </p>
        <div className="flex items-center gap-2">
          <Checkbox id="delete-data" checked={deleteData} onCheckedChange={(c) => setDeleteData(c === true)} />
          <Label htmlFor="delete-data">Also delete downloaded data</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (torrent) onConfirm(torrent.id, deleteData)
              setDeleteData(false)
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
