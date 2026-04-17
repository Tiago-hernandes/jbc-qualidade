'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getFicha } from '@/lib/firestore'
import type { Ficha } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', pendente: 'Pendente', em_andamento: 'Em Andamento',
  concluido: 'Concluído', cancelado: 'Cancelado',
}
const TIPO_LABEL: Record<string, string> = {
  qualidade: 'Qualidade', processo: 'Processo', seguranca: 'Segurança',
  material: 'Material', equipamento: 'Equipamento', outro: 'Outro',
}

export default function ImprimirFicha() {
  const { id }    = useParams<{ id: string }>()
  const [ficha, setFicha] = useState<Ficha | null>(null)

  useEffect(() => {
    if (!id) return
    getFicha(id).then(f => {
      setFicha(f)
      if (f) setTimeout(() => window.print(), 800)
    })
  }, [id])

  if (!ficha) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )

  const Linha = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="mb-1">
      <span className="font-bold text-xs uppercase tracking-wide text-gray-500">{label}: </span>
      <span className="text-sm text-gray-900">{value || '—'}</span>
    </div>
  )

  const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div className="mb-4 break-inside-avoid">
      <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
        {titulo}
      </div>
      <div className="px-3">{children}</div>
    </div>
  )

  const TextoSecao = ({ titulo, value }: { titulo: string; value?: string }) => (
    value ? (
      <div className="mb-4 break-inside-avoid">
        <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
          {titulo}
        </div>
        <div className="px-3 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed min-h-[40px]">
          {value}
        </div>
      </div>
    ) : null
  )

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; background: white; }
      `}</style>

      {/* Botão imprimir — some no print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button onClick={() => window.print()}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-800">
          🖨️ Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-gray-300">
          Fechar
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto p-6 bg-white text-gray-900" style={{ minHeight: '297mm' }}>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b-2 border-blue-800 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-blue-800">JBC</span>
              <span className="text-xs font-bold text-blue-600 border-l border-blue-400 pl-2 uppercase">PERFIL</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Sistema de Qualidade</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-blue-800 font-mono">{ficha.numero}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Ficha de Qualidade</p>
          </div>
        </div>

        {/* Status e info rápida */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          {[
            { label: 'Status',     value: STATUS_LABEL[ficha.status] },
            { label: 'Prioridade', value: ficha.prioridade?.toUpperCase() },
            { label: 'Setor',      value: ficha.setor },
            { label: 'Data',       value: ficha.data },
          ].map(c => (
            <div key={c.label} className="border border-gray-200 rounded p-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{c.value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Identificação */}
        <Secao titulo="Identificação">
          <div className="grid grid-cols-3 gap-x-6 gap-y-1 py-1">
            <Linha label="Emitente"     value={ficha.nomeEmitente} />
            <Linha label="Cliente"      value={ficha.cliente} />
            <Linha label="Pedido / NF"  value={ficha.pedidoNf} />
            <Linha label="Local"        value={ficha.localOcorrencia} />
            <Linha label="Encarregado"  value={ficha.encarregado} />
            <Linha label="Gerente"      value={ficha.gerente} />
            <Linha label="Máquina"      value={ficha.idMaquina} />
            <Linha label="Tipo"         value={TIPO_LABEL[ficha.tipoOcorrencia] || ficha.tipoOcorrencia} />
            <Linha label="Recorrência"  value={ficha.recorrencia ? 'Sim' : 'Não'} />
          </div>
          {ficha.assunto && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <span className="font-bold text-xs uppercase tracking-wide text-gray-500">Assunto: </span>
              <span className="text-sm font-semibold text-gray-900">{ficha.assunto}</span>
            </div>
          )}
        </Secao>

        {/* Textos */}
        <TextoSecao titulo="1. Descrição da Ocorrência" value={ficha.descricao} />
        <TextoSecao titulo="2. Análise de Causa Raiz"   value={ficha.causaRaiz} />
        <TextoSecao titulo="3. Parecer da Fábrica"      value={ficha.parecerFabrica} />
        <TextoSecao titulo="4. Ação Corretiva"          value={ficha.acaoCorretiva} />
        <TextoSecao titulo="5. Ação Preventiva"         value={ficha.acaoPreventiva} />

        {/* Resolução */}
        {(ficha.prazoSolucao || ficha.responsavelSolucao) && (
          <Secao titulo="Resolução">
            <div className="grid grid-cols-2 gap-4 py-1">
              <Linha label="Prazo para Solução"       value={ficha.prazoSolucao} />
              <Linha label="Responsável pela Solução" value={ficha.responsavelSolucao} />
            </div>
          </Secao>
        )}

        {/* Fotos */}
        {ficha.fotos?.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
              Evidências Fotográficas ({ficha.fotos.length})
            </div>
            <div className="grid grid-cols-3 gap-3 px-3">
              {ficha.fotos.map((foto, i) => (
                <div key={foto.id} className="border border-gray-200 rounded overflow-hidden">
                  <img src={foto.url} alt={foto.titulo || `Foto ${i + 1}`}
                    className="w-full h-32 object-cover" />
                  {(foto.titulo || foto.descricao) && (
                    <div className="p-1.5">
                      {foto.titulo    && <p className="text-xs font-medium">{foto.titulo}</p>}
                      {foto.descricao && <p className="text-xs text-gray-500">{foto.descricao}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assinaturas */}
        <div className="mb-4 break-inside-avoid">
          <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
            Assinaturas ({ficha.assinaturas?.length || 0})
          </div>
          <div className="grid grid-cols-3 gap-4 px-3">
            {ficha.assinaturas?.length > 0 ? (
              ficha.assinaturas.map((a, i) => (
                <div key={i} className="border border-green-200 bg-green-50 rounded p-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900">{a.nome}</p>
                  <p className="text-xs text-gray-500 capitalize">{a.cargo}</p>
                  <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleDateString('pt-BR')}</p>
                </div>
              ))
            ) : (
              // Espaços em branco para assinar fisicamente
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="h-16 border-b border-dashed border-gray-300 mb-2" />
                  <p className="text-xs text-gray-400 text-center">Assinatura</p>
                  <div className="mt-1 h-4 border-b border-dashed border-gray-300" />
                  <p className="text-xs text-gray-400 text-center mt-0.5">Nome / Cargo</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="border-t border-gray-200 pt-2 mt-4 flex justify-between text-xs text-gray-400">
          <span>JBC PERFIL — Sistema de Qualidade</span>
          <span>{ficha.numero} — Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </>
  )
}
