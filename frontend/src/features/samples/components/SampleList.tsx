import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, ChevronDown, Loader2, ShieldCheck, Wrench, FlaskConical, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import StatsCard from '@/components/StatsCard';
import FilterBar from '@/components/FilterBar';
import SampleTable from './SampleTable';
import SampleDetailModal from './SampleDetailModal';
import AddSampleForm from './AddSampleForm';
import RequestInvestigationForm from './RequestInvestigationForm';
import ImportResultsForm from './ImportResultsForm';
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
import { Sample, FilterState, ProcessLog } from '@/types/sample';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/hooks/useWatchlist';
import { USER_ROLE_WEIGHT } from '@/types/user';
import { sampleAPI } from '@/lib/api';
import { getThresholdRiskLevel } from '@/lib/mycotoxinRisk';
import { AxiosError } from 'axios';

import { useDeferredMount } from '@/hooks/useDeferredMount';

const SampleList = () => {
    const { isAdmin, isAuthenticated, role } = useAuth();
    const isDeferredMounted = useDeferredMount(200); // Sample list is lighter than dashboard, so 200ms is enough
    const navigate = useNavigate();
    const { isWatching } = useWatchlist();
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        region: [],
        province: [],
        district: [],
        vegetation: [],
        status: [],
        risk: [],
        search: '',
        watchlistOnly: false,
        dateFrom: null,
        dateTo: null,
    });

    const queryClient = useQueryClient();

    // mutations for creation - invalidate both list and dashboard queries
    const createSampleMutation = useMutation({
        mutationFn: (data: Partial<Sample>) => sampleAPI.createSample(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
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
                vegetation_variety: sample.vegetation_variety,
                collection_date: sample.collection_date,
                status: sample.status || 'pending',
                purpose: sample.purpose || undefined,
                sample_type: sample.sample_type || undefined,
                processing_type: sample.processing_type || undefined,
                collected_by: sample.collected_by || undefined,
                additional_info: sample.additional_info || '',
            }));
            return sampleAPI.bulkCreateSamples(cleanedSamples);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
        },
    });

    const bulkDeleteSamplesMutation = useMutation({
        mutationFn: (sampleIds: string[]) => sampleAPI.bulkDeleteSamples(sampleIds),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
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
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
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
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
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
        queryKey: ['samples-list', filters],
        queryFn: () =>
            sampleAPI.getSamples(undefined, 100, {
                search: filters.search || undefined,
                status: filters.status.length ? filters.status : undefined,
                region: filters.region.length ? filters.region[0] : undefined,
                province: filters.province.length ? filters.province[0] : undefined,
                vegetation: filters.vegetation.length ? filters.vegetation[0] : undefined,
                riskLevel: filters.risk.length ? filters.risk : undefined,
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
            }),
        enabled: isAuthenticated,
        staleTime: 30000,
    });

    const samples = useMemo<Sample[]>(() => {
        return samplesData?.results || samplesData || [];
    }, [samplesData]);
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const filteredSamples = useMemo(() => {
        // backend already handles most filters; only watchlist is applied client‑side
        if (filters.watchlistOnly) {
            return samples.filter(s => isWatching(s.sample_id));
        }
        return samples;
    }, [filters, samples, isWatching]);

    // Get export data
    const getExportData = () => {
        const headers = ['Sample ID', 'Region', 'Province', 'District', 'Variety', 'Collection Date', 'Status', 'Risk Level', 'Purpose', 'Type', 'Collected By', 'Additional Info', 'Last Updated By'];

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
                sample.vegetation_variety,
                sample.collection_date,
                sample.status,
                getThresholdRiskLevel(sample),
                sample.purpose || '-',
                sample.sample_type || '-',
                sample.collected_by || '-',
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
        return { total, flagged, completed, inProgress };
    }, [samples]);

    const handleSelectSample = (sample: Sample) => {
        // Find the latest sample data from the samples list to ensure we show current data
        const currentSample = samples.find(s => s.sample_id === sample.sample_id) || sample;
        setSelectedSample(currentSample);
        setModalOpen(true);
        
        // Refetch the individual sample to ensure latest process logs and data
        sampleAPI.getSampleDetail(currentSample.sample_id).then(updatedSample => {
            setSelectedSample(updatedSample);
        }).catch(err => {
            console.error('Failed to fetch sample details:', err);
        });
    };

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
        queryClient.invalidateQueries({ queryKey: ['samples-list'] });
        queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
    };

    const handleImportResultsSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['samples-list'] });
        queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
    };

    const handleMycotoxinResultChange = async (sampleId: string) => {
        queryClient.invalidateQueries({ queryKey: ['samples-list'] });
        queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
        try {
            const updated = await sampleAPI.getSampleDetail(sampleId);
            setSelectedSample(updated);
        } catch (err) {
            console.error('Failed to refresh sample after mycotoxin result change:', err);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="container py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Sample List</h1>
                    <p className="mt-2 text-muted-foreground">
                        Detailed list of all collected agricultural samples and their status
                    </p>
                </div>

                {/* Filters */}
                <div className="mb-6">
                    <FilterBar filters={filters} onFilterChange={setFilters} />
                </div>

                {/* Results Summary */}
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{filteredSamples.length}</span> of{' '}
                        <span className="font-semibold text-foreground">{samples.length}</span> samples
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin inline" />}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={isSelectionMode ? "default" : "outline"}
                            className={cn(
                                "gap-2 transition-all duration-200",
                                isSelectionMode ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20" : ""
                            )}
                            onClick={() => setIsSelectionMode(!isSelectionMode)}
                        >
                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isSelectionMode ? "rotate-180" : "")} />
                            {isSelectionMode ? 'Exit Selection' : 'Select Samples'}
                        </Button>
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
                                    className="gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Export
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExportCSV}>
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportXLSX}>
                                    Export as Excel (XLSX)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <ImportResultsForm
                            sampleIds={filteredSamples.map((sample) => sample.sample_id)}
                            onSuccess={handleImportResultsSuccess}
                        />
                        <RequestInvestigationForm />
                        {isAuthenticated && USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] >= USER_ROLE_WEIGHT['research_assistant'] && (
                            <AddSampleForm
                                onAddSample={handleAddSample}
                                onAddMultipleSamples={handleAddMultipleSamples}
                            />
                        )}
                        
                        {isAdmin && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/40 bg-primary/5">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        Admin Tools
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                                                <FlaskConical className="mr-2 h-4 w-4" />
                                                Generate Test Data
                                            </div>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Generate Test Samples?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will create <span className="font-bold text-foreground">30 mock samples</span> (20 positive, 10 negative) with the "TEST-" prefix. 
                                                    This is safe for production use as it helps verify analytics and filters.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => generateTestSamplesMutation.mutate(undefined)}>
                                                    Generate
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    <DropdownMenuSeparator />
                                    
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Purge Test Data
                                            </div>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete All Test Samples?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete <span className="font-bold text-destructive">ALL samples</span> starting with the "TEST-" prefix? 
                                                    This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => deleteTestSamplesMutation.mutate()}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Delete All
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Sample Table */}
                <>
                    {error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
                            <h2 className="text-2xl font-bold text-red-900">Error loading samples</h2>
                            <p className="mt-2 text-red-800">Failed to fetch samples from the server. Please try again later.</p>
                        </div>
                    ) : (isLoading || !isDeferredMounted) ? (
                        <div className="flex flex-col items-center justify-center h-96 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading sample records...</p>
                        </div>
                    ) : (
                        <SampleTable 
                            samples={filteredSamples} 
                            onSelectSample={handleSelectSample} 
                            isAdmin={isAdmin} 
                            isSelectionMode={isSelectionMode}
                            onBulkDeleteSamples={(sampleIds) => bulkDeleteSamplesMutation.mutate(sampleIds)} 
                        />
                    )}

                    {/* Sample Detail Modal */}
                    <SampleDetailModal
                        sample={selectedSample}
                        open={modalOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setSelectedSample(null);
                            }
                            setModalOpen(open);
                        }}
                        onUpdateSample={handleUpdateSample}
                        onMycotoxinResultChange={handleMycotoxinResultChange}
                    />
                </>
            </main>
        </div>
    );
};

export default SampleList;
