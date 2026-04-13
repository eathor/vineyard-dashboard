'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Timeline' },
  { href: '/compare', label: 'Compare' },
  { href: '/review', label: 'Review Queue' },
  { href: '/export', label: 'Export' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login');
      } else {
        setUser(data.session.user);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login');
      else setUser(session.user);
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="text-white shadow-md" style={{ backgroundColor: '#2E4A2E' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Vineyard Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-vine-100">{user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm px-3 py-1 rounded" style={{ backgroundColor: '#1E3A1E' }}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  pathname === item.href
                 ? 'bg-white' 
                    : 'text-white'
                }`}
                style={pathname === item.href ? { color: '#2E4A2E' } : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}