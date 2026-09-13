import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '@/lib/api';

const registrySchema = z.record(z.object({
  name: z.string(),
  shortName: z.string(),
  defaultThreshold: z.number().finite().nonnegative().nullable(),
  maxThreshold: z.number().finite().nonnegative().nullable(),
  unit: z.string(),
  source: z.string(),
  isUncertain: z.boolean(),
}));

export function useMycotoxinRegistry() {
  return useQuery({
    queryKey: ['mycotoxin-registry'],
    queryFn: async () => {
      const response = await apiClient.get('/samples/mycotoxin-registry/');
      return registrySchema.parse(response.data);
    },
    retry: 1,
  });
}
