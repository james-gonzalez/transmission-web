import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MODE_LABELS = { '1': 'Stop at ratio', '2': 'Seed forever', '0': 'Use global' }

interface RatioEditorProps {
  seedRatioLimit: number
  seedRatioMode: number
  onSave: (ratio: number, ratioMode: number) => void
  onClose: () => void
}

export function RatioEditor({ seedRatioLimit, seedRatioMode, onSave, onClose }: RatioEditorProps) {
  const [ratio, setRatio] = useState(seedRatioMode === 1 ? String(seedRatioLimit) : '')
  const [mode, setMode] = useState(String(seedRatioMode))
  const value = parseFloat(ratio)
  // Mode 1 stops seeding at the ratio, so a blank or zero ratio would stop it immediately.
  const valid = mode !== '1' || (Number.isFinite(value) && value > 0)

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        type="number"
        step="0.1"
        min="0"
        placeholder="e.g. 2.0"
        aria-label="Seed ratio limit"
        value={ratio}
        onChange={(e) => setRatio(e.target.value)}
        className="w-24"
      />
      <Select items={MODE_LABELS} value={mode} onValueChange={(value) => value !== null && setMode(value)}>
        <SelectTrigger aria-label="Seed ratio mode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Stop at ratio</SelectItem>
          <SelectItem value="2">Seed forever</SelectItem>
          <SelectItem value="0">Use global</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!valid} onClick={() => onSave(Number.isFinite(value) ? value : 0, parseInt(mode, 10))}>
        Save
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close ratio editor" title="Close">
        <X />
      </Button>
    </div>
  )
}
