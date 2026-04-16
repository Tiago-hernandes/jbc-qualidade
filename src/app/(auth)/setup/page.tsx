'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react'

const schema = z.object({
  nome:      z.string().min(3, 'Nome obrigatório'),
  email:     z.string().email('E-mail inválido'),
  senha:     z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar: z.string(),
  empresaId: z.string().min(2, 'Código da empresa obrigatório'),
}).refine(d => d.senha === d.confirmar, {
  message: 'Senhas não conferem',
  path: ['confirmar'],
})
type Form = z.infer<typeof schema>

export default function SetupPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [bloqueado,   setBloqueado]   = useState(false)
  const [ver,         setVer]         = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  // Verifica se já existe algum admin — se sim, bloqueia
  useEffect(() => {
    async function checar() {
      try {
        const q    = query(collection(db, 'usuarios'), where('cargo', '==', 'admin'))
        const snap = await getDocs(q)
        if (!snap.empty) setBloqueado(true)
      } catch {
        // Sem permissão = banco vazio, pode configurar
      } finally {
        setVerificando(false)
      }
    }
    checar()
  }, [])

  const onSubmit = async (data: Form) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.senha)
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        uid:       cred.user.uid,
        nome:      data.nome.toUpperCase(),
        email:     data.email,
        cargo:     'admin',
        setor:     'ADM',
        empresaId: data.empresaId.toUpperCase(),
        ativo:     true,
        criadoEm:  serverTimestamp(),
      })
      toast.success('Conta admin criada! Faça login para continuar.')
      router.replace('/login')
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use')
        toast.error('Este e-mail já está cadastrado')
      else
        toast.error('Erro ao criar conta: ' + (e?.message ?? ''))
    }
  }

  if (verificando) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  )

  if (bloqueado) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <Lock size={40} className="text-red-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Acesso bloqueado</h1>
        <p className="text-sm text-gray-500 mb-6">
          O sistema já possui uma conta administradora.<br />
          Apenas o admin pode criar novos usuários.
        </p>
        <button onClick={() => router.replace('/login')}
          className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800">
          Ir para o login
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl font-black text-blue-800">JBC</span>
            <span className="text-sm font-bold text-blue-500 border-l-2 border-blue-300 pl-2">PERFIL</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-blue-700" />
            <h1 className="text-xl font-bold text-gray-800">Configuração inicial</h1>
          </div>
          <p className="text-sm text-gray-500">Crie a conta administradora do sistema</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo</label>
            <input {...register('nome')} placeholder="João Silva"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.nome && <p className="text-red-500 text-xs mt-0.5">{errors.nome.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
            <input {...register('email')} type="email" placeholder="admin@empresa.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código da Empresa</label>
            <input {...register('empresaId')} placeholder="Ex: JBC001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
            {errors.empresaId && <p className="text-red-500 text-xs mt-0.5">{errors.empresaId.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input {...register('senha')} type={ver ? 'text' : 'password'} placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setVer(!ver)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {ver ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.senha && <p className="text-red-500 text-xs mt-0.5">{errors.senha.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar senha</label>
            <input {...register('confirmar')} type="password" placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.confirmar && <p className="text-red-500 text-xs mt-0.5">{errors.confirmar.message}</p>}
          </div>

          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
            <ShieldCheck size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Esta página só está disponível durante a configuração inicial.
              Após criar o admin, ela será bloqueada automaticamente.
            </p>
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60">
            {isSubmitting
              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><ShieldCheck size={16} /> Criar conta admin</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Já tem conta?{' '}
          <button onClick={() => router.replace('/login')} className="text-blue-600 hover:underline">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  )
}
