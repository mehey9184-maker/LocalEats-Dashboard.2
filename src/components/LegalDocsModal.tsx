import React from 'react';
import { X, Shield, FileText, Lock } from 'lucide-react';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-orange-400 to-primary"></div>
        
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Shield size={22} className="stroke-2" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-headline text-white tracking-tight">Legal & Privacy (POPIA)</h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">South African Legal Compliance & Terms</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8 flex-1 text-zinc-300 styled-scrollbars font-body">
          
          {/* Privacy Policy (POPIA) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800/50">
              <Lock size={18} className="text-primary" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Privacy Policy (POPIA Compliant)</h3>
            </div>
            <p className="text-sm leading-relaxed">
              <strong>1. Introduction</strong><br/>
              Local Eats SA is committed to protecting your privacy and complying with the Protection of Personal Information Act 4 of 2013 (POPIA). This policy explains how we collect, use, and safeguard personal information across our Client Storefront, Rider App, and Merchant Dashboard.
            </p>
            <p className="text-sm leading-relaxed">
              <strong>2. Data Collection</strong><br/>
              We collect the following necessary information:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Clients:</strong> Name, contact details, delivery addresses, and payment information (processed securely).</li>
              <li><strong className="text-zinc-300">Riders:</strong> Name, contact details, vehicle information, and live GPS location during active shifts for order tracking.</li>
              <li><strong className="text-zinc-300">Merchants:</strong> Business details, menu data, and banking information for payouts.</li>
            </ul>
            <p className="text-sm leading-relaxed">
              <strong>3. Use of Data</strong><br/>
              Data is strictly used to facilitate local food delivery operations, enable rider navigation, and ensure accurate merchant payouts. We do not sell your personal data to third parties.
            </p>
            <p className="text-sm leading-relaxed">
              <strong>4. Data Security & Storage</strong><br/>
              All data is stored securely using industry-standard encryption. Live GPS locations are only transmitted during active deliveries to ensure operational transparency and safety. Once an order is completed, live tracking is disabled.
            </p>
          </section>

          {/* Terms of Service */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800/50 mt-8">
              <FileText size={18} className="text-orange-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Terms of Service</h3>
            </div>
            <p className="text-sm leading-relaxed">
              <strong>1. Acceptance of Terms</strong><br/>
              By accessing and using the Local Eats SA platform, you agree to these Terms of Service. These terms govern the relationship between Local Eats SA, Merchants, Independent Riders, and End Customers.
            </p>
            <p className="text-sm leading-relaxed">
              <strong>2. Independent Contractors</strong><br/>
              Delivery riders operating on the platform act as independent contractors, not employees. Merchants operate as independent vendors utilizing our digital infrastructure.
            </p>
            <p className="text-sm leading-relaxed">
              <strong>3. Intellectual Property</strong><br/>
              The Local Eats SA brand, logo, merchant interfaces, custom operational workflows, and proprietary databases are the exclusive intellectual property of Local Eats SA, protected under South African Copyright Law.
            </p>
            <p className="text-sm leading-relaxed">
              <strong>4. Liability & Responsibilities</strong><br/>
              While we strive to provide 99.9% uptime and accurate tracking, Local Eats SA is a software aggregator. Food quality is the responsibility of the Merchant. Safe driving and delivery execution is the responsibility of the designated Rider.
            </p>
          </section>

          {/* Final Acknowledgment */}
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl mt-8">
            <p className="text-xs text-primary/80 leading-relaxed font-medium">
              We continually update our data processing pipelines to minimize data footprints in third-party services (including cloud APIs) in full adherence with South African privacy standards. For any POPIA removal requests, contact privacy@localeatssa.co.za.
            </p>
          </div>
          
        </div>
        
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-sm hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
};
