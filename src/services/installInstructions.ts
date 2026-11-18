export function getInstallInstructions(userAgent: string, touchPoints = 0): string[] | null {
  const appleMobile = /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && touchPoints > 1);
  if (appleMobile) {
    return [
      "Open this page in Safari.",
      "Open Share, then tap Add to Home Screen.",
      "If you see Open as Web App, turn it on, then tap Add.",
    ];
  }
  if (/Android/i.test(userAgent) && /Chrome\//i.test(userAgent)) {
    return ["Open the browser menu and choose Add to home screen.", "Choose Install if offered."];
  }
  if (/Edg\//i.test(userAgent)) {
    return ["Open the Edge menu and choose More tools, then Apps.", "Choose Install this site as an app."];
  }
  if (/Chrome\//i.test(userAgent)) {
    return ["Open the Chrome menu and choose Cast, save, and share.", "Choose Install page as app."];
  }
  if (/Macintosh.*Version\/(?:1[7-9]|[2-9]\d)\b.*Safari\//i.test(userAgent)) {
    return ["In Safari, open the File menu.", "Choose Add to Dock, then Add."];
  }
  return null;
}
