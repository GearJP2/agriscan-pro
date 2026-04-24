import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="w-full border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 mt-auto z-40 relative">
            <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-between gap-4 md:flex-row">
                <p className="font-sans text-sm text-slate-500 dark:text-slate-400">© 2025 AgriScan Pro. All rights reserved.</p>
                <div className="flex gap-6 font-sans text-sm text-slate-500 dark:text-slate-400">
                    <Link className="hover:text-primary transition-colors" to="/doc">Terms</Link>
                    <Link className="hover:text-primary transition-colors" to="/doc">Privacy</Link>
                    <Link className="hover:text-primary transition-colors" to="/doc">Contact</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
