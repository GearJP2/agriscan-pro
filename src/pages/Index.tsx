import { useState, useMemo } from 'react';
import { FlaskConical, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import FilterBar from '@/components/FilterBar';
import SampleTable from '@/components/SampleTable';
import SampleDetailModal from '@/components/SampleDetailModal';
import AddSampleForm from '@/components/AddSampleForm';
import { mockSamples as initialMockSamples } from '@/data/mockSamples';
import { Sample, FilterState, ProcessLog } from '@/types/sample';

const Index = () => {
  const [samples, setSamples] = useState<Sample[]>(initialMockSamples);
  const [filters, setFilters] = useState<FilterState>({
    region: [],
    province: [],
    district: [],
    vegetation: [],
    status: [],
    search: '',
  });
  
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
      return true;
    });
  }, [filters, samples]);

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
      case 'notified':
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
          <AddSampleForm 
            onAddSample={handleAddSample}
            onAddMultipleSamples={handleAddMultipleSamples}
          />
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
