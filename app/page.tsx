import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <span className="font-bold text-xl">TabelaPro</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 rounded-lg border border-white/30 hover:bg-white/10 transition-colors text-sm font-medium">Entrar</Link>
          <Link href="/register" className="px-4 py-2 rounded-lg bg-white text-blue-700 hover:bg-blue-50 transition-colors text-sm font-medium">Criar conta</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          PWA – Funciona no celular sem instalar app
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Crie tabelas esportivas<br />em segundos
        </h1>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
          Gere automaticamente tabelas para seus campeonatos. Todos contra todos, mata-mata, fase de grupos e mais. Classificação em tempo real.
        </p>
        <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg">
          Começar gratuitamente →
        </Link>

        <div className="grid md:grid-cols-3 gap-6 mt-24 text-left">
          {[
            { icon: '⚡', title: 'Geração automática', desc: 'Informe os times e datas — o sistema monta toda a tabela de jogos automaticamente respeitando quadras, horários e intervalos.' },
            { icon: '📊', title: '4 formatos suportados', desc: 'Todos contra todos, mata-mata, grupos + mata-mata ou formato personalizado onde cada time joga X partidas.' },
            { icon: '🏅', title: 'Classificação ao vivo', desc: 'Lance os resultados e a tabela de classificação é atualizada em tempo real com critérios de desempate configuráveis.' },
            { icon: '🔗', title: 'Página pública', desc: 'Compartilhe o link do campeonato com qualquer pessoa. Tabela, jogos e classificação acessíveis sem login.' },
            { icon: '📱', title: 'PWA instalável', desc: 'Instale como aplicativo no celular Android ou iOS. Funciona mesmo com conexão instável.' },
            { icon: '📄', title: 'Exportar em PDF', desc: 'Exporte a tabela de jogos e classificação em PDF para imprimir ou compartilhar.' },
          ].map(f => (
            <div key={f.title} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-blue-100 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-blue-200">
        <p>TabelaPro &copy; {new Date().getFullYear()} — Sistema de Gestão de Campeonatos Esportivos</p>
      </footer>
    </div>
  )
}
