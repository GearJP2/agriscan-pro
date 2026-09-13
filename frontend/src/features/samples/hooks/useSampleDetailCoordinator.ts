import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { sampleAPI } from '@/lib/api';
import type { Sample } from '@/types/sample';

export interface SampleDetailCoordinatorOptions {
  getSampleDetail?: (sampleId: string, signal?: AbortSignal) => Promise<Sample>;
  invalidateSampleData?: () => void;
  onSelectedSampleChange?: (sample: Sample | null) => void;
  onModalOpenChange?: (open: boolean) => void;
}

export class SampleDetailCoordinator {
  private activeSampleId: string | null = null;
  private detailRequestId = 0;
  private detailAbortController: AbortController | null = null;
  private selectedSample: Sample | null = null;
  private modalOpen = false;
  private options: SampleDetailCoordinatorOptions;

  constructor(options: SampleDetailCoordinatorOptions = {}) {
    this.options = { ...options };
  }

  updateOptions(options: Partial<SampleDetailCoordinatorOptions>): void {
    Object.assign(this.options, options);
  }

  getActiveSampleId(): string | null {
    return this.activeSampleId;
  }

  getSelectedSample(): Sample | null {
    return this.selectedSample;
  }

  setSelectedSample(sample: Sample | null): void {
    this.selectedSample = sample;
    this.options.onSelectedSampleChange?.(sample);
  }

  isModalOpen(): boolean {
    return this.modalOpen;
  }

  getAbortController(): AbortController | null {
    return this.detailAbortController;
  }

  getRequestId(): number {
    return this.detailRequestId;
  }

  selectSample(sample: Sample, currentList?: Sample[]): void {
    const currentSample = currentList?.find((s) => s.sample_id === sample.sample_id) || sample;

    if (this.detailAbortController) {
      this.detailAbortController.abort();
    }
    const controller = new AbortController();
    this.detailAbortController = controller;
    const currentRequestId = ++this.detailRequestId;

    this.activeSampleId = currentSample.sample_id;
    this.setSelectedSample(currentSample);
    this.modalOpen = true;
    this.options.onModalOpenChange?.(true);

    const getDetail = this.options.getSampleDetail || sampleAPI.getSampleDetail;
    getDetail(currentSample.sample_id, controller.signal)
      .then((updatedSample) => {
        if (
          currentRequestId === this.detailRequestId &&
          this.activeSampleId === currentSample.sample_id
        ) {
          this.setSelectedSample(updatedSample);
        }
      })
      .catch((err) => {
        if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
          return;
        }
        console.error('Failed to fetch sample details:', err);
      });
  }

  async handleMycotoxinResultChange(sampleId: string): Promise<void> {
    this.options.invalidateSampleData?.();
    if (this.activeSampleId !== sampleId) {
      return;
    }
    if (this.detailAbortController) {
      this.detailAbortController.abort();
    }
    const controller = new AbortController();
    this.detailAbortController = controller;
    const currentRequestId = ++this.detailRequestId;
    try {
      const getDetail = this.options.getSampleDetail || sampleAPI.getSampleDetail;
      const updated = await getDetail(sampleId, controller.signal);
      if (currentRequestId === this.detailRequestId && this.activeSampleId === sampleId) {
        this.setSelectedSample(updated);
      }
    } catch (err) {
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
        return;
      }
      console.error('Failed to refresh sample after mycotoxin result change:', err);
    }
  }

  handleOpenChange(open: boolean): void {
    this.modalOpen = open;
    this.options.onModalOpenChange?.(open);
    if (!open) {
      if (this.detailAbortController) {
        this.detailAbortController.abort();
        this.detailAbortController = null;
      }
      this.detailRequestId += 1;
      this.activeSampleId = null;
      this.setSelectedSample(null);
    }
  }
}

export interface UseSampleDetailCoordinatorProps {
  samples: Sample[];
  invalidateSampleData: () => void;
  getSampleDetail?: (sampleId: string, signal?: AbortSignal) => Promise<Sample>;
}

export function useSampleDetailCoordinator({
  samples,
  invalidateSampleData,
  getSampleDetail,
}: UseSampleDetailCoordinatorProps) {
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const coordinatorRef = useRef<SampleDetailCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new SampleDetailCoordinator({
      getSampleDetail,
      invalidateSampleData,
      onSelectedSampleChange: setSelectedSample,
      onModalOpenChange: setModalOpen,
    });
  }

  coordinatorRef.current.updateOptions({
    getSampleDetail,
    invalidateSampleData,
    onSelectedSampleChange: setSelectedSample,
    onModalOpenChange: setModalOpen,
  });

  const handleSelectSample = useCallback(
    (sample: Sample) => {
      coordinatorRef.current?.selectSample(sample, samples);
    },
    [samples]
  );

  const handleMycotoxinResultChange = useCallback(async (sampleId: string) => {
    await coordinatorRef.current?.handleMycotoxinResultChange(sampleId);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    coordinatorRef.current?.handleOpenChange(open);
  }, []);

  return {
    selectedSample,
    setSelectedSample,
    modalOpen,
    setModalOpen,
    handleSelectSample,
    handleMycotoxinResultChange,
    handleOpenChange,
    coordinator: coordinatorRef.current,
  };
}
