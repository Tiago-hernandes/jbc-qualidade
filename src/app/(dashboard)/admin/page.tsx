'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import {
  collection, query, where, onSnapshot,
  doc, updateDoc,
} from 'firebase/firestore'
import { criarUsuarioPeloAdmin } from '@/lib/firebase-admin-helper'
import { getConfigEmail, salvarConfigEmail, testarConfigEmail, type ConfigEmail } from '@/lib/email'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { SETORES, type Usuario, type Cargo } from '@/types'
import {
  UserPlus, UserCheck, UserX, Shield,
  Mail, Building2, X, KeyRound, Bell, Plus, Trash2,
} from 'lucide-react'

const CARGOS: { value: Cargo; label: string; desc: string }[] = [
  { value: 'emitente',    label: 'Emitente',         desc: 'Cria e preenche fichas' },
  { value: 'encarregado', label: 'Encarregado',       desc: 'Visualiza, assina e comenta' },
  { value: 'gerente',     label: 'Gerente',           desc: 'Aprova e assina fichas' },
  { value: 'qualidade',   label: 'Resp. Qualidade',   desc: 'Acesso total + relatórios' },
  { value: 'gestor',      label: 'Gestor',            desc: 'Acesso total a todos os setores' },
  { value: 'admin',       label: 'Administrador',     desc: 'Gerencia usuários e sistema' },
]

const CARGO_COLORS: Record<Cargo, string> = {
  emitente:    'bg-gray-100   text-gray-700',
  encarregado: 'bg-blue-100   text-blue-800',
  gerente:     'bg-purple-100 text-purple-800',
  qualidade:   'bg-green-100  text-green-800',
  gestor:      'bg-orange-100 text-orange-800',
  admin:       'bg-red-100    text-red-800',
}

const schema = z.object({
  nome:          z.string().min(3, 'Nome obrigatório'),
  email:         z.string().email('E-mail inválido'),
  cargo:         z.enum(['emitente','encarregado','gerente','qualidade','gestor','admin']),
  setor:         z.enum(SETORES as unknown as [string, ...string[]]),
  pinAssinatura: z.string().length(4, 'PIN deve ter exatamente 4 dígitos').regex(/^\d{4}$/, 'Somente números'),
})

type Form = z.infer<typeof schema>

