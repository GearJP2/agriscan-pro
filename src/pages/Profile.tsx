import { useState } from 'react';
import { X } from 'lucide-react';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const Profile = () => {
  const { user, role } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || 'Your name',
    email: 'yourname@gmail.com',
    mobile: '',
    location: 'TH',
  });

  const handleSave = () => {
    toast({
      title: 'Profile Updated',
      description: 'Your profile has been saved successfully.',
    });
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    user: 'User',
    researcher: 'Researcher',
    research_assistant: 'Research Assistant (RA)',
    head_researcher: 'Head Researcher (HR)',
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-2xl">
        <Card className="glass-card">
          <CardContent className="p-0">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src="" alt={formData.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {formData.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{formData.name}</h2>
                  <p className="text-sm text-muted-foreground">{formData.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Profile Fields */}
            <div className="p-6 space-y-6">
              {/* Name */}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Name</span>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-48 text-right border-none bg-transparent text-foreground"
                  placeholder="your name"
                />
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Email account</span>
                <span className="text-sm text-foreground">{formData.email}</span>
              </div>

              {/* Mobile */}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Mobile number</span>
                <Input
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-48 text-right border-none bg-transparent text-foreground"
                  placeholder="Add number"
                />
              </div>

              {/* Location */}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Location</span>
                <span className="text-sm text-foreground">{formData.location}</span>
              </div>

              {/* Role */}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="text-sm font-medium text-foreground">
                  {roleLabels[role] || 'User'}
                </span>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
                  Save Change
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
