import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, AlertTriangle, CheckCircle2, Clock, Download, ChevronDown, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import FilterBar from '@/components/FilterBar';
import SampleTable from './SampleTable';
import SampleDetailModal from './SampleDetailModal';
import AddSampleForm from './AddSampleForm';
import RequestInvestigationForm from './RequestInvestigationForm';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sample, FilterState, ProcessLog, RiskLevel } from '@/types/sample';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/hooks/useWatchlist';
import { USER_ROLE_WEIGHT } from '@/types/user';
import { sampleAPI } from '@/lib/api';

const SampleList = () => {
    const { isAdmin, isAuthenticated, role } = useAuth();
    const navigate = useNavigate();
    const { isWatching } = useWatchlist();
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
                vegetation: filters.vegetation.length ? filters.vegetation[0] : undefined,
                riskLevel: filters.risk.length ? filters.risk : undefined,
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
            }),
        enabled: isAuthenticated,
        staleTime: 30000,
    });

    const samples: Sample[] = samplesData?.results || samplesData || [];

    // mutations for creation - invalidate both list and dashboard queries
    const createSampleMutation = useMutation({
        mutationFn: (data: Partial<Sample>) => sampleAPI.createSample(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
        },
    });

    const createManyMutation = useMutation({
        mutationFn: (newSamples: Sample[]) => Promise.all(newSamples.map(s => sampleAPI.createSample(s))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['samples-list'] });
            queryClient.invalidateQueries({ queryKey: ['samples-dashboard'] });
        },
    });

    const handleAddSample = (sample: Sample) => {
        createSampleMutation.mutate(sample, {
            onSuccess: () => {
                toast({
                    title: 'Sample Registered',
                    description: `Sample ${sample.sample_id} added successfully.`,
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
            onError: () => {
                toast({
                    title: 'Error',
                    description: 'Failed to import samples.',
                    variant: 'destructive',
                });
            },
        });
    };

    // Calculate risk level for a sample
    const getRiskLevel = (sample: Sample): RiskLevel => {
        if (sample.mycotoxin_results.length === 0) return 'safe';
        const hasDangerous = sample.mycotoxin_results.some(r => r.dangerous);
        if (hasDangerous) return 'high';
        const maxIntensity = Math.max(...sample.mycotoxin_results.map(r => r.intensity));
        if (maxIntensity >= 7) return 'medium';
        if (maxIntensity >= 4) return 'low';
        return 'safe';
    };

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

        const rows = filteredSamples.map(sample => {
            const lastLog = sample.process_logs[sample.process_logs.length - 1];
            return [
                sample.sample_id,
                sample.region,
                sample.province,
                sample.district,
                sample.vegetation_variety,
                sample.collection_date,
                sample.status,
                getRiskLevel(sample),
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
    const handleExportXLSX = () => {
        const { headers, rows } = getExportData();

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Samples');

        // Auto-size columns
        const colWidths = headers.map((header, i) => {
            const maxDataWidth = Math.max(...rows.map(row => String(row[i]).length));
            return { wch: Math.max(header.length, maxDataWidth) + 2 };
        });
        worksheet['!cols'] = colWidths;

        XLSX.writeFile(workbook, `samples_export_${new Date().toISOString().split('T')[0]}.xlsx`);

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
        setSelectedSample(sample);
        setModalOpen(true);
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

    return (
        <div className="min-h-screen bg-background">
            <Header />

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
                        <RequestInvestigationForm />
                        {isAuthenticated && USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] >= USER_ROLE_WEIGHT['research_assistant'] && (
                            <AddSampleForm
                                onAddSample={handleAddSample}
                                onAddMultipleSamples={handleAddMultipleSamples}
                            />
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
                    ) : isLoading ? (
                        <div className="flex items-center justify-center h-96">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <SampleTable samples={filteredSamples} onSelectSample={handleSelectSample} />
                    )}

                    {/* Sample Detail Modal */}
                    <SampleDetailModal
                        sample={selectedSample}
                        open={modalOpen}
                        onOpenChange={setModalOpen}
                        onUpdateSample={handleUpdateSample}
                    />
                </>
            </main>
        </div>
    );
};

export default SampleList;
