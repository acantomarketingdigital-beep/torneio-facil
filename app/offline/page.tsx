'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Você está offline</h1>
        <p className="text-gray-500 mb-6 leading-relaxed">
          Verifique sua conexão com a internet. Algumas funções podem não estar disponíveis sem internet.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
