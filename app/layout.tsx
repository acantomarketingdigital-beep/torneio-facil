import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TabelaPro – Gerador de Tabelas Esportivas',
  description: 'Crie e gerencie campeonatos esportivos com geração automática de tabelas.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TabelaPro',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-icon-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} min-h-full bg-gray-50 text-gray-900 antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});})}`,
          }}
        />
      </body>
    </html>
  )
}
