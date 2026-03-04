import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getAllRegions, getProvincesByRegion, getDistrictsByProvince } from '@/data/thailandLocations';

interface InvestigationRequest {
  id: string;
  requesterName: string;
  region: string;
  province: string;
  district: string;
  reason: string;
  vegetationType: string;
  submittedAt: string;
}

interface RequestInvestigationFormProps {
  onSubmitRequest?: (request: InvestigationRequest) => void;
}

const vegetationTypes = ['Rice', 'Corn', 'Wheat', 'Cassava', 'Peanut', 'Soybean', 'Other'];

const RequestInvestigationForm = ({ onSubmitRequest }: RequestInvestigationFormProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    requesterName: '',
    region: '',
    province: '',
    district: '',
    vegetationType: '',
    reason: '',
  });
  const regions = getAllRegions();
  const availableProvinces = formData.region ? getProvincesByRegion(formData.region) : [];
  const availableDistricts = formData.province ? getDistrictsByProvince(formData.province) : [];

  const handleRegionChange = (region: string) => {
    setFormData(prev => ({ ...prev, region, province: '', district: '' }));
  };

  const handleProvinceChange = (province: string) => {
    setFormData(prev => ({ ...prev, province, district: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.requesterName.trim() || !formData.region || !formData.province || !formData.reason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const request: InvestigationRequest = {
      id: `REQ-${Date.now()}`,
      requesterName: formData.requesterName.trim(),
      region: formData.region,
      province: formData.province,
      district: formData.district,
      vegetationType: formData.vegetationType,
      reason: formData.reason.trim(),
      submittedAt: new Date().toISOString(),
    };

    onSubmitRequest?.(request);

    toast({
      title: 'Investigation Request Submitted',
      description: `Your request for investigation in ${formData.province}${formData.district ? `, ${formData.district}` : ''} has been submitted successfully.`,
    });

    // Reset form
    setFormData({
      requesterName: '',
      region: '',
      province: '',
      district: '',
      vegetationType: '',
      reason: '',
    });
    setOpen(false);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (newOpen && !isAuthenticated) {
        window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          Request Investigation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Request Sample Investigation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Requester Name */}
          <div className="space-y-2">
            <Label htmlFor="requesterName">Your Name *</Label>
            <Input
              id="requesterName"
              placeholder="Enter your name"
              value={formData.requesterName}
              onChange={(e) => setFormData(prev => ({ ...prev, requesterName: e.target.value }))}
              maxLength={100}
            />
          </div>

          {/* Location Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location *
            </Label>

            <Select value={formData.region} onValueChange={handleRegionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={formData.province}
              onValueChange={handleProvinceChange}
              disabled={!formData.region}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Province" />
              </SelectTrigger>
              <SelectContent>
                {availableProvinces.map(province => (
                  <SelectItem key={province} value={province}>{province}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={formData.district}
              onValueChange={(district) => setFormData(prev => ({ ...prev, district }))}
              disabled={!formData.province}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select District (Optional)" />
              </SelectTrigger>
              <SelectContent>
                {availableDistricts.map(district => (
                  <SelectItem key={district} value={district}>{district}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vegetation Type */}
          <div className="space-y-2">
            <Label>Crop/Vegetation Type</Label>
            <Select
              value={formData.vegetationType}
              onValueChange={(vegetationType) => setFormData(prev => ({ ...prev, vegetationType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type (Optional)" />
              </SelectTrigger>
              <SelectContent>
                {vegetationTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reason for Investigation *
            </Label>
            <Textarea
              id="reason"
              placeholder="Please describe why you are requesting this investigation (e.g., suspected contamination, health concerns, routine check)"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.reason.length}/1000 characters
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RequestInvestigationForm;
