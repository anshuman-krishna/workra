import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/lib/query/provider';
import { AuthProvider } from '@/lib/auth/provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'workra',
  description: 'clarity in every working hour',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
