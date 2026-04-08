import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Leaf, AlertCircle, Loader2 } from 'lucide-react';
import API_BASE_URL from '@/config/api';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

const LoginModal = () => {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [isOpen, setIsOpen] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');

    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [showVerifyPassword, setShowVerifyPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleOpenLogin = () => setIsOpen(true);
        window.addEventListener('open-login-modal', handleOpenLogin);

        return () => {
            window.removeEventListener('open-login-modal', handleOpenLogin);
        };
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Reset state when closing
            setError('');
            setPassword('');
            setVerifyPassword('');
        }
    };

    const handleSignInSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await login(username, password);
            setIsOpen(false);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignUpSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic Validation Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

        if (!usernameRegex.test(username)) {
            setError("Username must be 3-20 characters long and can only contain letters, numbers, and underscores.");
            return;
        }

        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!passwordRegex.test(password)) {
            setError("Password must be at least 8 characters long, contain at least uppercase, lowercase, and a number.");
            return;
        }

        if (password !== verifyPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/accounts/register/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    username,
                    email,
                    password,
                    verify_password: verifyPassword
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = Object.entries(data).map(([key, value]) => {
                    const messages = Array.isArray(value) ? value.join(' ') : value;
                    return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${messages}`;
                }).join('\n');
                throw new Error(errorMsg || 'Registration failed.');
            }

            // Automatic login after successful registration or switch to sign-in modal
            setMode('signin');
            setPassword('');
            setVerifyPassword('');
            setError('Registration successful! Please sign in.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const GoogleIcon = () => (
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 12, 12)">
                <path fill="#4285F4" d="M11.6 -1.1C11.6 -1.9 11.5 -2.6 11.4 -3.4L-0.3 -3.4L-0.3 3.1L6.4 3.1C6.1 5.3 4.9 7 3.1 8.2L3.1 11.1L7.2 11.1C9.6 8.9 11.6 5.5 11.6 -1.1Z" />
                <path fill="#34A853" d="M-0.3 12C3.1 12 5.8 10.9 8 8.9L3.9 6.1C2.8 6.9 1.4 7.4 -0.3 7.4C-3.4 7.4 -6 5.3 -6.9 2.5L-11.1 2.5L-11.1 5.8C-8.9 10 -4.9 12 -0.3 12Z" />
                <path fill="#FBBC05" d="M-6.9 2.5C-7.2 1.7 -7.3 0.9 -7.3 0C-7.3 -0.9 -7.2 -1.7 -6.9 -2.5L-6.9 -5.8L-11 -5.8C-11.8 -4.1 -12.3 -2.1 -12.3 0C-12.3 2.1 -11.8 4.1 -11 5.8L-6.9 2.5Z" />
                <path fill="#EA4335" d="M-0.3 -7.4C1.6 -7.4 3.2 -6.8 4.6 -5.5L8.2 -9.1C6 -11.1 3 -12 -0.3 -12C-4.9 -12 -8.9 -9.9 -11.1 -5.8L-6.9 -2.5C-6 -5.3 -3.5 -7.4 -0.3 -7.4Z" />
            </g>
        </svg>
    );

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="rounded-full px-6 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md gradient-primary border-none">
                    Login / Sign up
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-background rounded-2xl flex flex-col max-h-[90vh] md:h-auto min-h-[500px]">

                {/* Single Form Area */}
                <div className="w-full flex flex-col p-6 sm:p-10 h-full relative overflow-y-auto custom-scrollbar">

                    {/* Header Logo & Title */}
                    <div className="flex flex-col items-center justify-center text-center mt-2 mb-8 animate-fade-in">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                <Leaf className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">AgriScan Pro</h1>
                                <p className="text-sm font-semibold text-muted-foreground mt-1">
                                    Mycotoxin Detection & Prediction Platform
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-muted p-1 rounded-full inline-flex relative shadow-inner">
                            <button
                                onClick={() => { setMode('signin'); setError(''); }}
                                className={`relative px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 z-10 ${mode === 'signin' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => { setMode('signup'); setError(''); }}
                                className={`relative px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 z-10 ${mode === 'signup' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Sign Up
                            </button>

                            {/* Sliding background */}
                            <div
                                className={`absolute top-1 bottom-1 w-1/2 bg-primary rounded-full transition-transform duration-300 ease-in-out shadow-sm ${mode === 'signin' ? 'left-1 translate-x-0' : 'left-[-4px] translate-x-full'
                                    }`}
                            />
                        </div>
                    </div>

                    <DialogHeader className="mb-6 text-center">

                        <DialogTitle className="text-2xl font-bold tracking-tight">
                            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
                        </DialogTitle>
                        <DialogDescription className="text-base mt-2">
                            {mode === 'signin' ? 'Sign in to your account to continue' : 'Enter your details below to get started'}
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className={`flex items-center gap-3 p-3 mb-6 rounded-xl border ${error.includes('successful')
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                            : 'bg-destructive/10 border-destructive/20 text-destructive'
                            }`}>
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium leading-tight">{error}</p>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col justify-center">
                        {mode === 'signin' ? (
                            <form onSubmit={handleSignInSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="signin-username" className="text-sm font-semibold text-foreground">Username</label>
                                    <input
                                        id="signin-username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        placeholder="Enter your username"
                                        className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 text-foreground 
                                        placeholder:text-muted-foreground/60 focus:bg-background
                                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                        transition-all duration-200 text-sm hover:border-primary/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="signin-password" className="text-sm font-semibold text-foreground">Password</label>
                                    <div className="relative">
                                        <input
                                            id="signin-password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="Enter your password"
                                            className="w-full h-11 px-4 pr-12 rounded-xl border border-input bg-background/50 text-foreground 
                                            placeholder:text-muted-foreground/60 focus:bg-background
                                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                            transition-all duration-200 text-sm hover:border-primary/50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button type="button" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                                            Forgot password?
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-11 mt-4 rounded-xl gradient-primary text-white font-semibold text-sm
                                    hover:opacity-90 active:scale-[0.98] 
                                    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
                                    disabled:opacity-60 disabled:cursor-not-allowed
                                    transition-all duration-200 flex items-center justify-center gap-2
                                    shadow-lg shadow-primary/25"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                                    ) : (
                                        'Sign in'
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSignUpSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="signup-name" className="text-sm font-semibold text-foreground">Full Name</label>
                                    <input
                                        id="signup-name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="John Doe"
                                        className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 text-foreground 
                                        placeholder:text-muted-foreground/60 focus:bg-background
                                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                        transition-all duration-200 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="signup-username" className="text-sm font-semibold text-foreground">Username</label>
                                    <input
                                        id="signup-username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        placeholder="johndoe123"
                                        className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 text-foreground 
                                        placeholder:text-muted-foreground/60 focus:bg-background
                                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                        transition-all duration-200 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="signup-email" className="text-sm font-semibold text-foreground">Email</label>
                                    <input
                                        id="signup-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="name@example.com"
                                        className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 text-foreground 
                                        placeholder:text-muted-foreground/60 focus:bg-background
                                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                        transition-all duration-200 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="signup-password" className="text-sm font-semibold text-foreground">Password</label>
                                    <div className="relative">
                                        <input
                                            id="signup-password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="Create a password"
                                            className="w-full h-11 px-4 pr-12 rounded-xl border border-input bg-background/50 text-foreground 
                                            placeholder:text-muted-foreground/60 focus:bg-background
                                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                                            transition-all duration-200 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="signup-verify" className="text-sm font-semibold text-foreground">Verify Password</label>
                                    <div className="relative">
                                        <input
                                            id="signup-verify"
                                            type={showVerifyPassword ? 'text' : 'password'}
                                            value={verifyPassword}
                                            onChange={(e) => setVerifyPassword(e.target.value)}
                                            required
                                            placeholder="Confirm password"
                                            className={`w-full h-11 px-4 pr-12 rounded-xl border 
                                            ${verifyPassword && password !== verifyPassword ? 'border-destructive focus:ring-destructive/30' : 'border-input focus:ring-primary/30 focus:border-primary'} 
                                            bg-background/50 text-foreground placeholder:text-muted-foreground/60 focus:bg-background
                                            focus:outline-none focus:ring-2 transition-all duration-200 text-sm`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showVerifyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-11 mt-4 rounded-xl gradient-primary text-white font-semibold text-sm
                                    hover:opacity-90 active:scale-[0.98] 
                                    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
                                    disabled:opacity-60 disabled:cursor-not-allowed
                                    transition-all duration-200 flex items-center justify-center gap-2
                                    shadow-lg shadow-primary/25"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> creating...</>
                                    ) : (
                                        'Sign up'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Google Login Section (Bottom) */}
                    <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-4">
                        <div className="relative w-full flex items-center">
                            <div className="flex-grow border-t border-border"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                OR CONTINUE WITH
                            </span>
                            <div className="flex-grow border-t border-border"></div>
                        </div>

                        <button
                            type="button"
                            className="w-full h-11 rounded-xl flex items-center justify-center gap-3 border-2 border-border text-foreground font-semibold text-sm hover:bg-muted/50 transition-colors duration-200
                            hover:border-primary/20 hover:shadow-sm"
                            onClick={() => console.log('Google login clicked')}
                        >
                            <GoogleIcon />
                            <span>Google</span>
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LoginModal;
