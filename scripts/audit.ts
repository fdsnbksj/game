// `npm run audit`: replays saved runs, then the puzzle ladder. Both read the same flags
// (--limit) and AUDIT_PROJECT_ID; see each script for what it checks.
await import('./auditRuns');
await import('./auditPuzzles');
