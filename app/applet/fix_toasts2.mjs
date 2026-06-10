import fs from 'fs';
const file = 'src/App.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/toast\.error\(\s*\`[^\`]*?\$\{err(?:or)?(?:\.message)?\}[^\`]*?\`\s*\)/gi, (match) => {
    if (match.includes('{err}')) return 'toast.error(getFriendlyErrorMessage(err))';
    if (match.includes('{error}')) return 'toast.error(getFriendlyErrorMessage(error))';
    if (match.includes('{error.message}')) return 'toast.error(getFriendlyErrorMessage(error))';
    if (match.includes('{err.message}')) return 'toast.error(getFriendlyErrorMessage(err))';
    if (match.includes('err instanceof Error')) return 'toast.error(getFriendlyErrorMessage(err))';
    if (match.includes('error instanceof Error')) return 'toast.error(getFriendlyErrorMessage(error))';
    return match; // fallback
});

// Any `toast.error("..." + error.message)`
txt = txt.replace(/toast\.error\(\s*\"[^\"]*?\"\s*\+\s*(err|error)(?:\.message)?\s*\)/gi, (match, prefix) => {
    return `toast.error(getFriendlyErrorMessage(${prefix}))`;
});
txt = txt.replace(/toast\.error\(\s*\'[^\']*?\'\s*\+\s*(err|error)(?:\.message)?\s*\)/gi, (match, prefix) => {
    return `toast.error(getFriendlyErrorMessage(${prefix}))`;
});

// Any `toast.error(error.message)`
txt = txt.replace(/toast\.error\(\s*(err|error)(?:\.message)?\s*\)/gi, (match, param) => {
    return `toast.error(getFriendlyErrorMessage(${param}))`;
});

// For updateError etc
txt = txt.replace(/toast\.error\([\`\"'][^\`\"']*?[\`\"']\s*\+\s*([a-zA-Z0-9_]+Error)(?:\.message)?\)/gi, (match, param) => `toast.error(getFriendlyErrorMessage(${param}))`);
txt = txt.replace(/toast\.error\(\s*\`[^\`]*?\$\{([a-zA-Z0-9_]+Error)(?:\.message)?\}[^\`]*?\`\s*\)/gi, (match, param) => `toast.error(getFriendlyErrorMessage(${param}))`);
txt = txt.replace(/toast\.error\(\s*([a-zA-Z0-9_]+Error)(?:\.message)?\s*\)/gi, (match, param) => `toast.error(getFriendlyErrorMessage(${param}))`);

fs.writeFileSync(file, txt);
console.log("Processed App.tsx");
