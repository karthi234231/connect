import { EventsView } from './EventsView';

function App() {
  return (
    <div className="min-h-screen bg-[var(--cx-bg)]">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="cx-aurora-blob"
          style={{ width: 400, height: 400, top: '-10%', right: '-5%', background: 'rgba(208, 164, 91, 0.06)' }}
        />
        <div
          className="cx-aurora-blob"
          style={{ width: 300, height: 300, bottom: '10%', left: '-8%', background: 'rgba(134, 175, 196, 0.04)', animationDelay: '4s' }}
        />
      </div>

      {/* Page container */}
      <div className="relative mx-auto w-full max-w-[var(--cx-content-width)] px-4 py-6 sm:px-6 sm:py-8">
        <EventsView />
      </div>
    </div>
  );
}

export default App;
