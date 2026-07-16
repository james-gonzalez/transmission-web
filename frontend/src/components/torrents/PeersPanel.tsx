import { useEffect, useState } from 'react'
import { getPeers } from '@/api/client'
import type { Peer } from '@/api/types'
import { formatSpeed } from '@/lib/format'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'

export function PeersPanel({ torrentId }: { torrentId: number }) {
  const [peers, setPeers] = useState<Peer[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      getPeers(torrentId)
        .then((data) => !cancelled && setPeers(data.peers))
        .catch(() => !cancelled && setPeers([]))
    }
    load()
    const interval = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [torrentId])

  if (peers === null) return <p className="p-4 text-sm text-muted-foreground">Loading peers...</p>
  if (peers.length === 0) return <p className="p-4 text-sm text-muted-foreground">No peers connected</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Address</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Flags</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Down</TableHead>
          <TableHead>Up</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {peers.map((peer, i) => (
          <TableRow key={`${peer.address}:${peer.port}-${i}`}>
            <TableCell className="font-mono text-xs">
              {peer.address}:{peer.port}
            </TableCell>
            <TableCell className="max-w-48 truncate" title={peer.clientName}>
              {peer.clientName}
            </TableCell>
            <TableCell className="font-mono text-xs" title={peer.flagStr}>
              {peer.isEncrypted && 'E'}
              {peer.isIncoming && 'I'}
              {peer.isUTP && 'U'}
            </TableCell>
            <TableCell className="w-32">
              <Progress value={peer.progress * 100} />
            </TableCell>
            <TableCell className="text-downloading">{formatSpeed(peer.rateToClient)}</TableCell>
            <TableCell>{formatSpeed(peer.rateToPeer)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
