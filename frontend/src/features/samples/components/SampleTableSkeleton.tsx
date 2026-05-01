import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SampleTableSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-30 bg-card/70 backdrop-blur-xl">
            <TableRow className="h-12 bg-muted hover:bg-muted">
              <TableHead className="w-[160px]">Sample ID</TableHead>
              <TableHead className="w-[130px]">Region</TableHead>
              <TableHead className="w-[160px]">Province</TableHead>
              <TableHead className="w-[160px]">District</TableHead>
              <TableHead className="min-w-[200px]">Variety</TableHead>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[140px]">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="h-16">
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-32 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SampleTableSkeleton;
