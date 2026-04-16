'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/contexts/AuthContext'
import { criarFicha, uploadFoto } from '@/lib/firestore'
import toast from 'react-hot-toast'
import { Camera, Trash2, Save, Send } from 'lucide-react'
import { SETORES, type FotoEvidencia, type TipoOcorrencia, type Prioridade } from '@/types'

const TIPOS: { value: TipoOcorrencia; label: string }[] = [
  { value: 'qualidade',    label: 'Qualidade' },
  { value: 'processo',     label: 'Processo' },
  { value: 'seguranca',    label: 'Segurança' },
  { value: 'material',     label: 'Material' },
  { value: 'equipamento',  label: 'Equipamento' },
  { value: 'outro',        label: 'Outro' },
]

export default function NovaFichaPage() {
  const { usuario } = useAuth()
  const router      = useRouter()
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm()
  const [fotos, setFotos] = useState<FotoEvidencia[]>([])
  const [uploadando, setUploadando] = useState(false)

  const toUpper = (data: any) => Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const keepLower = ['prioridade', 'tipoOcorrencia', 'recorrencia', 'status']
      return [k, typeof v === 'string' && !keepLower.includes(k) ? v.toUpperCase() : v]
    })
  )

  const onSubmit = async (data: any, status: 'rascunho' | 'pendente') => {
    if (!usuario) return
    const d = toUpper(data)
    try {
      await criarFicha({
        ...d,
        setor:         ['admin','gestor'].includes(usuario.cargo) ? d.setor : usuario.setor,
        empresaId:     usuario.empresaId,
        emitenteId:    usuario.uid,
        nomeEmitente:  usuario.nome,
        status,
        fotos,
        assinaturas:   [],
        recorrencia:   data.recorrencia === 'true',
      })
      toast.success(status === 'rascunho' ? 'Rascunho salvo!' : 'Ficha enviada para aprovação!')
      router.push('/fichas')
    } catch {
      toast.error('Erro ao salvar ficha')
    }
  }

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !usuario) return
    if (fotos.length + files.length > 6) { toast.error('Máximo 6 fotos'); return }
    setUploadando(true)
    try {
      const novas = await Promise.all(
        Array.from(files).map((f, i) => uploadFoto('temp', usuario.empresaId, f, fotos.length + i))
      )
      setFotos(prev => [...prev, ...novas])
    } catch {
      toast.error('Erro ao enviar foto')
    } finally {
      setUploadando(false)
    }
  }

  const atualizarFoto = (id: string, campo: 'titulo' | 'descricao', valor: string) => {
    setFotos(prev => prev.map(f => f.id === id ? { ...f, [campo]: valor } : f))
  }

  const removerFoto = (id: string) => setFotos(prev => prev.filter(f => f.id !== id))

  const input = (label: string, name: string, opts: any = {}) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {opts.type === 'textarea'
        ? <textarea {...register(name)} rows={opts.rows || 4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none uppercase" />
        : <input {...register(name)} type={opts.type || 'text'} placeholder={opts.placeholder}
            className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500${opts.type === 'date' || opts.type === 'time' ? '' : ' uppercase'}`} />
      }
    </div>
  )

  return (
    <form className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nova Ficha de Qualidade</h1>
          <p className="text-sm text-gray-500">Preencha todos os campos obrigatórios</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSubmit(d => onSubmit(d, 'rascunho'))}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Save size={15} /> Rascunho
          </button>
          <button type="button" onClick={handleSubmit(d => onSubmit(d, 'pendente'))}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
            <Send size={15} /> Enviar
          </button>
        </div>
      </div>

      {/* Seção 1: Identificação */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">Identificação</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {input('Cliente', 'cliente', { placeholder: 'Nome do cliente' })}
          {input('Pedido / NF', 'pedidoNf', { placeholder: 'Nº pedido ou NF' })}
          {input('Data', 'data', { type: 'date' })}
          {input('Hora', 'hora', { type: 'time' })}
          {input('Local da Ocorrência', 'localOcorrencia', { placeholder: 'Ex: Linha 3' })}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Setor</label>
            {['admin','gestor'].includes(usuario?.cargo ?? '')
              ? <select {...register('setor')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase">
                  {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              : <input readOnly value={usuario?.setor ?? ''}
                  className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 uppercase cursor-not-allowed" />
            }
          </div>
          {input('Encarregado', 'encarregado', { placeholder: 'Nome do encarregado' })}
          {input('Gerente', 'gerente', { placeholder: 'Nome do gerente' })}
          {input('ID° Máquina', 'idMaquina', { placeholder: 'Ex: MAQ-001' })}
        </div>
      </section>

      {/* Seção 2: Classificação */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">Classificação</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Ocorrência</label>
            <select {...register('tipoOcorrencia')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Prioridade</label>
            <select {...register('prioridade')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Média</option>
              <option value="baixa">🟢 Baixa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recorrência</label>
            <select {...register('recorrencia')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            {input('Assunto da Ocorrência', 'assunto', { placeholder: 'Resumo em uma linha' })}
          </div>
        </div>
      </section>

      {/* Seção 3–7: Campos de texto */}
      {[
        { num: 1, title: 'Descrição da Ocorrência',  name: 'descricao' },
        { num: 2, title: 'Análise de Causa Raiz',    name: 'causaRaiz' },
        { num: 3, title: 'Parecer da Fábrica',       name: 'parecerFabrica' },
        { num: 4, title: 'Ação Corretiva',           name: 'acaoCorretiva' },
        { num: 5, title: 'Ação Preventiva',          name: 'acaoPreventiva' },
      ].map(s => (
        <section key={s.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-blue-700 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-white">{s.num}. {s.title}</h2>
          </div>
          <div className="p-4">
            <textarea {...register(s.name)} rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </section>
      ))}

      {/* Resolução */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">Resolução</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {input('Prazo para Solução', 'prazoSolucao', { type: 'date' })}
          {input('Responsável pela Solução', 'responsavelSolucao', { placeholder: 'Nome do responsável' })}
        </div>
      </section>

      {/* Evidências fotográficas */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-700 px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Evidências Fotográficas ({fotos.length}/6)</h2>
        </div>
        <div className="p-4">
          {/* Upload */}
          {fotos.length < 6 && (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition mb-4">
              <div className="flex flex-col items-center gap-2">
                {uploadando
                  ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  : <><Camera size={24} className="text-gray-400" />
                    <span className="text-sm text-gray-500">Clique ou arraste fotos aqui</span>
                    <span className="text-xs text-gray-400">JPG, PNG — máx. 5MB por foto</span></>
                }
              </div>
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleFoto} />
            </label>
          )}

          {/* Grid de fotos */}
          {fotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {fotos.map((foto, i) => (
                <div key={foto.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="relative">
                    <img src={foto.url} alt={`Foto ${i + 1}`} className="w-full h-36 object-cover" />
                    <button type="button" onClick={() => removerFoto(foto.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <Trash2 size={12} />
                    </button>
                    <span className="absolute top-2 left-2 bg-blue-700 text-white text-xs rounded px-1.5 py-0.5 font-medium">
                      Foto {i + 1}
                    </span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <input value={foto.titulo} onChange={e => atualizarFoto(foto.id, 'titulo', e.target.value)}
                      placeholder="Título"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input value={foto.descricao} onChange={e => atualizarFoto(foto.id, 'descricao', e.target.value)}
                      placeholder="Descrição do defeito"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Botões finais */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.push('/fichas')}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit(d => onSubmit(d, 'rascunho'))}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
          <Save size={15} /> Salvar Rascunho
        </button>
        <button type="button" onClick={handleSubmit(d => onSubmit(d, 'pendente'))}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
          {isSubmitting
            ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            : <><Send size={15} /> Enviar para Aprovação</>
          }
        </button>
      </div>
    </form>
  )
}
