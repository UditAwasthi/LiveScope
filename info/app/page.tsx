export default function HomePage() {
  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="aurora-blur top-[-200px] left-[-100px]" />
      <div className="aurora-blur bottom-[-200px] right-[-100px] opacity-50" />

      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 nav-pill flex items-center gap-12 w-fit">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-warm-gradient rounded-sm" />
          <span className="font-semibold tracking-tight">LiveScope</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400 font-medium">
          <a href="#what" id="nav-what-link" className="hover:text-white transition-colors">What it does</a>
          <a href="#loop" id="nav-loop-link" className="hover:text-white transition-colors">The loop</a>
          <a href="#planes" id="nav-planes-link" className="hover:text-white transition-colors">Planes</a>
        </div>
        <a href="#what" id="nav-cta-link" className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-full border border-white/10 transition-all font-medium">Documentation</a>
      </nav>

      <header className="pt-48 pb-32 px-6 flex flex-col items-center text-center relative">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff2f3a]" /> System Operational
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1] mb-8">
          Reliability is not an accident.<br />
          It is a <span className="text-warm-gradient">repeatable</span> loop.
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12">
          Observe production state, reproduce failures in local contexts, and verify fixes before they ever hit a customer.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <a href="#loop" id="hero-loop-btn" className="keycap-button px-8 py-3.5 text-base">Read the loop</a>
          <a href="#planes" id="hero-planes-btn" className="text-white font-medium hover:text-gray-300 transition-colors flex items-center gap-2 group">
            See the planes
            <iconify-icon icon="lucide:arrow-right" className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
        <div className="mt-16 font-mono text-[11px] text-gray-600">
          $ livescope --observe --target prod-cluster-01
        </div>
      </header>

      <section id="loop" className="max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="glass-panel p-1 md:p-2">
          <div className="bg-[#0b0c0e] rounded-[12px] p-8 md:p-12">
            <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-8">
              <div>
                <h2 className="text-3xl font-semibold mb-4">The Reliability Loop</h2>
                <p className="text-gray-500 max-w-md">A continuous cycle of engineering rigor designed to eliminate regression and minimize MTTR.</p>
              </div>
              <div className="font-mono text-xs text-gray-500">
                TYPE: SEQUENTIAL_PROCESS<br />
                STATUS: ACTIVE
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
              <LoopStep n="01" title="Observe" body="Real-time instrumentation of production services without byte-code overhead." />
              <LoopStep n="02" title="Detect" body="Automated anomaly detection across distributed trace boundaries." />
              <LoopStep n="03" title="Investigate" body="Deep-dive into the state of the machine at the moment of failure." />
              <LoopStep n="04" title="Reconstruct" body="Mirror the production environment locally to isolate the specific bug." />
              <LoopStep n="05" title="Compare Fixes" body="Run multiple resolution strategies against the same failure context." />
              <LoopStep n="06" title="Execute" body="Deploy the validated fix with cryptographic proof of resolution." />
              <LoopStep n="07" title="Verify" body="Close the loop by confirming the expected state in production." />
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="mb-16">
          <span className="font-mono text-xs text-warm-gradient uppercase tracking-widest">Architecture</span>
          <h2 className="text-4xl font-bold mt-4">Engineered in three planes.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Plane icon="lucide:database" title="Data Plane" body="The engine that captures and processes billions of events with sub-millisecond latency." trust="TRUST: EBPF NATIVE" />
          <Plane icon="lucide:layers" title="Control Plane" body="Centralized management for policies, security boundaries, and fleet-wide visibility." trust="TRUST: ZERO EXFILTRATION" />
          <Plane icon="lucide:cpu" title="AI Plane" body="LLM-assisted reasoning to suggest root cause hypotheses and possible remediations." trust="TRUST: LOCAL INFERENCE" />
        </div>
      </section>

      <section id="what" className="max-w-4xl mx-auto px-6 py-24 w-full">
        <div className="glass-panel overflow-hidden">
          <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex justify-between items-center">
            <span className="font-mono text-xs text-gray-400">diagnostic_queries.sh</span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <div className="w-2 h-2 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="p-8 md:p-12 space-y-10">
            <Question>What exactly is broken in this specific request?</Question>
            <Question>Why did the database driver hang on this specific node?</Question>
            <Question>What happens to the stack if we change the memory limit?</Question>
            <Question>Which of these three fixes is the safest for roll-out?</Question>
            <Question>Did the patch actually work as expected post-deploy?</Question>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-white/5 py-24 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-warm-gradient rounded-sm" />
            <div>
              <div className="font-bold text-xl tracking-tight leading-none">LiveScope</div>
              <div className="text-xs text-gray-500 font-mono mt-1">Observe. Reproduce. Fix. Verify.</div>
            </div>
          </div>
          <div className="text-sm text-gray-500 flex gap-12">
            <a href="#what" id="footer-docs-link" className="hover:text-white transition-colors">Documentation</a>
            <a href="#loop" id="footer-status-link" className="hover:text-white transition-colors">System Status</a>
            <a href="#planes" id="footer-tos-link" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoopStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="loop-step">
      <div className="loop-number font-mono text-gray-700 text-sm mb-4 transition-colors">{n} //</div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function Plane({ icon, title, body, trust }: { icon: string; title: string; body: string; trust: string }) {
  return (
    <div className="glass-panel p-8 flex flex-col h-full">
      <div className="mb-8">
        <iconify-icon icon={icon} className="text-3xl text-coral-400" />
      </div>
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <p className="text-gray-400 text-sm mb-auto">{body}</p>
      <div className="mt-8 pt-6 border-t border-white/5">
        <span className="font-mono text-[10px] text-gray-500">{trust}</span>
      </div>
    </div>
  );
}

function Question({ children }: { children: string }) {
  return (
    <div className="flex gap-6">
      <span className="text-gray-600 font-mono text-sm">Q:</span>
      <h4 className="text-lg md:text-xl font-medium">{children}</h4>
    </div>
  );
}
