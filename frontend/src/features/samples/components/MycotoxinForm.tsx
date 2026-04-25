import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';

const TOXIN_OPTIONS = [
  { value: 'AFB1', label: 'Aflatoxin B1' },
  { value: 'DON', label: 'Deoxynivalenol' },
  { value: 'FB1', label: 'Fumonisin B1' },
  { value: 'ZEA', label: 'Zearalenone' },
  { value: 'OTA', label: 'Ochratoxin A' },
  { value: 'T-2', label: 'T-2 Toxin' },
  { value: 'AFG1', label: 'Aflatoxin G1' },
  { value: 'AFG2', label: 'Aflatoxin G2' },
  { value: 'AFM1', label: 'Aflatoxin M1' },
] as const;

const mycotoxinSchema = z.object({
  toxin_type: z.string().min(1, 'Toxin type is required'),
  value: z.coerce.number().min(0, 'Concentration must be 0 or higher'),
  unit: z.enum(['ug_kg', 'ng_g', 'ppb']),
  notes: z.string().optional(),
});

type MycotoxinFormData = z.infer<typeof mycotoxinSchema>;

interface MycotoxinFormProps {
  sampleId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

const MycotoxinForm = ({ sampleId, onSuccess, onClose }: MycotoxinFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MycotoxinFormData>({
    resolver: zodResolver(mycotoxinSchema),
    defaultValues: {
      toxin_type: '',
      value: 0,
      unit: 'ug_kg',
      notes: '',
    },
  });

  const onSubmit = async (data: MycotoxinFormData) => {
    setIsSubmitting(true);
    try {
      const result = await sampleAPI.addMycotoxinResult(sampleId, data);
      const toxinLabel =
        TOXIN_OPTIONS.find((option) => option.value === data.toxin_type)?.label ??
        data.toxin_type;
      
      toast({
        title: 'Result Saved',
        description: `${toxinLabel} recorded as ${result.risk_level ?? 'pending review'}.`,
      });

      form.reset();
      onSuccess?.();
      onClose?.();
    } catch (error: any) {
      const errorMsg = error?.response?.data ? JSON.stringify(error.response.data) : 'Failed to add result';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      console.error('Add mycotoxin error:', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Record Test Result</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a mycotoxin test result for this sample
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="toxin_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Toxin Type *</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select toxin" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOXIN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.value} - {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Measured Concentration *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ug_kg">ug/kg</SelectItem>
                        <SelectItem value="ng_g">ng/g</SelectItem>
                        <SelectItem value="ppb">ppb</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              Risk is calculated by the server
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The API will store EU threshold snapshots and return the final
              risk level after this result is saved.
            </p>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional lab notes or import context"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Result
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};

export default MycotoxinForm;
