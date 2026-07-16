import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/hooks/useTorrentStream'

const LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Reconnecting…',
}

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-lg">
      <span
        className={cn(
          'size-2 rounded-full',
          status === 'live' && 'animate-pulse bg-success',
          status === 'offline' && 'bg-destructive',
          status === 'connecting' && 'bg-muted-foreground',
        )}
      />
      {LABEL[status]}
    </div>
  )
}
