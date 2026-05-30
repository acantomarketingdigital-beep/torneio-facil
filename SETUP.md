# TorneioFácil – Setup Guide

## Stack
- **Next.js 16** (App Router, TypeScript)
- **Supabase** (Auth + PostgreSQL + Row Level Security)
- **Tailwind CSS v4**
- **PWA** (manifest.json + service worker)
- **Deploy**: Vercel

---

## 1. Criar projeto no Supabase

1. Acesse https://app.supabase.com e crie um novo projeto
2. Vá em **SQL Editor** e execute o conteúdo de `supabase/migrations/001_initial.sql`
3. Nas configurações do projeto (Settings → API), copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
# Edite .env.local com suas credenciais do Supabase
```

## 3. Instalar e rodar localmente

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## 4. Gerar ícones PWA

Os ícones precisam ser gerados a partir do SVG base em `public/icons/icon.svg`.
Você pode usar https://maskable.app/editor ou https://pwa-asset-generator.netlify.app/

Tamanhos necessários: 72, 96, 128, 144, 152, 180, 192, 384, 512 (px)

Salve em `public/icons/icon-{size}.png` e `public/icons/apple-icon-180.png`.

## 5. Deploy na Vercel

```bash
npx vercel
# Adicione as env vars no painel da Vercel
```

Ou conecte o repositório GitHub em https://vercel.com/new

---

## Estrutura de pastas

```
sports-tournament/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (PWA meta)
│   ├── login/page.tsx              # Login
│   ├── register/page.tsx           # Registro
│   ├── dashboard/page.tsx          # Dashboard (protegido)
│   ├── championships/
│   │   ├── new/page.tsx            # Criar campeonato
│   │   └── [id]/
│   │       ├── page.tsx            # Overview do campeonato
│   │       ├── teams/page.tsx      # Gerenciar times
│   │       ├── venues/page.tsx     # Gerenciar quadras
│   │       ├── schedule/page.tsx   # Horários disponíveis
│   │       ├── matches/page.tsx    # Tabela de jogos + resultados
│   │       ├── standings/page.tsx  # Classificação
│   │       └── settings/page.tsx   # Configurações + regulamento
│   ├── c/[slug]/page.tsx           # Página PÚBLICA do campeonato
│   └── api/
│       ├── auth/logout/route.ts
│       └── championships/[id]/
│           ├── generate/route.ts   # POST: gerar tabela
│           ├── standings/route.ts  # POST: recalcular classificação
│           └── export/route.ts     # GET: exportar PDF (via print)
├── lib/
│   ├── supabase/client.ts          # Browser client
│   ├── supabase/server.ts          # Server client
│   ├── algorithms/
│   │   ├── round-robin.ts          # Algoritmo todos-contra-todos
│   │   ├── knockout.ts             # Algoritmo mata-mata
│   │   ├── group-knockout.ts       # Grupos + mata-mata
│   │   ├── custom.ts               # X jogos por time
│   │   ├── scheduler.ts            # Atribuição de horários
│   │   ├── standings.ts            # Cálculo de classificação
│   │   └── index.ts                # Entry point
│   └── utils.ts                    # Helpers
├── types/index.ts                  # TypeScript types
├── middleware.ts                   # Auth middleware (Supabase)
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker
│   └── icons/                      # PWA icons
└── supabase/migrations/
    └── 001_initial.sql             # Schema completo
```

## Formatos suportados

| Formato | Descrição |
|---------|-----------|
| `round_robin` | Todos contra todos. Algoritmo de Berger (círculo). |
| `knockout` | Mata-mata com bracket. Suporta seeds e BYEs automáticos. |
| `group_knockout` | Fase de grupos (round-robin por grupo) + mata-mata. |
| `custom` | Cada time joga exatamente X partidas (distribuição balanceada). |

## Algoritmo de agendamento

O scheduler (`lib/algorithms/scheduler.ts`) atribui horários respeitando:
- Nenhum time joga 2 jogos ao mesmo tempo
- Nenhuma quadra tem 2 jogos ao mesmo tempo  
- Descanso mínimo entre jogos do mesmo time (configurável)
- Máximo de jogos por dia por time (configurável)
- Intervalo entre jogos na mesma quadra

## Critérios de desempate (configuráveis)

1. Pontos
2. Vitórias
3. Saldo de gols
4. Gols marcados
5. Gols sofridos
6. Confronto direto

A ordem pode ser reconfigurada em Configurações → Critérios de desempate.
