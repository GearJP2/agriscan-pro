/*
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Leaf, AlertCircle, Loader2 } from 'lucide-react';
import loginBg from '@/assets/Login-Regis.jpg';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <img
                    src={loginBg}
                    alt="Agricultural landscape"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-transparent" />
                <div className="relative z-10 flex flex-col justify-end p-12 text-white">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Leaf className="w-7 h-7 text-white" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">AgriScan Pro</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-3 leading-tight">
                            Mycotoxin Detection & Prediction Platform
                        </h2>
                        <p className="text-white/80 text-lg leading-relaxed">
                            Advanced AI-powered analysis for food safety research and agricultural quality control.
                        </p>
                    </div>
                </div>
            </div>

            // Right side - Login Form
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6 sm:p-12">
                <div className="w-full max-w-md space-y-8 animate-fade-in">
                    // Mobile Logo
                    <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                            <Leaf className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-foreground tracking-tight">AgriScan Pro</span>
                    </div>

                    // Header
                    <div className="text-center lg:text-left">
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-muted-foreground text-base">
                            Sign in to your account to continue
                        </p>
                    </div>

                    // Error Message
                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    // Form
                    <form onSubmit={handleSubmit} className="space-y-6">
                        // Username Field
                        <div className="space-y-2">
                            <label htmlFor="username" className="block text-sm font-semibold text-foreground">
                                Username
                            </label>
                            <div className="relative">
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    autoComplete="username"
                                    placeholder="Enter your username"
                                    className="w-full h-12 px-4 rounded-xl border border-input bg-background/50 text-foreground 
                    placeholder:text-muted-foreground/60 focus:bg-background
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                    transition-all duration-200 text-sm hover:border-primary/50"
                                />
                            </div>
                        </div>

                        // Password Field
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="w-full h-12 px-4 pr-12 rounded-xl border border-input bg-background/50 text-foreground 
                    placeholder:text-muted-foreground/60 focus:bg-background
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                    transition-all duration-200 text-sm hover:border-primary/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        // Submit Button
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 rounded-xl gradient-primary text-white font-semibold text-sm
                hover:opacity-90 active:scale-[0.98] 
                focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
                disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
                transition-all duration-200 flex items-center justify-center gap-2
                shadow-lg shadow-primary/25"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    // Divider
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-background px-4 text-muted-foreground font-medium uppercase tracking-wider">
                                New to AgriScan Pro?
                            </span>
                        </div>
                    </div>

                    // Footer / Register Link
                    <div className="text-center pt-2">
                        <Link
                            to="/register"
                            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 border-2 border-primary/20 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors duration-200"
                        >
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
*/