import { ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FILTERS, type FilterKey } from '@/lib/filters'
import { SORTS, type SortKey } from '@/lib/sort'
import type { Torrent } from '@/api/types'
import { countByFilter } from '@/lib/filters'

interface FilterBarProps {
  torrents: Torrent[]
  filter: FilterKey
  onFilterChange: (filter: FilterKey) => void
  search: string
  onSearchChange: (search: string) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

export function FilterBar({
  torrents,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'ghost'}
            onClick={() => onFilterChange(key)}
          >
            {label}
            <Badge variant="secondary" className="ml-1">
              {countByFilter(torrents, key)}
            </Badge>
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(value) => value !== null && onSortChange(value as SortKey)}>
          <SelectTrigger size="sm" className="w-44" aria-label="Sort torrents by">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-56 flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search torrents..."
            className="pl-8"
          />
        </div>
      </div>
    </div>
  )
}
