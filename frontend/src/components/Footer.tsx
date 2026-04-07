import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="border-t py-8 mt-auto">
            <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
                <p className="text-sm text-muted-foreground">© 2024 AgriScan Pro. All rights reserved.</p>
                <div className="flex gap-6 text-sm text-muted-foreground">
                    {['Terms', 'Privacy', 'Contact'].map(l => (
                        <Link key={l} to="/doc" className="hover:text-foreground transition-colors">{l}</Link>
                    ))}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
