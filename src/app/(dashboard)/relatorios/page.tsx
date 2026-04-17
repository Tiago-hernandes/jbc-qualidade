'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getEstatisticas } from '@/lib/firestore'
import { SETORES } from '@/types'
import { AlertTriangle, TrendingUp, CheckCircle, Clock, Download, Filter } from 'lucide-react'

const CORES_STATUS: Record<string, string> = {
  'Concluído': '#16a34a',
  'Pendente':  '#ca8a04',
  'Cancelado': '#dc2626',
  'Rascunho':  '#6b7280',
}
const CORES = ['#1d4ed8','#2563eb','#3b82f6','#7c3aed','#0891b2','#0d9488']

const TIPO_LABELS: Record<string, string> = {
  qualidade: 'Qualidade', processo: 'Processo', seguranca: 'Segurança',
  material: 'Material', equipamento: 'Equipamento', outro: 'Outro',
}

const PERIODOS = [
  { label: 'Todo período',    value: 'all'     },
  { label: 'Últimos 30 dias', value: '30'      },
  { label: 'Últimos 90 dias', value: '90'      },
  { label: 'Este mês',        value: 'mes'     },
  { label: 'Mês anterior',    value: 'mes_ant' },
]

function calcularDatas(periodo: string): { dataInicio?: Date; dataFim?: Date } {
  const agora = new Date()
  if (periodo === '30')      { const d = new Date(); d.setDate(d.getDate() - 30); return { dataInicio: d } }
  if (periodo === '90')      { const d = new Date(); d.setDate(d.getDate() - 90); return { dataInicio: d } }
  if (periodo === 'mes')     { return { dataInicio: new Date(agora.getFullYear(), agora.getMonth(), 1) } }
  if (periodo === 'mes_ant') {
    return {
      dataInicio: new Date(agora.getFullYear(), agora.getMonth() - 1, 1),
      dataFim:    new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59),
    }
  }
  return {}
}

