import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getStats, postAction } from '@/api/client'

interface GlobalRatioDialogProps {
  open: boolean
  onClose: () => void
}

export function GlobalRatioDialog({ open, onClose }: GlobalRatioDialogProps) {
  const [enabled, setEnabled] = useState(false)
  const [ratio, setRatio] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!open) return
    setStatus('')
    getStats().then((data) => {
      if (data.info) {
        setEnabled(data.info.seedRatioLimited)
        setRatio(String(data.info.seedRatioLimit))
      }
    })
  }, [open])

  const value = parseFloat(ratio)
  const valid = !enabled || (Number.isFinite(value) && value > 0)

  const apply = async () => {
    setStatus('Saving…')
    try {
      await postAction({ action: 'set-global-ratio', ratio: Number.isFinite(value) ? value : 0, enabled })
      setStatus('Saved')
      setTimeout(onClose, 600)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Global Seed Ratio</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Switch id="global-ratio-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="global-ratio-enabled">Stop seeding at ratio</Label>
        </div>
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="e.g. 2.0"
          value={ratio}
          onChange={(e) => setRatio(e.target.value)}
        />
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
