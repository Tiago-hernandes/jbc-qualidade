'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getAlertas, marcarAlertaLido, marcarTodosLidos } from '@/lib/firestore'
import { Bell, AlertTriangle, PenLine, CheckCheck, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const TIPO_CONFIG: Record<string, { label: string; cor: string; icone: any }> = {
  reincidencia:        { label: 'Reincidência',       cor: 'bg-red-50 border-red-200 text-red-700',    icone: AlertTriangle },
  assinatura_pendente: { label: 'Assinatura Pendente', cor: 'bg-blue-50 border-blue-200 text-blue-700', icone: PenLine },
}

export default function AlertasPage() {
  const { usuario }    = useAuth()
  const [alertas,   setAlertas]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [marcando,  setMarcando]  = useState<string | null>(null)

  const carregar = async () => {
    if (!usuario) return
    setLoading(true)
    try {
      const setor = ['admin','gestor','qualidade'].includes(usuario.cargo) ? undefined : usuario.setor
      const lista = await getAlertas(usuario.empresaId, setor)
      setAlertas(lista)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [usuario])

  const marcarLido = async (id: string) => {
    setMarcando(id)
    try {
      await marcarAlertaLido(id)
      setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a))
    } finally {
      setMarcando(null)
    }
  }

  const marcarTodos = async () => {
    if (!usuario) return
    try {
      const setor = ['admin','gestor','qualidade'].includes(usuario.cargo) ? undefined : usuario.setor
      await marcarTodosLidos(usuario.empresaId, setor)
      setAlertas(prev => prev.map(a => ({ ...a, lido: true })))
      toast.success('Todos os alertas marcados como lidos')
    } catch {
      toast.error('Erro ao marcar alertas')
    }
  }

  const naoLidos = alertas.filter(a => !a.lido)
  const lidos    = alertas.filter(a => a.lido)

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-amber-500" /> Alertas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {naoLidos.length > 0
              ? `${naoLidos.length} alerta${naoLidos.length > 1 ? 's' : ''} não lido${naoLidos.length > 1 ? 's' : ''}`
              : 'Nenhum alerta pendente'}
          </p>
        </div>
        {naoLidos.length > 0 && (
          <button onClick={marcarTodos}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            <CheckCheck size={15} /> Marcar todos como lidos
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : alertas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum alerta encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Não lidos */}
          {naoLidos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Não lidos</p>
              {naoLidos.map(a => <AlertaCard key={a.id} alerta={a} onMarcar={marcarLido} marcando={marcando} />)}
            </div>
          )}

          {/* Lidos */}
          {lidos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lidos</p>
              {lidos.map(a => <AlertaCard key={a.id} alerta={a} onMarcar={marcarLido} marcando={marcando} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AlertaCard({ alerta, onMarcar, marcando }: {
  alerta:   any
  onMarcar: (id: string) => void
  marcando: string | null
}) {
  const cfg   = TIPO_CONFIG[alerta.tipo] ?? TIPO_CONFIG['reincidencia']
  const Icone = cfg.icone
  const data  = alerta.criadoEm?.seconds
    ? new Date(alerta.criadoEm.seconds * 1000).toLocaleString('pt-BR')
    : '—'

  return (
    <div className={`rounded-xl border p-4 flex gap-4 items-start transition
      ${alerta.lido ? 'opacity-50 bg-white border-gray-200' : cfg.cor}`}>

      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${alerta.lido ? 'bg-gray-100' : 'bg-white/60'}`}>
        <Icone size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide">{cfg.label}</span>
          {alerta.fichaNumero && (
            <span className="text-xs font-mono text-gray-600">{alerta.fichaNumero}</span>
          )}
          {!alerta.lido && (
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-gray-800 leading-snug">{alerta.mensagem}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400">{data}</span>
          {alerta.setor && (
            <span className="text-xs text-gray-400">· {alerta.setor}</span>
          )}
          {alerta.fichaId && (
            <Link href={`/fichas/${alerta.fichaId}`}
              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Ver ficha <ExternalLink size={10} />
            </Link>
          )}
        </div>
      </div>

      {!alerta.lido && (
        <button
          onClick={() => onMarcar(alerta.id)}
          disabled={marcando === alerta.id}
          title="Marcar como lido"
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/60 disabled:opacity-50 transition">
          <Check size={15} />
        </button>
      )}
    </div>
  )
}
