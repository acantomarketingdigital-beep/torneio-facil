'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'other'
type State = 'hidden' | 'android-prompt' | 'ios-guide' | 'installed'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallAppPrompt() {
  const [state, setState] = useState<State>('hidden')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already installed as standalone — never show
    if (isStandalone()) { setState('installed'); return }

    // Already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return

    const platform = detectPlatform()

    if (platform === 'android') {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setState('android-prompt')
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }

    if (platform === 'ios') {
      // On iOS, show the guide after a short delay
      const t = setTimeout(() => setState('ios-guide'), 3000)
      return () => clearTimeout(t)
    }
  }, [])

  async function handleAndroidInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setState('installed')
    } else {
      dismiss()
    }
  }

  function dismiss() {
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
    setDismissed(true)
    setState('hidden')
  }

  if (dismissed || state === 'hidden' || state === 'installed') return null

  // Android: show install button
  if (state === 'android-prompt') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-center gap-3 max-w-sm mx-auto">
          <img src="/images/logoapp.png" alt="TabelaPro" className="w-12 h-12 rounded-xl shrink-0 object-contain bg-white" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Instalar TabelaPro</p>
            <p className="text-xs text-gray-500 mt-0.5">Acesse suas tabelas mais rápido</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleAndroidInstall}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
            >
              Instalar
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1 text-gray-400 text-xs hover:text-gray-600"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    )
  }

  // iOS: show instructions
  if (state === 'ios-guide') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 max-w-sm mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src="/images/logoapp.png" alt="TabelaPro" className="w-10 h-10 rounded-xl object-contain bg-white" />
              <p className="font-semibold text-gray-900 text-sm">Instalar no iPhone</p>
            </div>
            <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
          </div>
          <ol className="space-y-2.5">
            <li className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              Toque em <strong className="mx-1">Compartilhar</strong> <span className="text-blue-500">□↑</span> no Safari
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              Role e toque em <strong className="ml-1">Adicionar à Tela de Início</strong>
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              Toque em <strong className="ml-1">Adicionar</strong> para confirmar
            </li>
          </ol>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Use o <strong>Safari</strong> — outros navegadores não suportam instalação no iPhone
          </p>
        </div>
      </div>
    )
  }

  return null
}
