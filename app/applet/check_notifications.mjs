import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8');
console.log("Is NotificationCenterOpen state added?", lines.includes('isNotificationCenterOpen'));
console.log("Is NotificationCenterSidePanel component added?", lines.includes('NotificationCenterSidePanel'));
console.log("Is the Icon button added?", lines.includes('title="Notification Center"'));
