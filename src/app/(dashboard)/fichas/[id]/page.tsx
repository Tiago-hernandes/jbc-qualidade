'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getFicha, atualizarFicha } from '@/lib/firestore'
import type { Ficha, StatusFicha, Assinatura } from '@/types'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle, XCircle,
  Pencil, AlertTriangle, PenLine, Printer, Mail, MessageCircle, KeyRound,
  MessageSquare, Send,
} from 'lucide-react'
import Link from 'next/link'
import { collection, addDoc, serverTimestamp, getDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { enviarEmailFichaConcluida } from '@/lib/email'

const STATUS_CONFIG: Record<StatusFicha, { label: string; color: string; bg: string }> = {
  rascunho:     { label: 'Rascunho',     color: 'text-gray-700',   bg: 'bg-gray-100' },
  pendente:     { label: 'Pendente',     color: 'text-yellow-800', bg: 'bg-yellow-100' },
  em_andamento: { label: 'Em Andamento', color: 'text-blue-800',   bg: 'bg-blue-100' },
  concluido:    { label: 'Concluído',    color: 'text-green-800',  bg: 'bg-green-100' },
  cancelado:    { label: 'Cancelado',    color: 'text-red-800',    bg: 'bg-red-100' },
}

const TIPO_LABELS: Record<string, string> = {
  qualidade: 'Qualidade', processo: 'Processo', seguranca: 'Segurança',
  material: 'Material', equipamento: 'Equipamento', outro: 'Outro',
}

// ── Modal de PIN ─────────────────────────────────────────────
function PinModal({ nome, onConfirmar, onCancelar }: {
  nome: string
  onConfirmar: (pin: string) => void
  onCancelar:  () => void
}) {
  const [pin, setPin]     = useState(['', '', '', ''])
  const [erro, setErro]   = useState('')
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => { refs[0].current?.focus() }, [])

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const d = val.slice(-1)
    const novo = [...pin]
    novo[i] = d
    setPin(novo)
    setErro('')
    if (d && i < 3) refs[i + 1].current?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
    if (e.key === 'Enter') confirmar()
  }

  const confirmar = () => {
    const full = pin.join('')
    if (full.length !== 4) { setErro('Digite os 4 dígitos'); return }
    onConfirmar(full)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <KeyRound size={22} className="text-blue-700" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">Confirmar Assinatura</h3>
          <p className="text-sm text-gray-500 mt-1">
            Olá, <strong>{nome}</strong>. Digite seu PIN de 4 dígitos para assinar.
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={pin[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition
                ${erro ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500'}`}
            />
          ))}
        </div>

        {erro && <p className="text-center text-red-500 text-sm mb-3">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onCancelar}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={confirmar}
            className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function FichaDetalhe() {
  const { id }      = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const router      = useRouter()
  const [ficha,     setFicha]     = useState<Ficha | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [salvando,    setSalvando]    = useState(false)
  const [pinAberto,   setPinAberto]   = useState(false)
  const [pinErro,     setPinErro]     = useState('')
  const [modalCancelar,    setModalCancelar]    = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [comentarios,       setComentarios]       = useState<any[]>([])
  const [novoComentario,    setNovoComentario]    = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  useEffect(() => {
    if (!id) return
    getFicha(id).then(f => { setFicha(f); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(
      collection(db, 'fichas', id, 'comentarios'),
      snap => {
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.criadoEm?.seconds ?? 0) - (b.criadoEm?.seconds ?? 0))
        setComentarios(lista)
      }
    )
    return unsub
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )

  if (!ficha) return (
    <div className="text-center py-20 text-gray-500">
      <p className="font-medium">Ficha não encontrada</p>
      <Link href="/fichas" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
        Voltar à lista
      </Link>
    </div>
  )

  const sc  = STATUS_CONFIG[ficha.status]
  const podeMudarStatus = usuario?.cargo && ['encarregado','gerente','qualidade','admin'].includes(usuario.cargo)
  const podeAssinar    = usuario && !ficha.assinaturas.some(a => a.userId === usuario.uid)
  const jaAssinou      = ficha.assinaturas.some(a => a.userId === usuario?.uid)

  // Controle de assinaturas obrigatórias
  // O gerente deve ser uma pessoa DIFERENTE do emitente
  const emitenteAssinou = ficha.assinaturas.some(a => a.userId === ficha.emitenteId)
  const gerenteAssinou  = ficha.assinaturas.some(a =>
    ['gerente','qualidade','gestor','admin'].includes(a.cargo) &&
    a.userId !== ficha.emitenteId
  )
  const fichaCompleta   = emitenteAssinou && gerenteAssinou

  const mudarStatus = async (novoStatus: StatusFicha) => {
    if (!ficha) return
    setSalvando(true)
    try {
      await atualizarFicha(ficha.id, { status: novoStatus })
      setFicha(prev => prev ? { ...prev, status: novoStatus } : null)
      toast.success(`Status alterado para "${STATUS_CONFIG[novoStatus].label}"`)
    } catch {
      toast.error('Erro ao alterar status')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarCancelamento = async () => {
    if (!ficha) return
    setSalvando(true)
    try {
      const motivo = motivoCancelamento.trim() || 'Cancelado pelo gerente'
      await atualizarFicha(ficha.id, { status: 'cancelado', motivoCancelamento: motivo })
      setFicha(prev => prev ? { ...prev, status: 'cancelado', motivoCancelamento: motivo } : null)
      toast.success('Ficha cancelada')
      setModalCancelar(false)
      setMotivoCancelamento('')
    } catch {
      toast.error('Erro ao cancelar ficha')
    } finally {
      setSalvando(false)
    }
  }

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !usuario || !ficha) return
    setEnviandoComentario(true)
    try {
      await addDoc(collection(db, 'fichas', ficha.id, 'comentarios'), {
        texto:    novoComentario.trim(),
        userId:   usuario.uid,
        nome:     usuario.nome,
        cargo:    usuario.cargo,
        criadoEm: serverTimestamp(),
      })
      setNovoComentario('')
    } catch {
      toast.error('Erro ao enviar comentário')
    } finally {
      setEnviandoComentario(false)
    }
  }

  const assinar = async (pin: string) => {
    if (!usuario || !ficha) return
    setSalvando(true)
    try {
      // Valida o PIN contra o Firestore
      const userSnap = await getDoc(doc(db, 'usuarios', usuario.uid))
      const userData  = userSnap.data()
      if (!userData?.pinAssinatura) {
        toast.error('Você não tem PIN cadastrado. Solicite ao administrador.')
        setPinAberto(false)
        return
      }
      if (userData.pinAssinatura !== pin) {
        toast.error('PIN incorreto. Tente novamente.')
        return  // mantém o modal aberto
      }

      setPinAberto(false)

      const novaAssinatura: Assinatura = {
        userId:    usuario.uid,
        nome:      usuario.nome,
        cargo:     usuario.cargo,
        timestamp: new Date().toISOString(),
      }
      const novas = [...ficha.assinaturas, novaAssinatura]

      // Verifica se todas as assinaturas obrigatórias foram coletadas
      // O gerente deve ser uma pessoa DIFERENTE do emitente
      const emitenteAssinou = novas.some(a => a.userId === ficha.emitenteId)
      const gerenteAssinou  = novas.some(a =>
        ['gerente','qualidade','gestor','admin'].includes(a.cargo) &&
        a.userId !== ficha.emitenteId
      )
      const deveConcluir    = emitenteAssinou && gerenteAssinou

      await atualizarFicha(ficha.id, {
        assinaturas: novas,
        ...(deveConcluir ? { status: 'concluido' } : {}),
      })
      setFicha(prev => prev ? {
        ...prev,
        assinaturas: novas,
        ...(deveConcluir ? { status: 'concluido' } : {}),
      } : null)

      // Quando o emitente assina, notifica gerente/qualidade
      if (novaAssinatura.userId === ficha.emitenteId) {
        await addDoc(collection(db, 'alertas'), {
          tipo:        'assinatura_pendente',
          fichaId:     ficha.id,
          fichaNumero: ficha.numero,
          mensagem:    `Ficha ${ficha.numero} aguarda assinatura do gerente`,
          setor:       ficha.setor,
          empresaId:   ficha.empresaId,
          lido:        false,
          criadoEm:    serverTimestamp(),
        })
      }

      if (deveConcluir) {
        toast.success('✅ Assinaturas completas! Ficha concluída.')
        // Envia e-mail de notificação em background (não bloqueia a UI)
        enviarEmailFichaConcluida(
          { ...ficha, assinaturas: novas, status: 'concluido' },
          ficha.empresaId
        ).catch(() => {}) // silencia erros de e-mail
      } else {
        toast.success('Assinatura confirmada com sucesso!')
      }
    } catch {
      toast.error('Erro ao registrar assinatura')
    } finally {
      setSalvando(false)
    }
  }

  const Campo = ({ label, value }: { label: string; value?: string | null }) => (
    value ? (
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-gray-900 break-words">{value}</p>
      </div>
    ) : null
  )

  const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-blue-700 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">{titulo}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="space-y-3">

        {/* Linha 1: voltar + número + badges */}
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/fichas')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0 mt-0.5">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 font-mono">{ficha.numero}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${sc.bg} ${sc.color}`}>
                {sc.label}
              </span>
              {ficha.reincidencias > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                  <AlertTriangle size={10} /> {ficha.reincidencias}x recorrência
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{ficha.assunto || 'Sem assunto'}</p>
          </div>
        </div>

        {/* Linha 2: progresso de assinaturas */}
        {!['cancelado','concluido','rascunho'].includes(ficha.status) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 w-fit">
            <span className={emitenteAssinou ? 'text-green-600 font-semibold' : 'text-gray-400'}>
              {emitenteAssinou ? '✓' : '○'} Emitente
            </span>
            <span className="text-gray-300">|</span>
            <span className={gerenteAssinou ? 'text-green-600 font-semibold' : 'text-gray-400'}>
              {gerenteAssinou ? '✓' : '○'} Gerente
            </span>
          </div>
        )}

        {/* Linha 3: botões de ação — scroll horizontal no mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [&::-webkit-scrollbar]:hidden">

          {podeAssinar && !jaAssinou && !fichaCompleta && !['cancelado','concluido'].includes(ficha.status) && (
            <button onClick={() => setPinAberto(true)} disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0">
              <PenLine size={14} /> Assinar
            </button>
          )}
          {jaAssinou && (
            <span className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium whitespace-nowrap shrink-0">
              <CheckCircle size={14} /> Assinado
            </span>
          )}
          {['rascunho','pendente'].includes(ficha.status) && ficha.assinaturas?.length === 0 && (ficha.emitenteId === usuario?.uid || usuario?.cargo === 'admin') && (
            <Link href={`/fichas/${ficha.id}/editar`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap shrink-0">
              <Pencil size={14} /> Editar
            </Link>
          )}
          {podeMudarStatus && !['cancelado','concluido'].includes(ficha.status) && (
            <button onClick={() => setModalCancelar(true)} disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 whitespace-nowrap shrink-0">
              <XCircle size={14} /> Cancelar
            </button>
          )}
          <Link href={`/imprimir/${ficha.id}`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap shrink-0">
            <Printer size={14} /> Imprimir
          </Link>
          {/* WhatsApp — abre o app direto com o resumo da ficha */}
          <a href={`https://wa.me/?text=${encodeURIComponent(
            `*FICHA DE QUALIDADE — ${ficha.numero}*\n\n` +
            `📋 *Assunto:* ${ficha.assunto || '—'}\n` +
            `🏭 *Setor:* ${ficha.setor}\n` +
            `👤 *Cliente:* ${ficha.cliente || '—'}\n` +
            `📊 *Status:* ${STATUS_CONFIG[ficha.status]?.label}\n` +
            `🔴 *Prioridade:* ${ficha.prioridade || '—'}\n` +
            `📅 *Data:* ${ficha.data}\n\n` +
            `🔗 Acesse: ${typeof window !== 'undefined' ? window.location.href : ''}`
          )}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-green-50 hover:text-green-700 hover:border-green-200 whitespace-nowrap shrink-0">
            <MessageCircle size={14} /> WhatsApp
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`Ficha de Qualidade — ${ficha.numero}`)}&body=${encodeURIComponent(
            `FICHA DE QUALIDADE — ${ficha.numero}\n\nAssunto: ${ficha.assunto || '—'}\nSetor: ${ficha.setor}\nCliente: ${ficha.cliente || '—'}\nStatus: ${STATUS_CONFIG[ficha.status]?.label}\nPrioridade: ${ficha.prioridade}\nData: ${ficha.data}\n\nDescrição:\n${ficha.descricao || '—'}\n\nAção Corretiva:\n${ficha.acaoCorretiva || '—'}`
          )}`}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 whitespace-nowrap shrink-0 mr-4 sm:mr-0">
            <Mail size={14} /> E-mail
          </a>
        </div>
      </div>

      {/* Banner: motivo de cancelamento */}
      {ficha.motivoCancelamento && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span><strong>Motivo do cancelamento:</strong> {ficha.motivoCancelamento}</span>
        </div>
      )}

      {/* Banner: prazo vencido */}
      {ficha.prazoSolucao && !['concluido','cancelado'].includes(ficha.status) && new Date(ficha.prazoSolucao) < new Date() && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={16} />
          <span>Prazo de solução vencido em <strong>{new Date(ficha.prazoSolucao).toLocaleDateString('pt-BR')}</strong></span>
        </div>
      )}

      {/* Identificação */}
      <Secao titulo="Identificação">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Campo label="Emitente"      value={ficha.nomeEmitente} />
          <Campo label="Data"          value={ficha.data} />
          <Campo label="Hora"          value={ficha.hora} />
          <Campo label="Cliente"       value={ficha.cliente} />
          <Campo label="Pedido / NF"   value={ficha.pedidoNf} />
          <Campo label="Setor"         value={ficha.setor} />
          <Campo label="Local"         value={ficha.localOcorrencia} />
          <Campo label="Encarregado"   value={ficha.encarregado} />
          <Campo label="Gerente"       value={ficha.gerente} />
          <Campo label="ID Máquina"    value={ficha.idMaquina} />
          <Campo label="Tipo"          value={TIPO_LABELS[ficha.tipoOcorrencia] || ficha.tipoOcorrencia} />
          <Campo label="Prioridade"    value={ficha.prioridade} />
          <Campo label="Prazo"         value={ficha.prazoSolucao} />
          <Campo label="Responsável"   value={ficha.responsavelSolucao} />
        </div>
      </Secao>

      {/* Textos */}
      {[
        { titulo: '1. Descrição da Ocorrência', value: ficha.descricao },
        { titulo: '2. Análise de Causa Raiz',   value: ficha.causaRaiz },
        { titulo: '3. Parecer da Fábrica',      value: ficha.parecerFabrica },
        { titulo: '4. Ação Corretiva',          value: ficha.acaoCorretiva },
        { titulo: '5. Ação Preventiva',         value: ficha.acaoPreventiva },
      ].filter(s => s.value).map(s => (
        <Secao key={s.titulo} titulo={s.titulo}>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.value}</p>
        </Secao>
      ))}

      {/* Fotos */}
      {ficha.fotos?.length > 0 && (
        <Secao titulo={`Evidências Fotográficas (${ficha.fotos.length})`}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ficha.fotos.map((foto, i) => (
              <div key={foto.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="relative">
                  <img src={foto.url} alt={foto.titulo || `Foto ${i + 1}`} className="w-full h-40 object-cover" />
                  <span className="absolute top-2 left-2 bg-blue-700 text-white text-xs rounded px-1.5 py-0.5">
                    Foto {i + 1}
                  </span>
                </div>
                {(foto.titulo || foto.descricao) && (
                  <div className="p-2">
                    {foto.titulo    && <p className="text-xs font-medium text-gray-800">{foto.titulo}</p>}
                    {foto.descricao && <p className="text-xs text-gray-500 mt-0.5">{foto.descricao}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* Assinaturas */}
      <Secao titulo={`Assinaturas (${ficha.assinaturas?.length || 0})`}>
        {!ficha.assinaturas?.length ? (
          <p className="text-sm text-gray-500 text-center py-4">Nenhuma assinatura registrada</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ficha.assinaturas.map((a, i) => (
              <div key={i} className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.nome}</p>
                  <p className="text-xs text-gray-500 capitalize">{a.cargo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* Comentários */}
      <Secao titulo="Comentários">
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
          {comentarios.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 flex flex-col items-center gap-2">
              <MessageSquare size={20} className="text-gray-300" />
              Nenhum comentário ainda
            </p>
          ) : (
            comentarios.map((c: any) => {
              const isMine = c.userId === usuario?.uid
              return (
                <div key={c.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-xs sm:max-w-md px-3 py-2 rounded-xl text-sm ${
                    isMine ? 'bg-blue-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                    {c.texto}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.nome} · {c.cargo}
                    {c.criadoEm?.seconds && ` · ${new Date(c.criadoEm.seconds * 1000).toLocaleString('pt-BR')}`}
                  </p>
                </div>
              )
            })
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <input
            value={novoComentario}
            onChange={e => setNovoComentario(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario() } }}
            placeholder="Escreva um comentário..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={enviarComentario}
            disabled={enviandoComentario || !novoComentario.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
            {enviandoComentario
              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><Send size={14} /> Enviar</>
            }
          </button>
        </div>
      </Secao>

      {/* Modal de PIN */}
      {pinAberto && (
        <PinModal
          nome={usuario?.nome ?? ''}
          onConfirmar={assinar}
          onCancelar={() => setPinAberto(false)}
        />
      )}

      {/* Modal: Cancelar ficha */}
      {modalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <XCircle size={22} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Cancelar Ficha</h3>
              <p className="text-sm text-gray-500 mt-1">Informe o motivo do cancelamento (opcional)</p>
            </div>
            <textarea
              value={motivoCancelamento}
              onChange={e => setMotivoCancelamento(e.target.value)}
              rows={3}
              placeholder="Ex: Problema resolvido informalmente, duplicidade, etc."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setModalCancelar(false); setMotivoCancelamento('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={confirmarCancelamento} disabled={salvando}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {salvando ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
