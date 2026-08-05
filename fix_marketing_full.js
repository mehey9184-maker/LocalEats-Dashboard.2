import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('id="marketing_primary_tools"'));
let endIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('FLYER MODAL')) {
    endIdx = i; 
    break;
  }
}

const newGrid = `
      {/* FLYER STUDIO SECTION */}
      <div>
        <h3 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <Printer className="text-primary" size={20} />
          Flyer Studio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="marketing_primary_tools">
          {/* Hiring Rider Flyer */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Hire Riders PDF</h3>
                <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                  Generate a custom flyer with a QR code to recruit local delivery riders.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHiringModal(true)}
              className="mt-6 w-full py-2.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-xl text-xs transition-colors text-center"
            >
              Create Flyer
            </button>
          </motion.div>

          {/* Promotional Flyer Builder */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <Printer size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Promotional Flyer</h3>
                <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                  Design custom promotional flyers with menus, coupons, and distinct themes.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFlyerModal(true)}
              className="mt-6 w-full py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold rounded-xl text-xs transition-colors text-center"
            >
              Open Builder
            </button>
          </motion.div>

          {/* App QR Flyer */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
                <QrCode size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Direct App QR Flyer</h3>
                <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                  Generate a ready-to-print poster linking directly to your shop's menu.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateAppQRPDF}
              disabled={qrGenerating}
              className="mt-6 w-full py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors text-center disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {qrGenerating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Generating...
                </>
              ) : (
                "Download PDF"
              )}
            </button>
          </motion.div>
        </div>
      </div>
`;

const before = lines.slice(0, startIdx - 1).join('\n'); // skip <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="marketing_primary_tools"> line
const after = lines.slice(endIdx - 1).join('\n'); // keep AnimatePresence line

fs.writeFileSync('src/App.tsx', before + '\n' + newGrid + '\n' + after);
console.log("Updated flyer studio grid!");
