'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { UserCheck } from 'lucide-react'
import { SETORES, type Cargo } from '@/types'

const schema = z.object({
  nome:      z.string().min(3, 'Nome obrigatório'),
  cargo:     z.enum(['emitente','encarregado','gerente','qualidade','gestor','admin']),
  setor:     z.enum(SETORES as unknown as [string, ...string[]]),
  empresaId: z.string().min(2, 'Código da empresa obrigatório'),
})
type Form = z.infer<typeof schema>

const cargos: { value: Cargo; label: string }[] = [
  { value: 'emitente',    label: 'Emitente' },
  { value: 'encarregado', label: 'Encarregado' },
  { value: 'gerente',     label: 'Gerente' },
  { value: 'qualidade',   label: 'Resp. Qualidade' },
  { value: 'gestor',      label: 'Gestor' },
  { value: 'admin',       label: 'Administrador' },
]

export default function CompletarPerfilPage() {
  const { user, usuario, loading } = useAuth()
  const router = useRouter()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { cargo: 'admin' },
  })

  // Se já tem perfil, manda para fichas
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && usuario)  router.replace('/fichas')
  }, [user, usuario, loading, router])

  const onSubmit = async (data: Form) => {
    if (!user) return
    try {
      // Verifica se já existe (corrida de condição)
      const snap = await getDoc(doc(db, 'usuarios', user.uid))
      if (snap.exists()) {
        toast.success('Perfil encontrado! Redirecionando...')
        router.replace('/fichas')
        return
      }
      await setDoc(doc(db, 'usuarios', user.uid), {
        uid:       user.uid,
        nome:      data.nome,
        email:     user.email,
        cargo:     data.cargo,
        setor:     data.setor,
        empresaId: data.empresaId,
        ativo:     true,
        criadoEm:  serverTimestamp(),
      })
      toast.success('Perfil criado! Bem-vindo ao sistema.')
      // Força recarga para o AuthContext buscar o perfil
      window.location.href = '/fichas'
    } catch (e: any) {
      if (e?.code?.includes('permission')) {
        toast.error('Sem permissão. Publique as regras do Firestore primeiro.')
      } else {
        toast.error('Erro ao criar perfil: ' + (e?.message || ''))
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl font-black text-blue-800">JBC</span>
            <span className="text-sm font-bold text-blue-500 border-l-2 border-blue-300 pl-2">PERFIL</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Completar perfil</h1>
          <p className="text-sm text-gray-500 mt-1">
            Conta criada para <strong>{user?.email}</strong>.<br />
            Preencha os dados abaixo para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo</label>
            <input {...register('nome')} placeholder="João Silva"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.nome && <p className="text-red-500 text-xs mt-0.5">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cargo</label>
              <select {...register('cargo')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {cargos.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Setor</label>
              <select {...register('setor')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.setor && <p className="text-red-500 text-xs mt-0.5">{errors.setor.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código da Empresa</label>
            <input {...register('empresaId')} placeholder="Ex: JBC001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.empresaId && <p className="text-red-500 text-xs mt-0.5">{errors.empresaId.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60 mt-2">
            {isSubmitting
              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><UserCheck size={16} /> Salvar e Entrar</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
