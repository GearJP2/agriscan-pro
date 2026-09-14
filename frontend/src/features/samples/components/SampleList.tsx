import { lazy, Suspense, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Download,
    ChevronDown,
    Loader2,
    ShieldCheck,
    Wrench,
    FlaskConical,
    Trash2,
    LayoutGrid,
    CheckCircle2,
    AlertCircle,
    Clock,
    X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import FilterBar from '@/components/FilterBar';
import SampleTable from './SampleTable';
import SampleDetailModal from './SampleDetailModal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Sample, FilterState, ProcessLog, SampleType, SAMPLE_TYPE_LABELS } from '@/types/sample';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/hooks/useWatchlist';
import { USER_ROLE_WEIGHT } from '@/types/user';
import { sampleAPI, invalidateSampleQueries } from '@/lib/api';
import { getThresholdRiskLevel } from '@/lib/mycotoxinRisk';
import type { AxiosError } from 'axios';

import { useDeferredMount } from '@/hooks/useDeferredMount';
import SampleTableSkeleton from './SampleTableSkeleton';
import { Badge } from '@/components/ui/badge';
import { useSampleDetailCoordinator } from '../hooks/useSampleDetailCoordinator';

const AddSampleForm = lazy(() => import('./AddSampleForm'));
const UnifiedImportForm = lazy(() => import('./UnifiedImportForm'));
const RequestInvestigationForm = lazy(() => import('./RequestInvestigationForm'));

const SampleList = () => {
    const { isAdmin, isAuthenticated, role } = useAuth();
    const isDeferredMounted = useDeferredMount(200); // Sample list is lighter than dashboard, so 200ms is enough
    const navigate = useNavigate();
    const { isWatching, watchlist } = useWatchlist();
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        region: [],
        province: [],
        district: [],
        vegetation: [],
        status: [],
        sampleType: [],
        search: '',
        watchlistOnly: false,
        dateFrom: null,
        dateTo: null,
    });

    const queryClient = useQueryClient();
    const invalidateSampleData = () => {
        invalidateSampleQueries(queryClient);
    };

    // mutations for creation - invalidate both list and dashboard queries
    const createSampleMutation = useMutation({
        mutationFn: (data: Partial<Sample>) => sampleAPI.createSample(data),
        onSuccess: () => {
            invalidateSampleData();
        },
    });

    const createManyMutation = useMutation({
        mutationFn: (newSamples: Sample[]) => {
            // Strip out read-only fields and empty/null values that the backend will default
            const cleanedSamples = newSamples.map(sample => ({
                sample_id: sample.sample_id,
                region: sample.region || 'Unknown',
                province: sample.province,
                district: sample.district,
                food_feed_type: sample.food_feed_type || 'food',
                sub_type: sample.sub_type || sample.vegetation_variety,
                vegetation_variety: sample.vegetation_variety,
                collection_date: sample.collection_date,
                status: sample.status || 'pending',
                purpose: sample.purpose || undefined,
                sample_type: sample.sample_type || undefined,
                processing_type: sample.processing_type || undefined,
                additional_info: sample.additional_info || '',
            }));
            return sampleAPI.bulkCreateSamples(cleanedSamples);
        },
        onSuccess: () => {
            invalidateSampleData();
        },
    });

    const bulkDeleteSamplesMutation = useMutation({
        mutationFn: (sampleIds: string[]) => sampleAPI.bulkDeleteSamples(sampleIds),
        onSuccess: (data) => {
            invalidateSampleData();
            const notFoundMsg = data.not_found?.length
                ? ` (${data.not_found.length} IDs not found)`
                : '';
            toast({
                title: 'Bulk Delete Complete',
                description: `${data.deleted} sample${data.deleted !== 1 ? 's' : ''} permanently deleted.${notFoundMsg}`,
            });
        },
        onError: (error: AxiosError<{ detail?: string }>) => {
            const detail = error?.response?.data?.detail || 'Failed to delete samples.';
            toast({
                title: 'Bulk Delete Failed',
                description: detail,
                variant: 'destructive',
            });
        },
    });

    const generateTestSamplesMutation = useMutation({
        mutationFn: (seed?: number) => sampleAPI.generateTestSamples(seed),
        onSuccess: (data) => {
            invalidateSampleData();
            toast({
                title: 'Test Data Generated',
                description: `Successfully created ${data.created} samples (${data.positive} positive, ${data.negative} negative).`,
            });
        },
        onError: (error: AxiosError<{ detail?: string }>) => {
            const detail = error?.response?.data?.detail || 'Failed to generate test data.';
            toast({
                title: 'Generation Failed',
                description: detail,
                variant: 'destructive',
            });
        },
    });

    const deleteTestSamplesMutation = useMutation({
        mutationFn: () => sampleAPI.deleteTestSamples(),
        onSuccess: (data) => {
            invalidateSampleData();
            toast({
                title: 'Test Data Purged',
                description: `Successfully deleted ${data.deleted} test samples.`,
            });
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail || 'Failed to delete test data.';
            toast({
                title: 'Purge Failed',
                description: detail,
                variant: 'destructive',
            });
        },
    });

    const handleAddSample = (sample: Sample) => {
        createSampleMutation.mutate(sample, {
            onSuccess: (createdSample) => {
                const createdId = createdSample?.sample_id || sample.sample_id || '(generated)';
                toast({
                    title: 'Sample Registered',
                    description: `Sample ${createdId} added successfully.`,
                });
            },
            onError: () => {
                toast({
                    title: 'Error',
                    description: 'Failed to create sample.',
                    variant: 'destructive',
                });
            },
        });
    };

    const handleAddMultipleSamples = (newSamples: Sample[]) => {
        createManyMutation.mutate(newSamples, {
            onSuccess: () => {
                toast({
                    title: 'Samples Imported',
                    description: `${newSamples.length} samples registered successfully.`,
                });
            },
            onError: (error: any) => {
                const errorMsg = error?.response?.data ? JSON.stringify(error.response.data) : 'Failed to import samples.';
                console.error('Import error details:', errorMsg);
                toast({
                    title: 'Import Error',
                    description: errorMsg,
                    variant: 'destructive',
                });
            },
        });
    };

    // fetch samples using filters - use 'samples-list' key so it can be isolated from dashboard
    const {
        data: samplesData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['samples-list', { ...filters, watchlistOnly: undefined }],
        queryFn: () =>
            sampleAPI.getSamples(undefined, 100, {
                search: filters.search || undefined,
                status: filters.status.length ? filters.status : undefined,
                region: filters.region.length ? filters.region : undefined,
                province: filters.province.length ? filters.province : undefined,
                vegetation: filters.vegetation.length ? filters.vegetation : undefined,
                sampleType: filters.sampleType.length ? filters.sampleType : undefined,
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
            }),
        enabled: isAuthenticated,
        staleTime: 30000,
    });

    const samples = useMemo<Sample[]>(() => {
        return samplesData?.results || samplesData || [];
    }, [samplesData]);
    const {
        selectedSample,
        modalOpen,
        handleSelectSample,
        handleMycotoxinResultChange,
        handleOpenChange,
    } = useSampleDetailCoordinator({
        samples,
        invalidateSampleData,
    });

    const activeFilters = useMemo(() => {
        const chips: { key: keyof FilterState; value: string; label: string }[] = [];
        
        filters.region.forEach(v => chips.push({ key: 'region', value: v, label: v }));
        filters.vegetation.forEach(v => chips.push({ key: 'vegetation', value: v, label: v }));
        filters.status.forEach(v => chips.push({ key: 'status', value: v, label: v }));
        filters.sampleType.forEach(v => chips.push({ key: 'sampleType', value: v, label: SAMPLE_TYPE_LABELS[v as SampleType] || v }));
        
        if (filters.search) chips.push({ key: 'search', value: filters.search, label: `Search: ${filters.search}` });
        if (filters.watchlistOnly) chips.push({ key: 'watchlistOnly', value: 'true', label: 'Watchlist' });
        
        return chips;
    }, [filters]);

    const removeFilter = (key: keyof FilterState, value: string) => {
        const current = filters[key];
        if (Array.isArray(current)) {
            setFilters({ ...filters, [key]: current.filter(v => v !== value) });
        } else {
            setFilters({ ...filters, [key]: key === 'search' ? '' : false });
        }
    };

    const filteredSamples = useMemo(() => {
        // backend already handles most filters; only watchlist is applied client‑side
        if (filters.watchlistOnly) {
            return samples.filter(s => isWatching(s.sample_id));
        }
        return samples;
    }, [filters, samples, isWatching]);

    // Get export data
    const getExportData = () => {
        const headers = ['Sample ID', 'Region', 'Province', 'District', 'Food / Feed', 'Sub-type', 'Collection Date', 'Received At', 'Status', 'Risk Level', 'Purpose', 'Sample Type', 'Recorded By', 'Additional Info', 'Last Updated By'];

        const sortedForExport = [...filteredSamples].sort((a, b) =>
            a.sample_id.localeCompare(b.sample_id, undefined, { numeric: true, sensitivity: 'base' })
        );

        const rows = sortedForExport.map(sample => {
            const logs = sample.process_logs ?? [];
            const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
            return [
                sample.sample_id,
                sample.region,
                sample.province,
                sample.district,
                sample.food_feed_type || 'food',
                sample.sub_type || sample.vegetation_variety,
                sample.collection_date,
                sample.received_at || '-',
                sample.status,
                getThresholdRiskLevel(sample),
                sample.purpose || '-',
                sample.sample_type || '-',
                sample.recorded_by || '-',
                sample.additional_info || '-',
                lastLog?.conducted_by || '',
            ];
        });

        return { headers, rows };
    };

    // Export filtered samples to CSV
    const handleExportCSV = () => {
        const { headers, rows } = getExportData();

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `samples_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Export Complete',
            description: `${filteredSamples.length} samples exported to CSV.`,
        });
    };

    // Export filtered samples to XLSX
    const handleExportXLSX = async () => {
        const { headers, rows } = getExportData();
        const { default: ExcelJS } = await import('exceljs');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Samples');

        // Add headers
        worksheet.addRow(headers);
        
        // Style headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add rows
        rows.forEach(row => {
            worksheet.addRow(row);
        });

        // Auto-size columns
        worksheet.columns.forEach((column, i) => {
            let maxColumnLength = headers[i].length;
            rows.forEach(row => {
                const cellValue = String(row[i] || '');
                maxColumnLength = Math.max(maxColumnLength, cellValue.length);
            });
            column.width = maxColumnLength + 2;
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `samples_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
            title: 'Export Complete',
            description: `${filteredSamples.length} samples exported to Excel.`,
        });
    };

    const stats = useMemo(() => {
        const total = samples.length;
        const flagged = samples.filter(s => s.status === 'flagged').length;
        const completed = samples.filter(s => s.status === 'completed').length;
        const inProgress = samples.filter(s => s.status === 'in_progress' || s.status === 'pending').length;

        const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
        const flaggedPct = total > 0 ? Math.round((flagged / total) * 100) : 0;

        return {
            total,
            flagged,
            completed,
            inProgress,
            completedPct,
            inProgressPct,
            flaggedPct,
        };
    }, [samples]);

    // Map process state to sample status
    const getStatusFromProcessState = (state: ProcessLog['state']): Sample['status'] => {
        switch (state) {
            case 'registered':
                return 'pending';
            case 'preparing':
            case 'prepared':
            case 'analyzing':
                return 'in_progress';
            case 'recorded':
            case 'completed':
                return 'completed';
            default:
                return 'pending';
        }
    };

    const handleUpdateSample = async (sampleId: string, newLog: ProcessLog) => {
        await sampleAPI.addProcessLog(sampleId, newLog);
        invalidateSampleData();
    };

    const handleImportResultsSuccess = () => {
        invalidateSampleData();
    };

    const tableToolbar = (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs font-medium text-gfs-text-muted dark:text-slate-400">
                Showing <span className="font-bold text-gfs-maroon dark:text-white">{filteredSamples.length}</span> of{' '}
                <span className="font-bold text-gfs-maroon dark:text-white">{samples.length}</span> samples
                {isLoading && <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin inline text-gfs-maroon dark:text-gfs-gold" />}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
                <DropdownMenu open={exportOpen} onOpenChange={(open) => {
                    if (open && !isAuthenticated) {
                        window.dispatchEvent(new CustomEvent('open-login-modal'));
                        return;
                    }
                    setExportOpen(open);
                }}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-10 rounded-md border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 gap-2 transition-all"
                        >
                            <Download className="h-4 w-4 text-gfs-maroon dark:text-gfs-gold" />
                            Export
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal p-1 bg-white dark:bg-slate-900 font-sans">
                        <DropdownMenuItem onClick={handleExportCSV} className="rounded-lg text-xs font-medium cursor-pointer hover:bg-gfs-maroon/5">
                            Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportXLSX} className="rounded-lg text-xs font-medium cursor-pointer hover:bg-gfs-maroon/5">
                            Export as Excel (XLSX)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Suspense fallback={<span className="text-xs text-gfs-text-muted">Loading actions…</span>}>
                    <UnifiedImportForm
                        sampleIds={filteredSamples.map((sample) => sample.sample_id)}
                        onSuccess={handleImportResultsSuccess}
                    />
                    <RequestInvestigationForm />
                    {isAuthenticated && USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] >= USER_ROLE_WEIGHT['research_assistant'] && (
                        <div className="flex items-center gap-2.5">
                            <AddSampleForm onSuccess={handleImportResultsSuccess} />
                            <Button
                                variant={isSelectionMode ? "destructive" : "outline"}
                                className={cn(
                                    "h-10 rounded-md px-4 text-xs font-bold gap-2 transition-all duration-200",
                                    isSelectionMode
                                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                                        : "text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40 bg-white/80 dark:bg-slate-900/80"
                                )}
                                onClick={() => setIsSelectionMode(!isSelectionMode)}
                            >
                                <Trash2 className={cn("h-4 w-4 transition-all duration-300", isSelectionMode && "scale-110")} />
                                {isSelectionMode ? 'Cancel' : 'Delete sample'}
                            </Button>
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    );

    return (
        <div className="w-full flex-1 bg-gfs-canvas text-gfs-text-primary coe-gfs transition-colors duration-300 font-sans">
            <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 space-y-8">
                {/* Page Title */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gfs-maroon dark:text-gfs-gold mb-2">
                            <FlaskConical className="h-4 w-4" />
                            <span>Agricultural Surveillance Hub · Thammasat CoE-GFS</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gfs-maroon dark:text-white tracking-tight">
                            Sample Surveillance Directory
                        </h1>
                        <p className="mt-1.5 text-sm font-medium text-gfs-text-muted dark:text-slate-400 max-w-3xl">
                            Real-time agricultural monitoring hub. Manage, analyze, and track sample lifecycles across regions.
                        </p>
                    </div>
                </div>

                {/* Unified Surveillance Operations & Filter Console */}
                <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gfs-maroon/15 dark:border-white/10 rounded-gfs-card shadow-gfs-card font-sans overflow-hidden">
                    <CardContent className="p-0">
                        {/* Upper Section: Quick Stats Dashboard */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 font-sans border-b border-gfs-maroon/10 dark:border-white/10">
                            {/* Card 1: Total Samples */}
                            <div className="p-6 transition-colors hover:bg-gfs-canvas/40 dark:hover:bg-white/[0.02] flex flex-col justify-between gap-4 border-b sm:border-r lg:border-b-0 border-gfs-maroon/10">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-gfs-maroon/10 text-gfs-maroon dark:bg-gfs-gold/15 dark:text-gfs-gold">
                                            <LayoutGrid className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-gfs-text-muted uppercase tracking-wider">
                                            Total Samples
                                        </p>
                                    </div>
                                    <p className="text-3xl font-extrabold tracking-tight shrink-0 text-gfs-maroon dark:text-white">
                                        {stats.total}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gfs-text-muted font-medium">
                                        Total registered records
                                    </p>
                                    <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold border bg-gfs-thumb/40 text-gfs-text-muted border-gfs-maroon/10 dark:bg-slate-800 dark:text-slate-300">
                                        Total
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Completed */}
                            <div className="p-6 transition-colors hover:bg-gfs-canvas/40 dark:hover:bg-white/[0.02] flex flex-col justify-between gap-4 border-b lg:border-r lg:border-b-0 border-gfs-maroon/10">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-gfs-text-muted uppercase tracking-wider">
                                            Completed
                                        </p>
                                    </div>
                                    <p className="text-3xl font-extrabold tracking-tight shrink-0 text-gfs-maroon dark:text-white">
                                        {stats.completed}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gfs-text-muted font-medium">
                                        {stats.completedPct}% of total samples
                                    </p>
                                    <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        Completed
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: In Analysis */}
                            <div className="p-6 transition-colors hover:bg-gfs-canvas/40 dark:hover:bg-white/[0.02] flex flex-col justify-between gap-4 border-b sm:border-b-0 sm:border-r border-gfs-maroon/10">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                                            <Clock className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-gfs-text-muted uppercase tracking-wider">
                                            In Analysis
                                        </p>
                                    </div>
                                    <p className="text-3xl font-extrabold tracking-tight shrink-0 text-gfs-maroon dark:text-white">
                                        {stats.inProgress}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gfs-text-muted font-medium">
                                        {stats.inProgressPct}% in processing queue
                                    </p>
                                    <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                        In Queue
                                    </span>
                                </div>
                            </div>

                            {/* Card 4: Flagged Risk */}
                            <div className="p-6 transition-colors hover:bg-gfs-canvas/40 dark:hover:bg-white/[0.02] flex flex-col justify-between gap-4 bg-red-50/25 dark:bg-red-950/15">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                            <AlertCircle className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-gfs-text-muted uppercase tracking-wider">
                                            Flagged Risk
                                        </p>
                                    </div>
                                    <p className="text-3xl font-extrabold tracking-tight shrink-0 text-red-700 dark:text-red-400">
                                        {stats.flagged}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gfs-text-muted font-medium">
                                        {stats.flaggedPct}% action required
                                    </p>
                                    <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold border bg-red-50 text-gfs-maroon-dark border-gfs-maroon/20 dark:bg-red-950/40 dark:text-red-300">
                                        Action Required
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Lower Section: Surveillance Filters */}
                        <div className="p-5 md:p-6 space-y-4">
                            <FilterBar filters={filters} onFilterChange={setFilters} embedded />
                            
                            {/* Active Filter Chips */}
                            {activeFilters.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gfs-maroon/10 dark:border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <span className="text-xs font-bold text-gfs-text-muted dark:text-slate-400 uppercase tracking-wider mr-1">Active Filters:</span>
                                    {activeFilters.map((chip) => (
                                        <Badge 
                                            key={`${chip.key}-${chip.value}`} 
                                            variant="secondary" 
                                            className="gap-1.5 pl-3 pr-1.5 py-1 h-7 rounded-full border border-gfs-maroon/20 bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold font-bold text-xs hover:bg-gfs-maroon/15 transition-colors"
                                        >
                                            {chip.label}
                                            <button 
                                                onClick={() => removeFilter(chip.key, chip.value)}
                                                className="rounded-full hover:bg-gfs-maroon/20 p-0.5 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setFilters({
                                            region: [], province: [], district: [], vegetation: [], status: [], sampleType: [],
                                            search: '', watchlistOnly: false, dateFrom: null, dateTo: null
                                        })}
                                        className="h-7 rounded-full px-3 text-xs font-bold text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon/5 transition-all"
                                    >
                                        Clear all
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Sample Table with Integrated Toolbar Header */}
                <>
                    {error ? (
                        <div className="rounded-gfs-card border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-8 text-center shadow-gfs-card">
                            <AlertTriangle className="mx-auto h-12 w-12 text-rose-600 dark:text-rose-400 mb-4" />
                            <h2 className="text-2xl font-bold text-rose-900 dark:text-rose-200">Error loading samples</h2>
                            <p className="mt-2 text-rose-800 dark:text-rose-300 text-sm">Failed to fetch samples from the server. Please try again later.</p>
                        </div>
                    ) : (isLoading || !isDeferredMounted) ? (
                        <SampleTableSkeleton toolbar={tableToolbar} />
                    ) : (
                        <SampleTable 
                            toolbar={tableToolbar}
                            samples={filteredSamples} 
                            onSelectSample={handleSelectSample} 
                            isAdmin={isAdmin} 
                            isSelectionMode={isSelectionMode}
                            onBulkDeleteSamples={(sampleIds) => bulkDeleteSamplesMutation.mutate(sampleIds)} 
                            watchlistOnly={filters.watchlistOnly}
                            onToggleWatchlistOnly={() => {
                                console.log('SampleList: Toggling watchlistOnly from', filters.watchlistOnly);
                                setFilters({ ...filters, watchlistOnly: !filters.watchlistOnly });
                            }}
                        />
                    )}

                    {/* Sample Detail Modal */}
                    <SampleDetailModal
                        sample={selectedSample}
                        open={modalOpen}
                        onOpenChange={handleOpenChange}
                        onUpdateSample={handleUpdateSample}
                        onMycotoxinResultChange={handleMycotoxinResultChange}
                    />

                    {/* Admin Tools Floating Action Button */}
                    {isAdmin && (
                        <div className="fixed bottom-8 right-8 z-50">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        size="icon" 
                                        className="h-14 w-14 rounded-full bg-gfs-maroon hover:bg-gfs-maroon-hover text-white shadow-gfs-modal hover:scale-105 transition-all duration-300 group"
                                    >
                                        <Wrench className="h-6 w-6 transition-transform group-hover:rotate-45 duration-500 text-gfs-gold" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="top" sideOffset={15} className="w-[220px] p-2 rounded-gfs-card shadow-gfs-modal border border-gfs-maroon/20 bg-white dark:bg-slate-900 font-sans">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-colors hover:bg-gfs-maroon/10 hover:text-gfs-maroon text-gfs-text-primary dark:text-slate-200">
                                                <FlaskConical className="mr-2.5 h-4 w-4 text-gfs-maroon dark:text-gfs-gold" />
                                                Generate Test Data
                                            </div>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-gfs-maroon dark:text-white">Generate Test Samples?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs text-gfs-text-muted">
                                                    This will create <span className="font-bold text-gfs-text-primary dark:text-white">30 mock samples</span> (20 positive, 10 negative).
                                                    Safe for verifying analytics.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="rounded-md text-xs font-bold">Cancel</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    className="rounded-md text-xs font-bold bg-gfs-maroon hover:bg-gfs-maroon-hover text-white"
                                                    onClick={() => generateTestSamplesMutation.mutate(undefined)}
                                                >
                                                    Generate
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    <DropdownMenuSeparator className="my-1.5 bg-gfs-maroon/10" />
                                    
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-colors hover:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                                <Trash2 className="mr-2.5 h-4 w-4" />
                                                Purge Test Data
                                            </div>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-rose-600">Delete All Test Samples?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs text-gfs-text-muted">
                                                    Are you sure you want to delete <span className="font-bold text-rose-600">ALL samples</span> starting with the "TEST-" prefix?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="rounded-md text-xs font-bold">Cancel</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => deleteTestSamplesMutation.mutate()}
                                                    className="bg-rose-600 text-white hover:bg-rose-700 rounded-md text-xs font-bold"
                                                >
                                                    Delete All
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </>
            </main>
        </div>
    );
};

export default SampleList;
