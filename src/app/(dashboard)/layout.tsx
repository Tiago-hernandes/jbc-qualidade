'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import {
  FilePlus, FileText,
  BarChart2, Users, LogOut, Bell, Menu, X,
} from 'lucide-react'
import { useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const NAV = [
  { href: '/fichas',      icon: FileText,  label: 'Fichas',      cargos: ['emitente','encarregado','gerente','qualidade','gestor','admin'] },
  { href: '/fichas/nova', icon: FilePlus,  label: 'Nova Ficha',  cargos: ['emitente','encarregado','gerente','qualidade','gestor','admin'] },
  { href: '/alertas',     icon: Bell,      label: 'Alertas',     cargos: ['emitente','encarregado','gerente','qualidade','gestor','admin'] },
  { href: '/relatorios',  icon: BarChart2, label: 'Relatórios',  cargos: ['gerente','qualidade','gestor','admin'] },
  { href: '/admin',       icon: Users,     label: 'Usuários',    cargos: ['admin'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading, logout } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [menu, setMenu]   = useState(false)
  const [alertas, setAlertas] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!usuario) return
    // Query simples por empresaId apenas — filtra lido e setor em JS para evitar índice composto
    const q = query(collection(db, 'alertas'), where('empresaId', '==', usuario.empresaId))
    return onSnapshot(q, snap => {
      const todos = snap.docs.map(d => d.data())
      const naoLidos = todos.filter(a => {
        if (a.lido) return false
        if (!['admin','gestor'].includes(usuario.cargo) && a.setor !== usuario.setor) return false
        return true
      })
      setAlertas(naoLidos.length)
    })
  }, [usuario])

  // Ainda carregando auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
      </div>
    )
  }

  // Auth carregou mas sem sessão → redireciona
  if (!loading && !user) {
    router.replace('/login')
    return null
  }
  if (!loading && !usuario) {
    router.replace('/completar-perfil')
    return null
  }

  const navPermitido = NAV.filter(n => n.cargos.includes(usuario!.cargo))

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex print:hidden flex-col w-60 bg-blue-900 text-white min-h-screen">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-blue-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black">JBC</span>
            <span className="text-xs font-bold text-blue-300 border-l border-blue-600 pl-2">PERFIL</span>
          </div>
          <p className="text-xs text-blue-400 mt-0.5">Sistema de Qualidade</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navPermitido.map(n => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                  ${active ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`}>
                <n.icon size={18} />
                <span className="flex-1">{n.label}</span>
                {n.href === '/alertas' && alertas > 0 && (
                  <span className="bg-amber-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {alertas > 9 ? '9+' : alertas}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Usuário */}
        <div className="px-4 py-4 border-t border-blue-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {usuario!.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{usuario!.nome}</p>
              <p className="text-xs text-blue-400 capitalize">{usuario!.cargo}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 text-xs text-blue-300 hover:text-white py-1.5 transition">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="mobile-header lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black">JBC</span>
          <span className="text-xs text-blue-300 border-l border-blue-600 pl-2">PERFIL</span>
        </div>
        <div className="flex items-center gap-3">
          {alertas > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {alertas}
            </span>
          )}
          <button onClick={() => setMenu(!menu)}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-blue-900 text-white pt-16 px-4">
          <nav className="space-y-1">
            {navPermitido.map(n => (
              <Link key={n.href} href={n.href} onClick={() => setMenu(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-blue-100 hover:bg-blue-800">
                <n.icon size={20} />
                {n.label}
              </Link>
            ))}
          </nav>
          <button onClick={logout}
            className="flex items-center gap-2 text-sm text-blue-300 px-3 py-3 mt-4">
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        {/* Barra de alertas */}
        {alertas > 0 && (
          <Link href="/alertas" className="hidden lg:flex bg-amber-50 border-b border-amber-200 px-6 py-2 items-center gap-2 text-sm text-amber-800 hover:bg-amber-100 transition">
            <Bell size={14} className="text-amber-600" />
            <strong>{alertas}</strong> alerta{alertas > 1 ? 's' : ''} não lido{alertas > 1 ? 's' : ''} — clique para ver
          </Link>
        )}
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  )
}
