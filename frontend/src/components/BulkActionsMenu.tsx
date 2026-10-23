import { ChevronDown, Pause, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTorrentActions } from '@/hooks/useTorrentActions'

interface BulkActionsMenuProps {
  // Torrents the current filter and search show; bulk actions target exactly these.
  ids: number[]
  total: number
}

export function BulkActionsMenu({ ids, total }: BulkActionsMenuProps) {
  const { startMany, stopMany, reannounceMany } = useTorrentActions()
  const scope = ids.length === total ? `all ${total}` : `${ids.length} shown`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={ids.length === 0} />}>
        Actions <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Apply to {scope}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => startMany(ids)}>
            <Play /> Start
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => stopMany(ids)}>
            <Pause /> Stop
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => reannounceMany(ids)}>
            <RefreshCw /> Reannounce
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
