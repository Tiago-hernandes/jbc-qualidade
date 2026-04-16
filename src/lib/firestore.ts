import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore'
// orderBy e limit ainda usados em getFichas
import { db } from './firebase'
import type { Ficha, Usuario, FotoEvidencia } from '@/types'

// ── Usuários ────────────────────────────────────────────────
export async function getUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? (snap.data() as Usuario) : null
}

export async function getUsuariosByEmpresa(empresaId: string): Promise<Usuario[]> {
  const q = query(collection(db, 'usuarios'), where('empresaId', '==', empresaId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => d.data() as Usuario)
    .filter(u => u.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

// ── Fichas ──────────────────────────────────────────────────
export async function criarFicha(dados: Omit<Ficha, 'id' | 'numero' | 'criadoEm' | 'atualizadoEm'>): Promise<string> {
  const numero = await gerarNumeroFicha(dados.empresaId)
  const ref2 = await addDoc(collection(db, 'fichas'), {
    ...dados,
    numero,
    criadoEm:     serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    reincidencias: 0,
  })
  await verificarReincidencia(ref2.id, dados)
  return ref2.id
}

export async function atualizarFicha(id: string, dados: Partial<Ficha>): Promise<void> {
  await updateDoc(doc(db, 'fichas', id), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  })
}

export async function getFicha(id: string): Promise<Ficha | null> {
  const snap = await getDoc(doc(db, 'fichas', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Ficha) : null
}

export async function getFichas(empresaId: string, filtros: {
  status?:   string
  setor?:    string
  prioridade?: string
  limite?:   number
} = {}): Promise<Ficha[]> {
  const constraints: QueryConstraint[] = [
    where('empresaId', '==', empresaId),
  ]
  if (filtros.status)     constraints.push(where('status',     '==', filtros.status))
  if (filtros.setor)      constraints.push(where('setor',      '==', filtros.setor))
  if (filtros.prioridade) constraints.push(where('prioridade', '==', filtros.prioridade))

  const snap = await getDocs(query(collection(db, 'fichas'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Ficha))
}

// ── Compressão e conversão para base64 (sem Firebase Storage) ──
export async function uploadFoto(
  _fichaId: string,
  _empresaId: string,
  file: File,
  ordem: number
): Promise<FotoEvidencia> {
  const base64 = await comprimirParaBase64(file, 800, 0.7)
  return { id: `${Date.now()}_${ordem}`, url: base64, titulo: '', descricao: '', ordem }
}

function comprimirParaBase64(file: File, maxPx: number, qualidade: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = e => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx }
          else                { width  = Math.round((width  * maxPx) / height); height = maxPx }
        }
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', qualidade))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Numeração automática ────────────────────────────────────
async function gerarNumeroFicha(empresaId: string): Promise<string> {
  const ano  = new Date().getFullYear()
  const q    = query(collection(db, 'fichas'), where('empresaId', '==', empresaId))
  const snap = await getDocs(q)
  const seq  = snap.size + 1
  return `RQ-${ano}-${String(seq).padStart(4, '0')}`
}

// ── Detecção de reincidência ────────────────────────────────
async function verificarReincidencia(fichaId: string, dados: Partial<Ficha>): Promise<void> {
  // Busca todas as fichas da empresa com mesmo tipo — filtra status em JS para evitar índice composto
  const q    = query(
    collection(db, 'fichas'),
    where('empresaId',      '==', dados.empresaId),
    where('tipoOcorrencia', '==', dados.tipoOcorrencia),
  )
  const snap = await getDocs(q)
  const anteriores = snap.docs.filter(d => {
    const s = d.data().status
    return ['concluido', 'em_andamento'].includes(s) && d.id !== fichaId
  })
  if (anteriores.length > 0) {
    await updateDoc(doc(db, 'fichas', fichaId), { reincidencias: anteriores.length })
    await addDoc(collection(db, 'alertas'), {
      fichaId,
      empresaId:          dados.empresaId,
      setor:              dados.setor,
      tipo:               'reincidencia',
      mensagem:           `Reincidência detectada: ${anteriores.length}x para ${dados.tipoOcorrencia} na máquina ${dados.idMaquina}`,
      fichasRelacionadas: anteriores.map(d => d.id),
      criadoEm:           serverTimestamp(),
      lido:               false,
    })
  }
}

// ── Alertas ─────────────────────────────────────────────────
export async function getAlertas(empresaId: string, setor?: string) {
  const q    = query(collection(db, 'alertas'), where('empresaId', '==', empresaId))
  const snap = await getDocs(q)
  let alertas = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any)
  if (setor) alertas = alertas.filter((a: any) => a.setor === setor)
  return alertas.sort((a: any, b: any) => {
    const ta = a.criadoEm?.seconds ?? 0
    const tb = b.criadoEm?.seconds ?? 0
    return tb - ta
  })
}

export async function marcarAlertaLido(id: string): Promise<void> {
  await updateDoc(doc(db, 'alertas', id), { lido: true })
}

export async function marcarTodosLidos(empresaId: string, setor?: string): Promise<void> {
  const alertas = await getAlertas(empresaId, setor)
  const naoLidos = alertas.filter((a: any) => !a.lido)
  await Promise.all(naoLidos.map((a: any) => marcarAlertaLido(a.id)))
}

// ── Estatísticas para dashboard ────────────────────────────
export async function getEstatisticas(
  empresaId: string,
  filtros: { setor?: string; dataInicio?: Date; dataFim?: Date } = {}
) {
  // Fetch all fichas for empresa (single where to avoid index issues)
  const q = query(collection(db, 'fichas'), where('empresaId', '==', empresaId))
  const snap = await getDocs(q)
  let fichas = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ficha))

  // Filter in JS
  if (filtros.setor) fichas = fichas.filter(f => f.setor === filtros.setor)
  if (filtros.dataInicio) fichas = fichas.filter(f => {
    const t = (f.criadoEm as any)?.seconds
    return t ? new Date(t * 1000) >= filtros.dataInicio! : false
  })
  if (filtros.dataFim) fichas = fichas.filter(f => {
    const t = (f.criadoEm as any)?.seconds
    return t ? new Date(t * 1000) <= filtros.dataFim! : true
  })

  const porStatus = fichas.reduce((acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc }, {} as Record<string, number>)
  const porTipo   = fichas.reduce((acc, f) => { acc[f.tipoOcorrencia] = (acc[f.tipoOcorrencia] || 0) + 1; return acc }, {} as Record<string, number>)
  const porSetor  = fichas.reduce((acc, f) => { acc[f.setor] = (acc[f.setor] || 0) + 1; return acc }, {} as Record<string, number>)

  // Trend: fichas per month for the last 12 months
  const porMes: Record<string, number> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    porMes[key] = 0
  }
  fichas.forEach(f => {
    const t = (f.criadoEm as any)?.seconds
    if (!t) return
    const d = new Date(t * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key in porMes) porMes[key]++
  })

  const reincidentes = fichas
    .filter(f => f.reincidencias > 0)
    .sort((a, b) => b.reincidencias - a.reincidencias)
    .slice(0, 5)

  return { total: fichas.length, porStatus, porTipo, porSetor, reincidentes, porMes }
}
