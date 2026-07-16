import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RatioEditor } from './RatioEditor'
import { PeersPanel } from './PeersPanel'
import { TrackersPanel } from './TrackersPanel'
import { FilesPanel } from './FilesPanel'
import { useTorrentActions } from '@/hooks/useTorrentActions'
import { formatBytes, formatETA, formatPercent, formatRatio, formatSpeed, getStatusText } from '@/lib/format'
import type { Torrent } from '@/api/types'
import { cn } from '@/lib/utils'

interface TorrentCardProps {
  torrent: Torrent
  isOpen: boolean
  onToggleOpen: () => void
  onRequestRemove: (torrent: Torrent) => void
}

export function TorrentCard({ torrent, isOpen, onToggleOpen, onRequestRemove }: TorrentCardProps) {
  const { start, stop, reannounce, setRatio } = useTorrentActions()
  const [ratioEditorOpen, setRatioEditorOpen] = useState(false)

  const isDownloading = torrent.status === 4
  const isStopped = torrent.status === 0
  const isComplete = torrent.percentDone >= 1.0

  return (
    <Card className="transition-transform hover:translate-x-1">
      <CardContent className="cursor-pointer" onClick={onToggleOpen}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{torrent.name}</span>
          <Badge variant={isDownloading ? 'default' : isStopped ? 'secondary' : 'outline'}>
            {getStatusText(torrent.status)}
          </Badge>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full bg-primary transition-all duration-300',
              isDownloading && 'bg-downloading',
              isComplete && 'bg-success',
            )}
            style={{ width: `${torrent.percentDone * 100}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Progress: <span className="text-foreground">{formatPercent(torrent.percentDone)}</span>
          </span>
          <span>
            Size: <span className="text-foreground">{formatBytes(torrent.sizeWhenDone)}</span>
          </span>
          {torrent.status === 4 && (
            <span>
              DL: <span className="text-downloading">{formatSpeed(torrent.rateDownload)}</span>
            </span>
          )}
          {(torrent.status === 4 || torrent.status === 6) && (
            <span>
              UL: <span className="text-foreground">{formatSpeed(torrent.rateUpload)}</span>
            </span>
          )}
          <span>
            Ratio: <span className="text-foreground">{formatRatio(torrent.uploadRatio)}</span>
          </span>
          <span>
            Limit:{' '}
            <span className="text-foreground">
              {torrent.seedRatioMode === 1 ? torrent.seedRatioLimit.toFixed(2) : '∞'}
            </span>
          </span>
          <span>
            Peers: <span className="text-foreground">{torrent.peersConnected}</span>
          </span>
          {torrent.percentDone < 1.0 && torrent.eta > 0 && (
            <span>
              ETA: <span className="text-foreground">{formatETA(torrent.eta)}</span>
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {isStopped ? (
            <Button size="sm" onClick={() => start(torrent.id)}>
              Start
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => stop(torrent.id)}>
              Stop
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => reannounce(torrent.id)}>
            Reannounce
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRatioEditorOpen((v) => !v)}>
            Set Ratio
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onRequestRemove(torrent)}>
            Remove
          </Button>
        </div>

        {ratioEditorOpen && (
          <RatioEditor
            seedRatioLimit={torrent.seedRatioLimit}
            seedRatioMode={torrent.seedRatioMode}
            onSave={(ratio, ratioMode) => {
              setRatio(torrent.id, ratio, ratioMode)
              setRatioEditorOpen(false)
            }}
            onClose={() => setRatioEditorOpen(false)}
          />
        )}
      </CardContent>

      {isOpen && (
        <div className="border-t border-border bg-peers-bg px-2 pb-2">
          <Tabs defaultValue="peers">
            <TabsList>
              <TabsTrigger value="peers">Peers</TabsTrigger>
              <TabsTrigger value="trackers">Trackers</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
            <TabsContent value="peers">
              <PeersPanel torrentId={torrent.id} />
            </TabsContent>
            <TabsContent value="trackers">
              <TrackersPanel torrentId={torrent.id} />
            </TabsContent>
            <TabsContent value="files">
              <FilesPanel torrentId={torrent.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  )
}
