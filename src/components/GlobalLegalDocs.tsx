import React, { useState } from 'react';
import { LegalDocsModal } from './LegalDocsModal';

export const GlobalLegalDocs: React.FC = () => {
  const [showLegal, setShowLegal] = useState(false);

  return (
    <>
      <div className="fixed bottom-2 left-2 z-[9900]">
        <button 
          onClick={() => setShowLegal(true)}
          className="text-[9px] text-zinc-500 hover:text-zinc-300 font-medium tracking-wide transition-colors bg-zinc-950/40 px-2.5 py-1 rounded-md backdrop-blur-md cursor-pointer border border-zinc-800/30"
        >
          Legal & Privacy (POPIA)
        </button>
      </div>
      <LegalDocsModal isOpen={showLegal} onClose={() => setShowLegal(false)} />
    </>
  );
};
