import { send as emailjsSend } from '@emailjs/browser'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Ficha } from '@/types'

export interface ConfigEmail {
  serviceId:           string
  templateId:          string
  publicKey:           string
  emailsNotificacao:   string[]
}

export async function getConfigEmail(empresaId: string): Promise<ConfigEmail | null> {
  const snap = await getDoc(doc(db, 'configuracoes', empresaId))
  if (!snap.exists()) return null
  return snap.data() as ConfigEmail
}

export async function salvarConfigEmail(empresaId: string, config: ConfigEmail): Promise<void> {
  // Trim all string values to avoid whitespace issues
  const sanitized: ConfigEmail = {
    serviceId:         config.serviceId.trim(),
    templateId:        config.templateId.trim(),
    publicKey:         config.publicKey.trim(),
    emailsNotificacao: config.emailsNotificacao.map(e => e.trim()),
  }
  await setDoc(doc(db, 'configuracoes', empresaId), sanitized, { merge: true })
}

export async function enviarEmailFichaConcluida(ficha: Ficha, empresaId: string): Promise<void> {
  const raw = await getConfigEmail(empresaId)
  if (!raw?.serviceId || !raw?.templateId || !raw?.publicKey) return
  if (!raw.emailsNotificacao?.length) return

  // Always trim to avoid whitespace issues
  const config: ConfigEmail = {
    serviceId:         raw.serviceId.trim(),
    templateId:        raw.templateId.trim(),
    publicKey:         raw.publicKey.trim(),
    emailsNotificacao: raw.emailsNotificacao.map(e => e.trim()),
  }

  const origem = typeof window !== 'undefined' ? window.location.origin : 'https://jbc-qualidade.netlify.app'

  const base = {
    ficha_numero:    ficha.numero,
    ficha_assunto:   ficha.assunto || '—',
    ficha_setor:     ficha.setor,
    ficha_data:      ficha.data,
    ficha_emitente:  ficha.nomeEmitente,
    ficha_cliente:   ficha.cliente || '—',
    ficha_descricao: ficha.descricao || '—',
    ficha_acao:      ficha.acaoCorretiva || '—',
    ficha_url:       `${origem}/fichas/${ficha.id}`,
  }

  console.log('[EmailJS] Enviando notificação de ficha concluída:', {
    serviceId:  config.serviceId,
    templateId: config.templateId,
    destinos:   config.emailsNotificacao,
    fichaId:    ficha.id,
    numero:     ficha.numero,
  })

  await Promise.all(
    config.emailsNotificacao.map(email =>
      emailjsSend(
        config.serviceId,
        config.templateId,
        { ...base, emails_destino: email },
        { publicKey: config.publicKey }
      )
    )
  )
}

export async function testarConfigEmail(empresaId: string): Promise<void> {
  const raw = await getConfigEmail(empresaId)
  if (!raw?.serviceId || !raw?.templateId || !raw?.publicKey)
    throw new Error('Configuração incompleta. Preencha Service ID, Template ID e Public Key.')
  if (!raw.emailsNotificacao?.length)
    throw new Error('Adicione pelo menos um e-mail de destino.')

  // Always trim to avoid whitespace issues
  const config: ConfigEmail = {
    serviceId:         raw.serviceId.trim(),
    templateId:        raw.templateId.trim(),
    publicKey:         raw.publicKey.trim(),
    emailsNotificacao: raw.emailsNotificacao.map(e => e.trim()),
  }

  console.log('[EmailJS] Sending test with:', {
    serviceId:  config.serviceId,
    templateId: config.templateId,
    publicKey:  config.publicKey,
    to:         config.emailsNotificacao,
  })

  const base = {
    ficha_numero:    'RQ-TESTE',
    ficha_assunto:   'E-mail de teste do sistema',
    ficha_setor:     'TESTE',
    ficha_data:      new Date().toLocaleDateString('pt-BR'),
    ficha_emitente:  'Sistema JBC',
    ficha_cliente:   'Teste',
    ficha_descricao: 'Este é um e-mail de teste para verificar a configuração.',
    ficha_acao:      'Nenhuma ação necessária.',
    ficha_url:       window.location.origin,
  }

  await Promise.all(
    config.emailsNotificacao.map(email =>
      emailjsSend(
        config.serviceId,
        config.templateId,
        { ...base, emails_destino: email },
        { publicKey: config.publicKey }
      )
    )
  )
}
