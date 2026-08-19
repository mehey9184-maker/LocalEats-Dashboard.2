import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                    onFinished={() => setActiveTab("dashboard")}
                  />
                ) : (`;

const replacement = `                    onFinished={() => setActiveTab("dashboard")}
                  />
                  </>
                ) : (`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
