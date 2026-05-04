import React, { useState } from 'react';
import { X, Camera, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateScan = () => {
    setIsSimulating(true);
    // Simulate a successful scan after 2 seconds
    setTimeout(() => {
      onScan('LOCAL-B789'); // Example code
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors">
        <X className="w-8 h-8" />
      </button>

      <div className="w-full max-w-sm aspect-square relative border-2 border-zinc-800 rounded-3xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-zinc-900/50 flex flex-col items-center justify-center gap-4">
          <Camera className="w-12 h-12 text-zinc-700" />
          <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Scanner Initializing...</p>
        </div>
        
        {/* Animated Scanning Line */}
        <motion.div 
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-[#39FF14] shadow-[0_0_15px_#39FF14] z-10"
        />

        {isSimulating && (
          <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <Zap className="w-12 h-12 text-[#39FF14] animate-bounce mx-auto mb-4" />
              <p className="text-sm font-black italic uppercase text-white tracking-widest">Awaiting Decryption...</p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center space-y-6">
        <h2 className="text-xl font-black italic uppercase text-white tracking-widest">Point Camera at QR</h2>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest leading-relaxed">
          Ensure the merchant's pairing QR is fully visible <br/> within the processing vectors.
        </p>
        
        <button 
          onClick={simulateScan}
          disabled={isSimulating}
          className="px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-white transition-all active:scale-95"
        >
          Simulate Scan (Debug)
        </button>
      </div>
    </div>
  );
};