export default function AdminPage() {
  const { usuario } = useAuth()
  const router      = useRouter()
  const [usuarios,  setUsuarios]  = useState<Usuario[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,       setModal]       = useState(false)
  const [avisoPin,    setAvisoPin]    = useState<{ nome: string; email: string; pin: string } | null>(null)
  const [modalPin,    setModalPin]    = useState<{ uid: string; nome: string } | null>(null)
  const [novoPin,     setNovoPin]     = useState('')
  const [pinErroCfg,  setPinErroCfg]  = useState('')
  const [salvandoPin, setSalvandoPin] = useState(false)
  const [configEmail, setConfigEmail] = useState<ConfigEmail>({ serviceId: '', templateId: '', publicKey: '', emailsNotificacao: [] })
  const [novoEmail,   setNovoEmail]   = useState('')
  const [salvandoCfg, setSalvandoCfg] = useState(false)
  const [testando,    setTestando]    = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { cargo: 'emitente' },
  })

  // Redireciona se não for admin
  useEffect(() => {
    if (usuario && usuario.cargo !== 'admin') router.replace('/fichas')
  }, [usuario, router])

  // Carrega configuração de e-mail
  useEffect(() => {
    if (!usuario) return
    getConfigEmail(usuario.empresaId).then(cfg => {
      if (cfg) setConfigEmail(cfg)
    })
  }, [usuario])

  const salvarConfig = async () => {
    if (!usuario) return
    setSalvandoCfg(true)
    try {
      await salvarConfigEmail(usuario.empresaId, configEmail)
      toast.success('Configurações salvas!')
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSalvandoCfg(false)
    }
  }

  const adicionarEmail = () => {
    const e = novoEmail.trim().toLowerCase()
    if (!e.includes('@')) { toast.error('E-mail inválido'); return }
    if (configEmail.emailsNotificacao.includes(e)) { toast.error('E-mail já cadastrado'); return }
    setConfigEmail(prev => ({ ...prev, emailsNotificacao: [...prev.emailsNotificacao, e] }))
    setNovoEmail('')
  }

  const removerEmail = (email: string) => {
    setConfigEmail(prev => ({ ...prev, emailsNotificacao: prev.emailsNotificacao.filter(e => e !== email) }))
  }

  // Carrega usuários da empresa em tempo real
  useEffect(() => {
    if (!usuario) return
    const q = query(
      collection(db, 'usuarios'),
      where('empresaId', '==', usuario.empresaId),
    )
    return onSnapshot(q, snap => {
      setUsuarios(snap.docs.map(d => d.data() as Usuario))
      setLoading(false)
    })
  }, [usuario])

  const onSubmit = async (data: Form) => {
    if (!usuario) return
    try {
      await criarUsuarioPeloAdmin({ ...data, empresaId: usuario.empresaId })
      reset()
      setModal(false)
      setAvisoPin({ nome: data.nome, email: data.email, pin: data.pinAssinatura })
    } catch (e: any) {
      const code = e?.code ?? ''
      if (code === 'auth/email-already-in-use')
        toast.error('Este e-mail já está cadastrado no sistema')
      else if (code === 'auth/invalid-email')
        toast.error('E-mail inválido')
      else if (code === 'auth/weak-password')
        toast.error('Senha muito fraca (mínimo 6 caracteres)')
      else if (code === 'auth/operation-not-allowed')
        toast.error('Login com e-mail não está ativado no Firebase')
      else {
        console.error('Erro ao criar usuário:', e)
        toast.error(`Erro: ${e?.message ?? 'desconhecido'}`)
      }
    }
  }

  const toggleAtivo = async (uid: string, ativo: boolean) => {
    await updateDoc(doc(db, 'usuarios', uid), { ativo: !ativo })
    toast.success(!ativo ? 'Usuário ativado' : 'Usuário desativado')
  }

  const salvarPin = async () => {
    if (!modalPin) return
    if (!/^\d{4}$/.test(novoPin)) { setPinErroCfg('O PIN deve ter exatamente 4 dígitos numéricos'); return }
    setSalvandoPin(true)
    try {
      await updateDoc(doc(db, 'usuarios', modalPin.uid), { pinAssinatura: novoPin })
      toast.success(`PIN de ${modalPin.nome} atualizado!`)
      setModalPin(null)
      setNovoPin('')
      setPinErroCfg('')
    } catch {
      toast.error('Erro ao atualizar PIN')
    } finally {
      setSalvandoPin(false)
    }
  }

  const ativos   = usuarios.filter(u => u.ativo)
  const inativos = usuarios.filter(u => !u.ativo)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-blue-700" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ativos.length} usuário{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
            {inativos.length > 0 && ` · ${inativos.length} inativo${inativos.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition">
          <UserPlus size={16} /> Novo Usuário
        </button>
      </div>

      {/* Cards de cargos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CARGOS.map(c => {
          const qtd = usuarios.filter(u => u.cargo === c.value && u.ativo).length
          return (
            <div key={c.value} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${CARGO_COLORS[c.value]}`}>
                {c.label}
              </span>
              <p className="text-2xl font-bold text-gray-900">{qtd}</p>
              <p className="text-xs text-gray-500">{c.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Lista de usuários */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuário</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cargo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Setor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                usuarios.map(u => (
                  <tr key={u.uid} className={`hover:bg-gray-50 transition ${!u.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.nome}
                            {u.uid === usuario?.uid && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-normal">você</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail size={10} /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${CARGO_COLORS[u.cargo]}`}>
                        {CARGOS.find(c => c.value === u.cargo)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 flex items-center gap-1">
                      <Building2 size={13} className="text-gray-400" /> {u.setor}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
                        ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.ativo ? <UserCheck size={11} /> : <UserX size={11} />}
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.uid !== usuario?.uid && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleAtivo(u.uid, u.ativo)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition
                              ${u.ativo
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-green-200 text-green-600 hover:bg-green-50'
                              }`}>
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </button>
                          <button onClick={() => { setModalPin({ uid: u.uid, nome: u.nome }); setNovoPin(''); setPinErroCfg('') }}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                            PIN
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Configurações de notificação por e-mail */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bell size={16} className="text-blue-700" /> Notificações por E-mail
        </h2>
        <p className="text-xs text-gray-500">
          Quando uma ficha for <strong>concluída</strong>, um e-mail será enviado automaticamente para os endereços abaixo.
          Requer conta gratuita no <a href="https://www.emailjs.com" target="_blank" className="text-blue-600 underline">EmailJS</a>.
        </p>

        {/* Credenciais EmailJS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Service ID',   key: 'serviceId',   placeholder: 'service_xxxxxx' },
            { label: 'Template ID',  key: 'templateId',  placeholder: 'template_xxxxxx' },
            { label: 'Public Key',   key: 'publicKey',   placeholder: 'sua_public_key' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
              <input
                value={(configEmail as any)[f.key]}
                onChange={e => setConfigEmail(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        {/* Lista de e-mails */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">E-mails para notificação</label>
          <div className="flex gap-2 mb-2">
            <input
              value={novoEmail}
              onChange={e => setNovoEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarEmail()}
              placeholder="email@empresa.com"
              type="email"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={adicionarEmail}
              className="flex items-center gap-1 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={15} /> Adicionar
            </button>
          </div>
          {configEmail.emailsNotificacao.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Nenhum e-mail cadastrado</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {configEmail.emailsNotificacao.map(e => (
                <span key={e} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  <Mail size={11} /> {e}
                  <button onClick={() => removerEmail(e)} className="hover:text-red-500 transition ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={salvarConfig} disabled={salvandoCfg}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
            {salvandoCfg ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          <button onClick={async () => {
            if (!usuario) return
            setTestando(true)
            try {
              await testarConfigEmail(usuario.empresaId)
              toast.success('✅ E-mail de teste enviado! Verifique sua caixa de entrada.')
            } catch (e: any) {
              console.error('EmailJS erro completo:', e)
              const msg = typeof e === 'string' ? e : (e?.text || e?.message || JSON.stringify(e))
              toast.error(`Erro EmailJS: ${msg}`)
            } finally {
              setTestando(false)
            }
          }} disabled={testando}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            {testando ? 'Enviando...' : '📧 Testar Envio'}
          </button>
        </div>
      </div>

      {/* Modal: Novo Usuário */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={18} className="text-blue-700" /> Novo Usuário
              </h2>
              <button onClick={() => { setModal(false); reset() }}
                className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome completo</label>
                <input {...register('nome')} placeholder="João Silva"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.nome && <p className="text-red-500 text-xs mt-0.5">{errors.nome.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">E-mail</label>
                <input {...register('email')} type="email" placeholder="joao@empresa.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo</label>
                  <select {...register('cargo')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CARGOS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Setor</label>
                  <select {...register('setor')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.setor && <p className="text-red-500 text-xs mt-0.5">{errors.setor.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <KeyRound size={12} /> PIN de Assinatura (4 dígitos)
                </label>
                <input {...register('pinAssinatura')} type="text" inputMode="numeric"
                  maxLength={4} placeholder="Ex: 1234"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center font-mono text-lg" />
                {errors.pinAssinatura && <p className="text-red-500 text-xs mt-0.5">{errors.pinAssinatura.message}</p>}
                <p className="text-xs text-gray-400 mt-0.5">Usado para confirmar assinaturas nas fichas</p>
              </div>

              {/* Info sobre o e-mail */}
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                <Mail size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Um e-mail será enviado automaticamente para o usuário definir sua própria senha.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setModal(false); reset() }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
                  {isSubmitting
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    : <><UserPlus size={15} /> Criar e Convidar</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resetar PIN de usuário */}
      {modalPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound size={22} className="text-blue-700" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Redefinir PIN</h3>
              <p className="text-sm text-gray-500 mt-1">
                Defina um novo PIN de 4 dígitos para <strong>{modalPin.nome}</strong>
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Novo PIN (4 dígitos)</label>
              <input
                value={novoPin}
                onChange={e => { setNovoPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinErroCfg('') }}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                className={`w-full border rounded-lg px-3 py-2 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${pinErroCfg ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {pinErroCfg && <p className="text-red-500 text-xs mt-1">{pinErroCfg}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalPin(null); setNovoPin(''); setPinErroCfg('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvarPin} disabled={salvandoPin}
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
                {salvandoPin ? 'Salvando...' : 'Salvar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Aviso de PIN após criação */}
      {avisoPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserCheck size={22} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Usuário criado com sucesso!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Um e-mail foi enviado para <strong>{avisoPin.email}</strong> para definir a senha.
              </p>
            </div>

            {/* Mensagem pronta para enviar */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mensagem para enviar ao usuário</p>
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                {`Olá, ${avisoPin.nome}! 👋\n\nSua conta foi criada no sistema JBC Qualidade.\n\n📧 E-mail: ${avisoPin.email}\n🔑 PIN de assinatura: *${avisoPin.pin}*\n\nVerifique seu e-mail para definir sua senha de acesso.\n\nGuarde seu PIN — ele será pedido sempre que precisar assinar uma ficha.`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Olá, ${avisoPin.nome}! 👋\n\nSua conta foi criada no sistema JBC Qualidade.\n\n📧 E-mail: ${avisoPin.email}\n🔑 PIN de assinatura: ${avisoPin.pin}\n\nVerifique seu e-mail para definir sua senha de acesso.\n\nGuarde seu PIN — ele será pedido sempre que precisar assinar uma ficha.`
                  )
                  toast.success('Mensagem copiada!')
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                📋 Copiar mensagem
              </button>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Olá, ${avisoPin.nome}! 👋\n\nSua conta foi criada no sistema JBC Qualidade.\n\n📧 E-mail: ${avisoPin.email}\n🔑 PIN de assinatura: ${avisoPin.pin}\n\nVerifique seu e-mail para definir sua senha de acesso.\n\nGuarde seu PIN — ele será pedido sempre que precisar assinar uma ficha.`
                )}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                WhatsApp
              </a>
            </div>

            <button onClick={() => setAvisoPin(null)}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
