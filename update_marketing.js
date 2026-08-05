import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf-8');

const insertStates = `  // Hiring Flyer states
  const [showHiringModal, setShowHiringModal] = useState(false);
  const [hiringHeadline, setHiringHeadline] = useState("Join Our Delivery Fleet!");
  const [hiringBody, setHiringBody] = useState("Earn money delivering for LocalEats. Flexible hours and great pay.");
  const [hiringLink, setHiringLink] = useState("https://www.localeatssa.co.za/riders/apply");

  const handleGenerateHiringPDF = async () => {
    try {
      setQrGenerating(true);
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(255, 90, 54);
      doc.rect(0, 0, pageWidth, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("LocalEats", 15, 25);

      doc.setTextColor(26, 28, 30);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      const splitHeadline = doc.splitTextToSize(hiringHeadline, pageWidth - 40);
      doc.text(splitHeadline, pageWidth / 2, 70, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(70, 70, 70);
      doc.setFont("helvetica", "normal");
      const splitBody = doc.splitTextToSize(hiringBody, pageWidth - 40);
      doc.text(splitBody, pageWidth / 2, 110, { align: "center" });

      const qrDataUrl = await QRCode.toDataURL(hiringLink, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      });

      const boxSize = 80;
      const boxX = (pageWidth - boxSize) / 2;
      doc.addImage(qrDataUrl, "PNG", boxX, 150, boxSize, boxSize);

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Scan the QR code to apply now!", pageWidth / 2, 240, { align: "center" });

      doc.save("LocalEats_Hiring_Rider.pdf");
      toast.success("Hiring PDF downloaded!");
      setShowHiringModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Hiring PDF");
    } finally {
      setQrGenerating(false);
    }
  };
`;

let newContent = content.replace(
  '  // Table QR generator states\n  const [showTableQRModal, setShowTableQRModal] = useState(false);',
  insertStates + '\n  // Table QR generator states\n  const [showTableQRModal, setShowTableQRModal] = useState(false);'
);

fs.writeFileSync('src/App.tsx', newContent);
console.log("Updated states!");
