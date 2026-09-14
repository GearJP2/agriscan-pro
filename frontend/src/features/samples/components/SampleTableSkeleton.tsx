import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SampleTableSkeletonProps {
  toolbar?: ReactNode;
}

const SampleTableSkeleton = ({ toolbar }: SampleTableSkeletonProps = {}) => {
  return (
    <div className="overflow-hidden rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 bg-white dark:bg-slate-900/90 shadow-gfs-card font-sans">
      {toolbar && (
        <div className="border-b border-gfs-maroon/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4 sm:px-6">
          {toolbar}
        </div>
      )}
      <div className="relative max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border)/0.5)]">
            <TableRow className="h-12 bg-muted hover:bg-muted">
              <TableHead className="w-[160px]">Sample ID</TableHead>
              <TableHead className="w-[130px]">Region</TableHead>
              <TableHead className="w-[160px]">Province</TableHead>
              <TableHead className="w-[160px]">District</TableHead>
              <TableHead className="min-w-[200px]">Food / Feed</TableHead>
              <TableHead className="w-[140px]">Collected</TableHead>
              <TableHead className="w-[140px]">Received</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="min-w-[150px] w-[150px]">Risk</TableHead>
              <TableHead className="w-12 text-center" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="h-16 border-b border-gfs-maroon/10 dark:border-white/5">
                <TableCell>
                  <Skeleton className="h-4 w-24 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-32 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" />
                </TableCell>
                <TableCell className="w-12 text-center">
                  <Skeleton className="h-6 w-6 rounded-full mx-auto bg-gfs-maroon/10 dark:bg-slate-800" />
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
