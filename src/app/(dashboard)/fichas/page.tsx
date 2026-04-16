'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getFichas } from '@/lib/firestore'
import type { Ficha, StatusFicha } from '@/types'
import Link from 'next/link'
import { FilePlus, Search, Eye, AlertTriangle, Printer, Mail, MessageCircle } from 'lucide-react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const STATUS_CONFIG: Record<StatusFicha, { label: string; color: string }> = {
  rascunho:     { label: 'Rascunho',      color: 'bg-gray-100 text-gray-700' },
  pendente:     { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em Andamento',  color: 'bg-blue-100 text-blue-800' },
  concluido:    { label: 'Concluído',     color: 'bg-green-100 text-green-800' },
  cancelado:    { label: 'Cancelado',     color: 'bg-red-100 text-red-800' },
}

const STATUS_FILTRO = ['pendente', 'concluido', 'cancelado', 'rascunho'] as const

const PRIORIDADE_CONFIG = {
  alta:  { label: '🔴 Alta',  color: 'text-red-700' },
  media: { label: '🟡 Média', color: 'text-yellow-700' },
  baixa: { label: '🟢 Baixa', color: 'text-green-700' },
}

const prazoVencido = (f: Ficha) => {
  if (!f.prazoSolucao || ['concluido','cancelado'].includes(f.status)) return false
  return new Date(f.prazoSolucao) < new Date()
}

const POR_PAGINA = 20

export default function FichasPage() {
  const { usuario } = useAuth()
  const [fichas,  setFichas]  = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [busca,   setBusca]   = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    if (!usuario) return
    const constraints: any[] = [
      where('empresaId', '==', usuario.empresaId),
    ]
    if (!['admin','gestor'].includes(usuario.cargo)) constraints.push(where('setor', '==', usuario.setor))

    const q = query(collection(db, 'fichas'), ...constraints)
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Ficha))
        .sort((a, b) => {
          const ta = (a.criadoEm as any)?.seconds ?? 0
          const tb = (b.criadoEm as any)?.seconds ?? 0
          return tb - ta
        })
      setFichas(lista)
      setLoading(false)
    })
    return unsub
  }, [usuario])

  useEffect(() => { setPagina(1) }, [busca, filtroStatus])

  const filtradas = fichas.filter(f =>
    (!filtroStatus || f.status === filtroStatus) &&
    (!busca ||
    f.numero?.toLowerCase().includes(busca.toLowerCase()) ||
    f.assunto?.toLowerCase().includes(busca.toLowerCase()) ||
    f.cliente?.toLowerCase().includes(busca.toLowerCase()) ||
    f.setor?.toLowerCase().includes(busca.toLowerCase()))
  )

  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA)
  const paginadas    = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fichas de Qualidade</h1>
          <p className="text-sm text-gray-500">
            {filtradas.length} ficha{filtradas.length !== 1 ? 's' : ''} encontrada{filtradas.length !== 1 ? 's' : ''}
            {totalPaginas > 1 && ` — página ${pagina} de ${totalPaginas}`}
          </p>
        </div>
        <Link href="/fichas/nova"
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
          <FilePlus size={16} /> Nova Ficha
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por número, assunto, cliente, setor..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os status</option>
          {STATUS_FILTRO.map(v => (
            <option key={v} value={v}>{STATUS_CONFIG[v].label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">Nenhuma ficha encontrada</p>
          <p className="text-sm mt-1">Crie uma nova ficha para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nº</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Assunto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Setor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Prioridade</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginadas.map(f => {
                  const sc = STATUS_CONFIG[f.status]
                  const pc = PRIORIDADE_CONFIG[f.prioridade as keyof typeof PRIORIDADE_CONFIG]
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">{f.numero}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate font-medium text-gray-900">{f.assunto || '—'}</p>
                        <p className="text-xs text-gray-400">{f.cliente}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.setor}</td>
                      <td className={`px-4 py-3 font-medium ${pc?.color}`}>{pc?.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc?.color}`}>
                          {f.reincidencias > 0 && f.status !== 'concluido' && <AlertTriangle size={10} />}
                          {sc?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {f.data}
                        {prazoVencido(f) && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
                            <AlertTriangle size={10} /> prazo vencido
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/fichas/${f.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm">
                            <Eye size={14} /> Ver
                          </Link>
                          <Link href={`/imprimir/${f.id}`} target="_blank"
                            title="Imprimir" className="text-gray-400 hover:text-gray-700 transition">
                            <Printer size={14} />
                          </Link>
                          <Link href={`/imprimir/${f.id}?share=1`} target="_blank"
                            title="Compartilhar PDF" className="text-gray-400 hover:text-green-600 transition">
                            <MessageCircle size={14} />
                          </Link>
                          <a href={`mailto:?subject=${encodeURIComponent(`Ficha de Qualidade — ${f.numero}`)}&body=${encodeURIComponent(
                            `FICHA DE QUALIDADE — ${f.numero}\n\nAssunto: ${f.assunto || '—'}\nSetor: ${f.setor}\nCliente: ${f.cliente || '—'}\nStatus: ${STATUS_CONFIG[f.status]?.label}\nPrioridade: ${f.prioridade}\nData: ${f.data}\n\nAcesse o sistema para ver os detalhes completos.`
                          )}`}
                            title="Enviar por e-mail" className="text-gray-400 hover:text-blue-600 transition">
                            <Mail size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtradas.length)} de {filtradas.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  ← Anterior
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                  .reduce((acc: (number | '...')[], p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i-1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === '...' ? (
                    <span key={`e${i}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => setPagina(p as number)}
                      className={`px-3 py-1.5 text-xs border rounded-lg ${pagina === p ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  ))
                }
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
