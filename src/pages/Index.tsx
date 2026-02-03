import { useState, useMemo } from 'react';
import { FlaskConical, AlertTriangle, CheckCircle2, Clock, Download, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import FilterBar from '@/components/FilterBar';
import SampleTable from '@/components/SampleTable';
import SampleDetailModal from '@/components/SampleDetailModal';
import AddSampleForm from '@/components/AddSampleForm';
import RequestInvestigationForm from '@/components/RequestInvestigationForm';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockSamples as initialMockSamples } from '@/data/mockSamples';
import { Sample, FilterState, ProcessLog, RiskLevel } from '@/types/sample';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { isAdmin } = useAuth();
  const [samples, setSamples] = useState<Sample[]>(initialMockSamples);
  const [filters, setFilters] = useState<FilterState>({
    region: [],
    province: [],
    district: [],
    vegetation: [],
    status: [],
    risk: [],
    search: '',
  });

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
    return samples.filter((sample) => {
      if (filters.search && !sample.sample_id.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.region.length > 0 && !filters.region.includes(sample.region)) return false;
      if (filters.vegetation.length > 0 && !filters.vegetation.includes(sample.vegetation_variety)) return false;
      if (filters.status.length > 0 && !filters.status.includes(sample.status)) return false;
      if (filters.risk.length > 0 && !filters.risk.includes(getRiskLevel(sample))) return false;
      return true;
    });
  }, [filters, samples]);

  // Get export data
  const getExportData = () => {
    const headers = ['Sample ID', 'Region', 'Province', 'District', 'Variety', 'Collection Date', 'Status', 'Risk Level', 'Last Updated By'];
    
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

  const handleUpdateSample = (sampleId: string, newLog: ProcessLog) => {
    setSamples(prevSamples => 
      prevSamples.map(sample => {
        if (sample.sample_id === sampleId) {
          const newStatus = getStatusFromProcessState(newLog.state);
          const updatedSample = {
            ...sample,
            status: newStatus,
            process_logs: [...sample.process_logs, newLog],
          };
          // Update selected sample to reflect changes
          setSelectedSample(updatedSample);
          return updatedSample;
        }
        return sample;
      })
    );
  };

  const handleAddSample = (sample: Sample) => {
    setSamples(prevSamples => [sample, ...prevSamples]);
  };

  const handleAddMultipleSamples = (newSamples: Sample[]) => {
    setSamples(prevSamples => [...newSamples, ...prevSamples]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Sample Tracking Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Monitor and analyze mycotoxin testing results across agricultural samples
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Samples"
            value={stats.total}
            icon={FlaskConical}
            trend="All collected samples"
          />
          <StatsCard
            title="Flagged (High Risk)"
            value={stats.flagged}
            icon={AlertTriangle}
            variant="danger"
            trend="Require immediate attention"
          />
          <StatsCard
            title="Completed Tests"
            value={stats.completed}
            icon={CheckCircle2}
            variant="success"
            trend="Successfully analyzed"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgress}
            icon={Clock}
            variant="warning"
            trend="Awaiting results"
          />
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
          </p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
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
            {!isAdmin && <RequestInvestigationForm />}
            {isAdmin && (
              <AddSampleForm 
                onAddSample={handleAddSample}
                onAddMultipleSamples={handleAddMultipleSamples}
              />
            )}
          </div>
        </div>

        {/* Sample Table */}
        <SampleTable samples={filteredSamples} onSelectSample={handleSelectSample} />

        {/* Sample Detail Modal */}
        <SampleDetailModal
          sample={selectedSample}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onUpdateSample={handleUpdateSample}
        />
      </main>
    </div>
  );
};

export default Index;
