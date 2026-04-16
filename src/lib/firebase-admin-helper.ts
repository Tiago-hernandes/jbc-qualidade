/**
 * Instância secundária do Firebase usada APENAS para criar usuários.
 * Isso evita que o admin seja desconectado ao criar uma nova conta.
 */
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Cargo } from '@/types'

const SECONDARY_APP_NAME = 'admin-helper'

function getSecondaryApp() {
  const existing = getApps().find(a => a.name === SECONDARY_APP_NAME)
  if (existing) return existing
  return initializeApp(
    {
      apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    SECONDARY_APP_NAME
  )
}

export interface NovoUsuarioInput {
  nome:          string
  email:         string
  cargo:         Cargo
  setor:         string
  empresaId:     string
  pinAssinatura: string
}

export async function criarUsuarioPeloAdmin(dados: NovoUsuarioInput): Promise<void> {
  const secondaryAuth = getAuth(getSecondaryApp())

  // Senha temporária — usuário vai redefinir pelo e-mail
  const senhaTemp = `Temp${Math.random().toString(36).slice(2, 10)}!`

  // Cria no Firebase Auth via instância secundária (admin permanece logado)
  const cred = await createUserWithEmailAndPassword(secondaryAuth, dados.email, senhaTemp)

  // Desconecta a instância secundária imediatamente
  await secondaryAuth.signOut()

  // Cria o perfil no Firestore
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    uid:           cred.user.uid,
    nome:          dados.nome,
    email:         dados.email,
    cargo:         dados.cargo,
    setor:         dados.setor,
    empresaId:     dados.empresaId,
    ativo:         true,
    pinAssinatura: dados.pinAssinatura,
    criadoEm:      serverTimestamp(),
  })

  // Envia reset de senha via auth principal (não depende do estado da instância secundária)
  await sendPasswordResetEmail(auth, dados.email)
}
