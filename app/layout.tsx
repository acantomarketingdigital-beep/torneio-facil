import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import InstallAppPrompt from '@/components/InstallAppPrompt'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TabelaPro – Gerador de Tabelas Esportivas',
  description: 'Crie e gerencie torneios esportivos com geração automática de tabelas. Grátis, rápido e intuitivo.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TabelaPro',
  },
  icons: {
    icon: [
      { url: '/images/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/images/logoapp.png', type: 'image/png' },
    ],
    shortcut: '/images/favicon.png',
  },
  openGraph: {
    title: 'TabelaPro',
    description: 'Gerador inteligente de tabelas esportivas',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TabelaPro" />
        <link rel="apple-touch-icon" href="/images/logoapp.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/logoapp.png" />
        {/* Android / general */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="TabelaPro" />
        <link rel="icon" type="image/png" href="/images/favicon.png" />
        <link rel="shortcut icon" href="/images/favicon.png" />
      </head>
      <body className={`${inter.className} min-h-full bg-gray-50 text-gray-900 antialiased`}>
        {children}
        <InstallAppPrompt />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(reg => {
                      // Check for updates every hour
                      setInterval(() => reg.update(), 3600000)
                    })
                    .catch(() => {})
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
