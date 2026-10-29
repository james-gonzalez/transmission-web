import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/hooks/useTorrentStream'

const LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  unreachable: 'Transmission unreachable',
  offline: 'Reconnecting…',
}

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium">
      <span
        className={cn(
          'size-2 rounded-full',
          status === 'live' && 'animate-pulse bg-success',
          (status === 'offline' || status === 'unreachable') && 'bg-destructive',
          status === 'connecting' && 'bg-muted-foreground',
        )}
      />
      {LABEL[status]}
    </div>
  )
}
