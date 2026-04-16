export const SETORES = [
  'INJEÇÃO', 'EXTRUSÃO', 'METALIZAÇÃO',
  'EXPEDIÇÃO', 'FERRAMENTARIA', 'ADM', 'TRANSPORTE',
] as const
export type Setor = typeof SETORES[number]

export type Cargo = 'emitente' | 'encarregado' | 'gerente' | 'qualidade' | 'gestor' | 'admin'

export type StatusFicha = 'rascunho' | 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'

export type TipoOcorrencia =
  | 'qualidade' | 'processo' | 'seguranca'
  | 'material'  | 'equipamento' | 'outro'

export type Prioridade = 'alta' | 'media' | 'baixa'

export interface Usuario {
  uid:           string
  nome:          string
  email:         string
  cargo:         Cargo
  setor:         string
  empresaId:     string
  ativo:         boolean
  criadoEm:      string
  pinAssinatura?: string   // PIN de 4 dígitos para assinar fichas
}

export interface Assinatura {
  userId:    string
  nome:      string
  cargo:     Cargo
  timestamp: string
}

export interface FotoEvidencia {
  id:        string
  url:       string
  titulo:    string
  descricao: string
  ordem:     number
}

export interface Ficha {
  id:            string
  numero:        string
  empresaId:     string

  // Identificação
  nomeEmitente:  string
  emitenteId:    string
  cliente:       string
  pedidoNf:      string
  data:          string
  hora:          string

  // Localização
  localOcorrencia: string
  setor:           string
  encarregado:     string
  encarregadoId:   string
  gerente:         string
  gerenteId:       string
  idMaquina:       string

  // Classificação
  tipoOcorrencia: TipoOcorrencia
  prioridade:     Prioridade
  recorrencia:    boolean
  assunto:        string

  // Conteúdo
  descricao:     string
  causaRaiz:     string
  parecerFabrica: string
  acaoCorretiva: string
  acaoPreventiva: string

  // Resolução
  prazoSolucao:      string
  responsavelSolucao: string
  status:            StatusFicha

  // Evidências
  fotos: FotoEvidencia[]

  // Assinaturas
  assinaturas:   Assinatura[]
  pdfUrl?:       string

  // Cancelamento
  motivoCancelamento?: string

  // Metadados
  criadoEm:      string
  atualizadoEm:  string
  reincidencias: number
}
