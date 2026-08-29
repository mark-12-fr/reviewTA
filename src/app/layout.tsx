import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

// Sans runs the interface, serif carries anything you actually read, mono
// handles counts and labels. Three roles, one family.
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const plexSerif = IBM_Plex_Serif({
  variable: '--font-plex-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'ReviewTa',
  description:
    'Turn your notes, PDFs, and photos into notes, flashcards, and a quiz - each item quoted back to your own material.',
}

export const viewport: Viewport = {
  themeColor: '#faf9f7',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full bg-paper text-ink">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-14 lg:pb-0">{children}</main>
        </div>
      </body>
    </html>
  )
}
