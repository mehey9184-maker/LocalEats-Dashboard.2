import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, Edit2, MapPin, Bell, Moon, CheckCircle2 } from 'lucide-react';

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  marketing: boolean;
  darkMode: boolean;
  operatingHours: {
    open: string;
    close: string;
  };
}

interface EditProfileProps {
  onBack: () => void;
  onSave: (data: ProfileData) => void;
  initialData?: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    address: string;
    operatingHours?: {
      open: string;
      close: string;
    };
  };
}

export const EditProfile: React.FC<EditProfileProps> = ({ onBack, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    location: initialData?.location || '',
    address: initialData?.address || '',
  });

  const [operatingHours, setOperatingHours] = useState({
    open: initialData?.operatingHours?.open || '08:00',
    close: initialData?.operatingHours?.close || '20:00',
  });

  const [preferences, setPreferences] = useState({
    marketing: true,
    darkMode: false,
  });

  const handleSave = () => {
    onSave({ ...formData, ...preferences, operatingHours });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-24 selection:bg-primary/10 selection:text-primary">
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="active:scale-95 transition-transform duration-200 hover:opacity-80 p-2 rounded-full hover:bg-surface-container-low"
            >
              <ArrowLeft className="text-primary" size={24} />
            </button>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">Edit Profile</h1>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
            <MoreVertical className="text-on-surface-variant" size={24} />
          </button>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-15"></div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        {/* Profile Photo Section */}
        <section className="flex flex-col items-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-surface-container-lowest shadow-lg">
              <img 
                alt="User Profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwvuVaN43LjrUpHCZgyoFfKWqahmh8WPLfKOkIYMeBUpx7LplsTXdiQgvEMNVBSc8_dtQdo2k6PvoFUzLLApz_ztlD7ySkuNOp6I1K0p7yT_4f5ZDOrGDW9_Y-1BYQdHaYjGQ0xAJE5ieihjPnBftCZkH3QGpdz5nqxukdGLvjxh1ABcXQC0LdKAAy1_O4Fec-nAPWbO_WfLHMvsNEfHiK53yfdEAuQQKx6o8q8sWvl9uFl6-LJzqdG2hDGhlYRW-X2UubJR3Eu2nk" 
              />
            </div>
            <button className="absolute bottom-0 right-0 bg-gradient-to-br from-primary to-primary-container p-2.5 rounded-full text-on-primary shadow-lg active:scale-95 transition-transform">
              <Edit2 size={16} />
            </button>
          </div>
          <p className="mt-4 font-headline font-bold text-on-surface-variant tracking-tight">Change Photo</p>
        </section>

        {/* Personal Information Form */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Personal Details</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Basic Info</span>
          </div>
          <div className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Full Name</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="text" 
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Email Address</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            {/* Phone Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Phone Number</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Home Location</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Address</span>
          </div>
          <div className="space-y-4">
            {/* City/Region Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">City / Region</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                <input 
                  className="w-full bg-surface-container-low border-none rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Soweto, Johannesburg"
                />
              </div>
            </div>
            {/* Street Address Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Street Address</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 123 Vilakazi St"
              />
            </div>
          </div>
          
          {/* Visual Map Placeholder */}
          <div className="w-full h-32 rounded-xl overflow-hidden relative">
            <img 
              alt="Map" 
              className="w-full h-full object-cover grayscale opacity-60" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgtWuzLrxHdAV9Q0AjIIrLhvchfJd2JqhysXTo6zUr1LuaMvwmOG-rFAysitTQERmFGbfc0Zo0dnLB8n7Jos6fG2o_JfFqDVgfvoR8VPz8onozGUtRkV-SciA_S5rBTtLuiQn5lGa95cV7DjXGWusEINajnn6p2AW47QBDRPC_SQJaKBSyAya1WtJxMW-W5039oZKeS5gbYmuhrr_gBO6LvGgFv7DTIDjwwsRyWfS6kF0BH2xNxfHr8vh0J-YIuV4_fbODuGM-tKbp" 
            />
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm">
                <span className="text-xs font-bold text-primary">UPDATE MAP PIN</span>
              </div>
            </div>
          </div>
        </section>

        {/* Operating Hours Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Operating Hours</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Schedule</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Opening Time</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="time" 
                value={operatingHours.open}
                onChange={(e) => setOperatingHours({ ...operatingHours, open: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Closing Time</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="time" 
                value={operatingHours.close}
                onChange={(e) => setOperatingHours({ ...operatingHours, close: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Preferences Toggle Section */}
        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">App Preferences</h2>
          <div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-high">
            {/* Marketing Notifications */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Bell className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">Marketing Notifications</p>
                  <p className="text-xs text-on-surface-variant">Deals, offers, and new arrivals</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.marketing}
                  onChange={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            {/* Dark Mode */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Moon className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">Dark Mode</p>
                  <p className="text-xs text-on-surface-variant">Reduce eye strain at night</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.darkMode}
                  onChange={() => setPreferences({ ...preferences, darkMode: !preferences.darkMode })}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="pt-6 pb-12">
          <button 
            onClick={handleSave}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span>Save Changes</span>
            <CheckCircle2 size={24} />
          </button>
          <p className="text-center mt-6 text-on-surface-variant text-sm font-medium">Last updated: Oct 24, 2023</p>
        </div>
      </main>
    </div>
  );
};
