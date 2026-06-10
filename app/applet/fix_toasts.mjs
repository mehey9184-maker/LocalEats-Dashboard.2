import fs from 'fs';
const file = 'src/App.tsx';
let txt = fs.readFileSync(file, 'utf8');

if (!txt.includes('getFriendlyErrorMessage')) {
  txt = txt.replace(
    'import { cn, getEstimatedMinutes } from "./lib/utils";',
    'import { cn, getEstimatedMinutes, getFriendlyErrorMessage } from "./lib/utils";'
  );
  if (!txt.includes('getFriendlyErrorMessage')) {
    txt = txt.replace(
      'import { cn } from "./lib/utils";',
      'import { cn, getFriendlyErrorMessage } from "./lib/utils";'
    );
  }
}

// Regex replacements for raw error messages
txt = txt.replace(/toast\.error\(\s*[\`\"'][^\`\"']*?\w+\s*failed:?[^\`\"']*?[\`\"']\s*\+\s*error(?:\.message)?\s*\)/gi, 'toast.error(getFriendlyErrorMessage(error))');
txt = txt.replace(/toast\.error\(\s*[\`\"'][^\`\"']*?rror[^\`\"']*?[\`\"']\s*\+\s*error(?:\.message)?\s*\)/gi, 'toast.error(getFriendlyErrorMessage(error))');
txt = txt.replace(/toast\.error\(error\.message\)/g, 'toast.error(getFriendlyErrorMessage(error))');
// Template literal replacements
const templateLiteralRegex = /toast\.error\(\s*\`[^\`]*?\$\{err(?:or)?(?:\.message)?\}[^\`]*?\`\s*\)/gi;
txt = txt.replace(templateLiteralRegex, (match) => {
    // If the match contains 'error', we pass error, if 'err', we pass err
    if (match.includes('{error') || match.includes('error instanceof Error')) {
        return 'toast.error(getFriendlyErrorMessage(error))';
    }
    if (match.includes('{err')) {
        return 'toast.error(getFriendlyErrorMessage(err))';
    }
    return match;
});

// A slightly more general one for concatenations: error.message
txt = txt.replace(/toast\.error\([\`\"'][^\`\"']*?[\`\"']\s*\+\s*error\.message\)/g, 'toast.error(getFriendlyErrorMessage(error))');
txt = txt.replace(/toast\.error\([\`\"'][^\`\"']*?[\`\"']\s*\+\s*updateError\.message\)/g, 'toast.error(getFriendlyErrorMessage(updateError))');


fs.writeFileSync(file, txt);
console.log("Replaced toast errors in App.tsx");