// Barras horizontais CSS
function BarrasHorizontais({ dados, cores }: { dados: { name: string; value: number }[]; cores: string[] }) {
  const max = Math.max(...dados.map(d => d.value), 1)
  return (
    <div className="space-y-3">
      {dados.map((item, i) => {
        const pct = Math.round((item.value / max) * 100)
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">{item.name}</span>
              <span className="text-xs font-bold" style={{ color: cores[i % cores.length] }}>{item.value}</span>
            </div>
            <div className="h-5 bg-gray-100 rounded overflow-hidden w-full">
              <div className="h-5 rounded transition-all"
                style={{ width: `${pct}%`, backgroundColor: cores[i % cores.length], minWidth: item.value > 0 ? 4 : 0 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Barras verticais CSS (tendência / tipo)
function BarrasVerticais({ dados, cor = '#2563eb', altura = 140 }: {
  dados: { name: string; value: number }[]
  cor?: string | string[]
  altura?: number
}) {
  const max = Math.max(...dados.map(d => d.value), 1)
  return (
    <div style={{ height: altura }} className="flex items-end gap-1 w-full">
      {dados.map((item, i) => {
        const pct = (item.value / max) * 100
        const c   = Array.isArray(cor) ? cor[i % cor.length] : cor
        return (
          <div key={item.name} className="flex flex-col items-center flex-1 h-full justify-end gap-1">
            <span className="text-xs font-bold" style={{ color: c, opacity: item.value > 0 ? 1 : 0 }}>
              {item.value > 0 ? item.value : ''}
            </span>
            <div className="w-full rounded-t transition-all" style={{ height: `${pct}%`, backgroundColor: c, minHeight: item.value > 0 ? 4 : 0 }} />
            <span className="text-gray-500 text-center leading-none"
              style={{ fontSize: 9, maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {item.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function RelatoriosPage() {
  const { usuario }  = useAuth()
  const [stats,    setStats]   = useState<any>(null)
  const [loading,  setLoading] = useState(true)
  const [periodo,  setPeriodo] = useState('all')
  const [setor,    setSetor]   = useState('')

  const isAdminGestor = usuario && ['admin','gestor','qualidade'].includes(usuario.cargo)

  const carregar = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    try {
      const s = await getEstatisticas(usuario.empresaId, {
        ...calcularDatas(periodo),
        setor: setor || (!isAdminGestor ? usuario.setor : undefined),
      })
      setStats(s)
    } finally {
      setLoading(false)
    }
  }, [usuario, periodo, setor])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )
  if (!stats) return null

  const porTipoData   = Object.entries(stats.porTipo)
    .map(([k, v]) => ({ name: TIPO_LABELS[k] || k, value: v as number }))
    .sort((a, b) => b.value - a.value)

  const porStatusData = Object.entries(stats.porStatus)
    .filter(([k, v]) => k !== 'em_andamento' && (v as number) > 0)
    .map(([k, v]) => ({
      name:  k === 'concluido' ? 'Concluído' : k === 'pendente' ? 'Pendente' : k === 'cancelado' ? 'Cancelado' : 'Rascunho',
      value: v as number,
    }))

  const tendenciaData = Object.entries(stats.porMes).map(([k, v]) => ({
    name:  k.slice(5) + '/' + k.slice(2, 4),
    value: v as number,
  }))

  const setorData = Object.entries(stats.porSetor)
    .map(([k, v]) => ({ name: k, value: v as number }))
    .sort((a, b) => b.value - a.value)

  const periodoLabel = PERIODOS.find(p => p.value === periodo)?.label ?? 'Todo período'
  const setorLabel   = setor || (isAdminGestor ? 'Todos os setores' : usuario?.setor)

  const cards = [
    { label: 'Total de Fichas', value: stats.total,                    icon: TrendingUp,    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100'   },
    { label: 'Pendentes',       value: stats.porStatus.pendente || 0,  icon: Clock,         bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
    { label: 'Concluídas',      value: stats.porStatus.concluido || 0, icon: CheckCircle,   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100'  },
    { label: 'Reincidências',   value: stats.reincidentes.length,      icon: AlertTriangle, bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100'    },
  ]

  const Card = ({ children, full = false }: { children: React.ReactNode; full?: boolean }) => (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${full ? 'lg:col-span-2' : ''}`}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      {children}
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm 14mm; size: A4 portrait; }
          aside, .mobile-header, [data-print="hide"] { display: none !important; }
          body  { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main  { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .report-cards  { display: grid !important; grid-template-columns: repeat(4,1fr) !important; gap: 8px !important; }
          .report-charts { display: grid !important; grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
          .chart-full    { grid-column: span 2 !important; }
        }
      `}</style>

      <div className="space-y-5">

        {/* Cabeçalho tela */}
        <div className="flex items-start justify-between gap-4" data-print="hide">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Relatórios e Indicadores</h1>
            <p className="text-sm text-gray-500">Visão geral das ocorrências de qualidade</p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={15} /> Exportar PDF
          </button>
        </div>

        {/* Cabeçalho impressão */}
        <div className="hidden print:block">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-gray-900">JBC</span>
              <span className="text-sm font-bold text-gray-500 border-l border-gray-300 pl-2">PERFIL</span>
            </div>
            <span className="text-xs text-gray-400">Gerado em {new Date().toLocaleString('pt-BR')}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Relatório de Qualidade</h1>
          <p className="text-xs text-gray-500 mt-1">
            Período: <strong>{periodoLabel}</strong>
            {setorLabel && <> · Setor: <strong>{setorLabel}</strong></>}
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3" data-print="hide">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filtros:</span>
          </div>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {isAdminGestor && (
            <select value={setor} onChange={e => setSetor(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos os setores</option>
              {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Cards */}
        <div className="report-cards grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}
              style={{ breakInside: 'avoid' }}>
              <c.icon size={18} className={c.text} />
              <p className={`text-3xl font-extrabold mt-2 ${c.text}`}>{c.value}</p>
              <p className="text-xs font-semibold mt-1 text-gray-600">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="report-charts grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Tendência */}
          <Card full>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Tendência — Fichas por Mês (últimos 12 meses)</h3>
            <BarrasVerticais dados={tendenciaData} cor="#2563eb" altura={130} />
          </Card>

          {/* Por tipo */}
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Ocorrências por Tipo</h3>
            {porTipoData.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Sem dados</p>
              : <BarrasVerticais dados={porTipoData} cor={CORES} altura={130} />
            }
          </Card>

          {/* Por status */}
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Distribuição por Status</h3>
            {porStatusData.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Sem dados</p>
              : <BarrasHorizontais
                  dados={porStatusData}
                  cores={porStatusData.map(d => CORES_STATUS[d.name] ?? '#6b7280')}
                />
            }
          </Card>

          {/* Por setor */}
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Ocorrências por Setor</h3>
            {setorData.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Sem dados</p>
              : <BarrasHorizontais dados={setorData} cores={CORES} />
            }
          </Card>

          {/* Top reincidências */}
          <Card full>
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={15} className="text-red-500" /> Top 5 Reincidências
            </h3>
            {stats.reincidentes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma reincidência detectada</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.reincidentes.map((f: any, i: number) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <span className="w-7 h-7 rounded-full bg-white text-red-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0 border border-red-200">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{f.assunto || f.numero}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.setor}{f.idMaquina ? ` — ${f.idMaquina}` : ''}</p>
                    </div>
                    <span className="text-lg font-extrabold text-red-600 flex-shrink-0">{f.reincidencias}x</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
