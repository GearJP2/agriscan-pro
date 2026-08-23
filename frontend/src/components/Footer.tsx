import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="coe-footer bg-[#102b22] px-6 py-12 text-white lg:px-8">
    <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
      <div><Link to="/" className="text-xl font-semibold tracking-[-.04em]">AgriScan <span className="text-[#e1c682]">Pro</span></Link><p className="mt-4 max-w-sm text-sm leading-6 text-white/65">A research platform for safer food systems, stronger evidence, and earlier action.</p></div>
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#e1c682]">Platform</p><div className="mt-4 grid gap-2 text-sm text-white/75"><Link to="/dashboard">Dashboard</Link><Link to="/prediction">Predictions</Link><Link to="/samples">Sample records</Link></div></div>
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#e1c682]">Research</p><div className="mt-4 grid gap-2 text-sm text-white/75"><Link to="/doc">Documentation</Link><Link to="/profile">Profile</Link><Link to="/settings">Settings</Link></div></div>
    </div>
    <div className="mx-auto mt-10 max-w-7xl border-t border-white/15 pt-5 text-xs text-white/50">© 2026 AgriScan Pro. All rights reserved.</div>
  </footer>
);

export default Footer;
