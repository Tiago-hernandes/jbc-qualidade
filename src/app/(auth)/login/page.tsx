'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import Link from 'next/link'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { login, resetSenha } = useAuth()
  const router   = useRouter()
  const [ver, setVer] = useState(false)
  const [loadingReset, setLoadingReset] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      await login(data.email, data.senha)
      router.push('/fichas')
    } catch {
      toast.error('E-mail ou senha inválidos')
    }
  }

  const handleReset = async () => {
    const email = getValues('email')
    if (!email) { toast.error('Informe o e-mail primeiro'); return }
    setLoadingReset(true)
    try {
      await resetSenha(email)
      toast.success('Link de recuperação enviado!')
    } catch {
      toast.error('Erro ao enviar e-mail de recuperação')
    } finally {
      setLoadingReset(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl font-black text-blue-800">JBC</span>
            <span className="text-sm font-bold text-blue-500 border-l-2 border-blue-300 pl-2">PERFIL</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Sistema de Qualidade</h1>
          <p className="text-gray-500 text-sm mt-1">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                {...register('senha')}
                type={ver ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="button" onClick={() => setVer(!ver)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {ver ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.senha && <p className="text-red-500 text-xs mt-1">{errors.senha.message}</p>}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={handleReset} disabled={loadingReset}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50">
              {loadingReset ? 'Enviando...' : 'Esqueci minha senha'}
            </button>
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60">
            {isSubmitting
              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><LogIn size={16} /> Entrar</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/setup" className="hover:text-gray-600 transition">
            Primeiro acesso ao sistema
          </Link>
        </p>
      </div>
    </div>
  )
}
