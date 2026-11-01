import { HashRouter, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Session from './pages/Session';
import Topics from './pages/Topics';
import Settings from './pages/Settings';
import { GearIcon, HomeIcon, MapIcon } from './components/Icons';

function Shell() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
    }`;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="safe-top flex-1 pb-24">
        <Outlet />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-md">
          <NavLink to="/" end className={tab}>
            <HomeIcon /> Hjem
          </NavLink>
          <NavLink to="/temaer" className={tab}>
            <MapIcon /> Temaer
          </NavLink>
          <NavLink to="/innstillinger" className={tab}>
            <GearIcon /> Innstillinger
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="temaer" element={<Topics />} />
          <Route path="innstillinger" element={<Settings />} />
        </Route>
        <Route path="okt" element={<Session />} />
      </Routes>
    </HashRouter>
  );
}
