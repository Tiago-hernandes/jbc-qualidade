'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Usuario } from '@/types'

interface AuthContextType {
  user:       User | null
  usuario:    Usuario | null
  loading:    boolean
  login:      (email: string, senha: string) => Promise<void>
  logout:     () => Promise<void>
  resetSenha: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          // Tenta até 3 vezes com intervalo — token Firebase pode não estar pronto
          let snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
          if (!snap.exists()) {
            await new Promise(r => setTimeout(r, 1000))
            snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
          }
          if (snap.exists()) setUsuario(snap.data() as Usuario)
        } catch {
          // Silencia erros de permissão — dashboard vai redirecionar
        }
      } else {
        setUsuario(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const resetSenha = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{ user, usuario, loading, login, logout, resetSenha }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
