import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const mycotoxinSchema = z.object({
  name: z.string().min(1, 'Toxin name is required'),
  intensity: z.coerce.number()
    .min(0, 'Concentration must be 0 or higher'),
  threshold: z.coerce.number().positive('Threshold must be a positive number'),
  unit: z.string().min(1, 'Unit is required'),
  dangerous: z.boolean().default(false),
  test_method: z.string().optional(),
  sop_link: z.string().url('Must be a valid URL').or(z.literal('')),
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
      name: '',
      intensity: 0,
      threshold: 10,
      unit: 'ppb',
      dangerous: false,
      test_method: '',
      sop_link: '',
    },
  });

  const intensity = form.watch('intensity');
  const threshold = form.watch('threshold');
  const isDangerous = intensity > threshold;

  const onSubmit = async (data: MycotoxinFormData) => {
    setIsSubmitting(true);
    try {
      // Update dangerous flag based on intensity vs threshold
      const submissionData = {
        ...data,
        dangerous: isDangerous,
      };

      await sampleAPI.addMycotoxinResult(sampleId, submissionData);
      
      toast({
        title: 'Result Added',
        description: `${data.name} result recorded successfully.`,
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
          {/* Toxin Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Toxin Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Aflatoxin B1" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Concentration */}
            <FormField
              control={form.control}
              name="intensity"
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

            {/* Threshold */}
            <FormField
              control={form.control}
              name="threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Threshold Level *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 10"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit */}
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
                        <SelectItem value="ppb">ppb (Part per billion)</SelectItem>
                        <SelectItem value="ppm">ppm (Part per million)</SelectItem>
                        <SelectItem value="ng/ml">ng/ml</SelectItem>
                        <SelectItem value="μg/kg">μg/kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Risk Indicator */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Result Status</span>
              {isDangerous ? (
                <div className="flex items-center gap-2 rounded-full bg-danger/10 px-3 py-1">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  <span className="text-sm font-semibold text-danger">Exceeds Threshold</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold text-success">Within Limits</span>
                </div>
              )}
            </div>
          </div>

          {/* Test Method (Optional) */}
          <FormField
            control={form.control}
            name="test_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Test Method (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., HPLC-FLD" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* SOP Link (Optional) */}
          <FormField
            control={form.control}
            name="sop_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SOP Link (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/sop" 
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
