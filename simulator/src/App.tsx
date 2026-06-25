import { SCHEMA_VERSION } from '@nhipsang/schema';

// Scaffold placeholder UI. Real cabin / panels / Trace view land in TIP-005.
export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-100">
      <h1 className="text-2xl font-semibold tracking-tight">NhipSang — scaffold OK</h1>
      <p className="text-sm text-neutral-400">schema v{SCHEMA_VERSION}</p>
    </main>
  );
}
