import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, BarChart2, Database, Home, Menu, X, ShieldCheck, Lock } from 'lucide-react';
import { isUnlocked, lock } from '../utils/coordinator';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/assess', label: 'Assess', icon: Activity },
  { to: '/data', label: 'Data', icon: Database },
  { to: '/analysis', label: 'Analysis', icon: BarChart2 },
];

function isActive(to: string, pathname: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [coordinatorActive, setCoordinatorActive] = useState(() => isUnlocked());

  function handleLock() {
    lock();
    setCoordinatorActive(false);
    setMenuOpen(false);
  }

  // Refresh coordinator state on each render (session may change)
  const unlocked = isUnlocked();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-primary-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-primary-600 rounded-lg flex-shrink-0">
            <Activity size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base leading-tight truncate">
              UNIOSUNTH Nursing Research Tool
            </h1>
            <p className="text-primary-200 text-xs hidden sm:block">
              Workload &amp; IPC Compliance Assessment
            </p>
          </div>

          {/* Coordinator badge */}
          {unlocked && (
            <button
              onClick={handleLock}
              className="hidden sm:flex items-center gap-1.5 bg-green-600/80 hover:bg-red-600/80 text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors group touch-manipulation"
              title="Click to lock coordinator mode"
            >
              <ShieldCheck size={13} className="group-hover:hidden" />
              <Lock size={13} className="hidden group-hover:block" />
              <span className="group-hover:hidden">Coordinator</span>
              <span className="hidden group-hover:block">Lock</span>
            </button>
          )}

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive(to, location.pathname)
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-200 hover:text-white hover:bg-primary-700'
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-primary-700 transition-colors touch-manipulation"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-primary-900 border-t border-primary-700">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium border-b border-primary-800 transition-colors ${
                  isActive(to, location.pathname)
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}

            {/* Coordinator status in mobile menu */}
            {unlocked && (
              <button
                onClick={handleLock}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-red-300 hover:bg-primary-800 transition-colors touch-manipulation"
              >
                <Lock size={18} />
                Lock Coordinator Mode
              </button>
            )}
          </div>
        )}
      </header>

      {/* Coordinator banner */}
      {unlocked && (
        <div className="bg-green-600 text-white text-xs font-medium text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <ShieldCheck size={13} />
          Coordinator mode active — full data access enabled
        </div>
      )}

      {/* ── Main content ───────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = isActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-primary-100' : ''}`}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Footer (desktop only) ──────────────────────── */}
      <footer className="hidden md:block border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 text-xs text-gray-400 text-center">
          UNIOSUNTH Medical Wards Research Study • CSPS adapted from Lam (2004) •
          Workload scale adapted from NAS &amp; NASA-TLX
        </div>
      </footer>
    </div>
  );
}
