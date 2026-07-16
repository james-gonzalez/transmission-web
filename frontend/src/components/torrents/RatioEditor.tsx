import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RatioEditorProps {
  seedRatioLimit: number
  seedRatioMode: number
  onSave: (ratio: number, ratioMode: number) => void
  onClose: () => void
}

export function RatioEditor({ seedRatioLimit, seedRatioMode, onSave, onClose }: RatioEditorProps) {
  const [ratio, setRatio] = useState(seedRatioMode === 1 ? String(seedRatioLimit) : '')
  const [mode, setMode] = useState(String(seedRatioMode))

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
        value={ratio}
        onChange={(e) => setRatio(e.target.value)}
        className="w-24"
      />
      <Select value={mode} onValueChange={(value) => value !== null && setMode(value)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Stop at ratio</SelectItem>
          <SelectItem value="2">Seed forever</SelectItem>
          <SelectItem value="0">Use global</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={() => onSave(parseFloat(ratio) || 0, parseInt(mode, 10))}>
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        ×
      </Button>
    </div>
  )
}
