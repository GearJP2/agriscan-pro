import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Check, ChevronsUpDown, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { sampleAPI } from '@/lib/api';
import { useMycotoxinRegistry } from '@/hooks/useMycotoxinRegistry';
import { cn } from '@/lib/utils';

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
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const { data: registry, isPending, isError, refetch } = useMycotoxinRegistry();

  const toxinOptions = Object.entries(registry ?? {})
    .map(([value, toxin]) => ({
      value,
      label: toxin.name,
      shortName: toxin.shortName || value,
      isUncertain: toxin.isUncertain || toxin.defaultThreshold === null,
      defaultThreshold: toxin.defaultThreshold,
      unit: toxin.unit,
      source: toxin.source,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const form = useForm<MycotoxinFormData>({
    resolver: zodResolver(mycotoxinSchema),
    defaultValues: {
      toxin_type: '',
      value: 0,
      unit: 'ug_kg',
      notes: '',
    },
  });

  const selectedToxinType = form.watch('toxin_type');
  const selectedToxinMeta = registry && selectedToxinType ? registry[selectedToxinType] : null;

  // Auto-clear selection if current selected toxin was removed from registry
  useEffect(() => {
    if (selectedToxinType && registry && !Object.prototype.hasOwnProperty.call(registry, selectedToxinType)) {
      form.setValue('toxin_type', '');
    }
  }, [registry, selectedToxinType, form]);

  const onSubmit = async (data: MycotoxinFormData) => {
    if (!registry || !Object.prototype.hasOwnProperty.call(registry, data.toxin_type)) {
      form.setError('toxin_type', { message: 'Select a currently available toxin.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await sampleAPI.addMycotoxinResult(sampleId, data);
      const toxinLabel =
        toxinOptions.find((option) => option.value === data.toxin_type)?.label ??
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
        <h3 className="text-lg font-semibold text-foreground">บันทึกผลตรวจ (Record Test Result)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          บันทึกผลการวิเคราะห์สารพิษจากเชื้อราสำหรับตัวอย่างนี้ (Select toxin and record concentration)
        </p>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground rounded-lg border border-border bg-muted/20" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>กำลังโหลดรายชื่อสารพิษจากระบบ (Loading toxin types)...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between gap-3 p-4 text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>ไม่สามารถโหลดรายชื่อสารพิษได้ (Unable to load toxin types)</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="gap-1.5 h-8 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {registry && toxinOptions.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground rounded-lg border border-dashed border-border text-center" role="status">
          ไม่มีชนิดสารพิษที่เปิดให้บันทึกในระบบในขณะนี้ (No toxin types currently available)
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="toxin_type"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>ชนิดสารพิษ (Toxin Type) *</FormLabel>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        disabled={isSubmitting || !registry || toxinOptions.length === 0}
                        className={cn(
                          "w-full justify-between font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? `${field.value} - ${toxinOptions.find(opt => opt.value === field.value)?.label ?? field.value}`
                          : "ค้นหาหรือเลือกสารพิษ (Search or select toxin...)"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหารหัส หรือชื่อเต็ม (Search code or name)..." />
                      <CommandList>
                        <CommandEmpty>ไม่พบสารพิษที่ค้นหา (No toxin found)</CommandEmpty>
                        <CommandGroup>
                          {toxinOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={`${option.value} ${option.label}`}
                              onSelect={() => {
                                field.onChange(option.value);
                                setComboboxOpen(false);
                              }}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    "h-4 w-4 text-primary",
                                    field.value === option.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-foreground text-xs">{option.value}</span>
                                    <span className="text-xs text-muted-foreground">• {option.label}</span>
                                  </div>
                                </div>
                              </div>
                              {option.isUncertain && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/30">
                                  ไม่มีเกณฑ์
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Metadata banner for selected toxin */}
          {selectedToxinMeta && (
            <div className={cn(
              "rounded-lg p-3.5 border text-xs transition-all space-y-1.5",
              selectedToxinMeta.isUncertain || selectedToxinMeta.defaultThreshold === null
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-muted/40 border-border text-foreground"
            )}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{selectedToxinMeta.name} ({selectedToxinType})</span>
                {selectedToxinMeta.isUncertain || selectedToxinMeta.defaultThreshold === null ? (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px] font-bold">
                    ไม่มีข้อมูลเกณฑ์
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    เกณฑ์เริ่มต้น: {selectedToxinMeta.defaultThreshold} {selectedToxinMeta.unit}
                  </Badge>
                )}
              </div>
              {selectedToxinMeta.isUncertain || selectedToxinMeta.defaultThreshold === null ? (
                <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    <strong>ไม่มีข้อมูลเกณฑ์ (No threshold data):</strong> สารนี้ยังไม่มีเกณฑ์ควบคุมเฉพาะในระบบ ผลการตรวจวัดจะไม่ถูกตีความว่าปลอดภัยโดยอัตโนมัติ (Unclassified)
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  เกณฑ์ควบคุม EU: {selectedToxinMeta.defaultThreshold} {selectedToxinMeta.unit}
                  {selectedToxinMeta.maxThreshold !== null ? ` (เกณฑ์สูงสุด: ${selectedToxinMeta.maxThreshold} ${selectedToxinMeta.unit})` : ''} • แหล่งอ้างอิง: {selectedToxinMeta.source}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ค่าความเข้มข้นที่วัดได้ (Concentration) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      {...field}
                      disabled={isSubmitting || !registry || toxinOptions.length === 0}
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
                  <FormLabel>หน่วย (Unit) *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting || !registry || toxinOptions.length === 0}>
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

          <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              การประเมินระดับความเสี่ยง (Risk Assessment)
            </p>
            <p>
              ระบบคำนวณความเสี่ยงที่ฝั่งเซิร์ฟเวอร์โดยเปรียบเทียบกับเกณฑ์ snapshot ล่าสุด สารที่ไม่มีเกณฑ์จะแสดงสถานะ Unclassified
            </p>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมายเหตุ / ข้อมูลเพิ่มเติม (Notes - Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="หมายเหตุทางห้องปฏิบัติการ หรือบริบทการตรวจ..."
                    {...field}
                    disabled={isSubmitting || !registry || toxinOptions.length === 0}
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
              disabled={isSubmitting || !registry || toxinOptions.length === 0}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึกผลตรวจ (Add Result)
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
