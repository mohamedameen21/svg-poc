import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { type ReactNode } from 'react';

interface GuestLayoutProps {
    children: ReactNode;
}

export default function GuestLayout({ children }: GuestLayoutProps) {
    const { auth } = usePage<SharedData>().props;

    return (
        <div className="flex min-h-screen flex-col bg-[#FDFDFC] dark:bg-[#0a0a0a]">
            {/* Header Navigation */}
            <header className="border-b border-[#19140035] bg-white/50 backdrop-blur-sm dark:border-[#3E3E3A] dark:bg-[#0a0a0a]/50">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <nav className="flex h-16 items-center justify-between">
                        {/* Logo/Brand */}
                        <div className="flex items-center">
                            <Link
                                href="/"
                                className="text-xl font-semibold text-[#1b1b18] dark:text-[#EDEDEC]"
                            >
                                SVG Sanitizer
                            </Link>
                        </div>

                        {/* Auth Links */}
                        <div className="flex items-center gap-4">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer (optional) */}
            <footer className="border-t border-[#19140035] bg-white/50 py-6 dark:border-[#3E3E3A] dark:bg-[#0a0a0a]/50">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                        © {new Date().getFullYear()} SVG Sanitizer. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
