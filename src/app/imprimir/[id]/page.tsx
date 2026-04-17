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
  const [ficha,   setFicha]   = useState<Ficha | null>(null)
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    if (!id) return
    getFicha(id).then(f => {
      setFicha(f)
      if (f) setTimeout(() => window.print(), 800)
    })
  }, [id])

  const gerarECompartilhar = async () => {
    if (!ficha) return
    setGerando(true)
    try {
      const { jsPDF } = await import('jspdf')

      const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W        = 210
      const margin   = 15
      const contentW = W - margin * 2
      let y          = margin

      // ── Helpers ──────────────────────────────────────────────
      const checkPageBreak = (needed = 20) => {
        if (y + needed > 280) { pdf.addPage(); y = margin }
      }

      const sectionBar = (title: string) => {
        checkPageBreak(12)
        y += 2
        pdf.setFillColor(30, 58, 138)
        pdf.rect(margin, y, contentW, 7, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(7.5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(title.toUpperCase(), margin + 2, y + 5)
        pdf.setTextColor(0, 0, 0)
        y += 10
      }

      const textBlock = (text: string) => {
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(30, 30, 30)
        const lines = pdf.splitTextToSize(text, contentW - 4)
        lines.forEach((l: string) => {
          checkPageBreak(5)
          pdf.text(l, margin + 2, y)
          y += 4.5
        })
        y += 2
      }

      // ── Cabeçalho ─────────────────────────────────────────────
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 58, 138)
      pdf.text('JBC', margin, y + 6)
      pdf.setFontSize(8)
      pdf.setTextColor(80, 100, 180)
      pdf.text('PERFIL', margin + 13, y + 6)

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 58, 138)
      pdf.text(ficha.numero, W - margin, y + 5, { align: 'right' })
      pdf.setFontSize(7)
      pdf.setTextColor(120)
      pdf.text('FICHA DE QUALIDADE', W - margin, y + 10, { align: 'right' })

      y += 14
      pdf.setDrawColor(30, 58, 138)
      pdf.setLineWidth(0.5)
      pdf.line(margin, y, W - margin, y)
      y += 6

      // ── Cards de status ───────────────────────────────────────
      const cards = [
        { label: 'STATUS',     value: STATUS_LABEL[ficha.status] },
        { label: 'PRIORIDADE', value: ficha.prioridade?.toUpperCase() || '—' },
        { label: 'SETOR',      value: ficha.setor },
        { label: 'DATA',       value: ficha.data },
      ]
      const cardW = (contentW - 6) / 4
      cards.forEach((c, i) => {
        const cx = margin + i * (cardW + 2)
        pdf.setDrawColor(200)
        pdf.setLineWidth(0.3)
        pdf.rect(cx, y, cardW, 12)
        pdf.setFontSize(6)
        pdf.setTextColor(120)
        pdf.setFont('helvetica', 'normal')
        pdf.text(c.label, cx + cardW / 2, y + 4, { align: 'center' })
        pdf.setFontSize(8)
        pdf.setTextColor(0)
        pdf.setFont('helvetica', 'bold')
        pdf.text(c.value || '—', cx + cardW / 2, y + 9, { align: 'center' })
      })
      y += 16

      // ── Identificação ─────────────────────────────────────────
      sectionBar('Identificação')

      const col3W = (contentW - 4) / 3
      const cols  = [margin, margin + col3W + 2, margin + (col3W + 2) * 2]

      const fieldRow = (
        pairs: { label: string; value?: string | null }[]
      ) => {
        const rowH = 9
        pairs.forEach((p, i) => {
          pdf.setFontSize(6.5)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(100)
          pdf.text((p.label + ':').toUpperCase(), cols[i], y)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(0)
          pdf.setFontSize(8.5)
          const val = pdf.splitTextToSize(p.value || '—', col3W - 2)
          pdf.text(val[0] ?? '', cols[i], y + 4)
        })
        y += rowH
      }

      fieldRow([
        { label: 'Emitente',    value: ficha.nomeEmitente },
        { label: 'Cliente',     value: ficha.cliente },
        { label: 'Pedido / NF', value: ficha.pedidoNf },
      ])
      fieldRow([
        { label: 'Local',       value: ficha.localOcorrencia },
        { label: 'Encarregado', value: ficha.encarregado },
        { label: 'Gerente',     value: ficha.gerente },
      ])
      fieldRow([
        { label: 'Máquina',     value: ficha.idMaquina },
        { label: 'Tipo',        value: TIPO_LABEL[ficha.tipoOcorrencia] || ficha.tipoOcorrencia },
        { label: 'Recorrência', value: ficha.recorrencia ? 'Sim' : 'Não' },
      ])

      if (ficha.assunto) {
        pdf.setFontSize(6.5)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(100)
        pdf.text('ASSUNTO:', margin, y)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(0)
        pdf.setFontSize(9)
        pdf.text(ficha.assunto, margin + 18, y)
        y += 7
      }

      // ── Seções de texto ───────────────────────────────────────
      const textos = [
        { titulo: '1. Descrição da Ocorrência', valor: ficha.descricao },
        { titulo: '2. Análise de Causa Raiz',   valor: ficha.causaRaiz },
        { titulo: '3. Parecer da Fábrica',      valor: ficha.parecerFabrica },
        { titulo: '4. Ação Corretiva',          valor: ficha.acaoCorretiva },
        { titulo: '5. Ação Preventiva',         valor: ficha.acaoPreventiva },
      ]
      textos.forEach(s => {
        if (!s.valor) return
        sectionBar(s.titulo)
        textBlock(s.valor)
      })

      // ── Resolução ─────────────────────────────────────────────
      if (ficha.prazoSolucao || ficha.responsavelSolucao) {
        sectionBar('Resolução')
        fieldRow([
          { label: 'Prazo',        value: ficha.prazoSolucao },
          { label: 'Responsável',  value: ficha.responsavelSolucao },
          { label: '',             value: '' },
        ])
        y += 4
      }

      // ── Assinaturas ───────────────────────────────────────────
      checkPageBreak(50)
      sectionBar(`Assinaturas (${ficha.assinaturas?.length || 0})`)

      if (ficha.assinaturas?.length > 0) {
        ficha.assinaturas.forEach((a) => {
          checkPageBreak(14)
          // Caixa com fundo verde claro
          pdf.setFillColor(240, 253, 244)
          pdf.setDrawColor(134, 239, 172)
          pdf.setLineWidth(0.3)
          pdf.rect(margin, y, contentW, 12, 'FD')
          // Símbolo ✓
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(22, 163, 74)
          pdf.text('✓', margin + 4, y + 8)
          // Nome e cargo
          pdf.setFontSize(9)
          pdf.setTextColor(0)
          pdf.text(a.nome, margin + 12, y + 5)
          pdf.setFontSize(7.5)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(80)
          pdf.text(a.cargo, margin + 12, y + 9.5)
          // Data
          pdf.setFontSize(7.5)
          pdf.setTextColor(120)
          pdf.text(new Date(a.timestamp).toLocaleString('pt-BR'), W - margin - 2, y + 7, { align: 'right' })
          y += 14
        })
      } else {
        for (let i = 0; i < 2; i++) {
          pdf.setDrawColor(180)
          pdf.setLineWidth(0.3)
          ;(pdf as any).setLineDash([2, 2])
          pdf.rect(margin + i * (contentW / 2 + 2), y, contentW / 2 - 2, 14)
          ;(pdf as any).setLineDash([])
          pdf.setFontSize(7)
          pdf.setTextColor(160)
          pdf.text('Aguardando assinatura', margin + i * (contentW / 2 + 2) + (contentW / 2 - 2) / 2, y + 8, { align: 'center' })
        }
        y += 18
      }

      // ── Rodapé ────────────────────────────────────────────────
      pdf.setDrawColor(200)
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, W - margin, y)
      y += 4
      pdf.setFontSize(7)
      pdf.setTextColor(150)
      pdf.setFont('helvetica', 'normal')
      pdf.text('JBC PERFIL — Sistema de Qualidade', margin, y)
      pdf.text(`${ficha.numero} — Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - margin, y, { align: 'right' })

      // ── Compartilhar / Baixar ─────────────────────────────────
      const nomeArquivo = `ficha-${ficha.numero}.pdf`
      const pdfBlob     = pdf.output('blob')
      const pdfFile     = new File([pdfBlob], nomeArquivo, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Ficha de Qualidade — ${ficha.numero}`,
          text:  `${ficha.numero} — ${ficha.assunto || ficha.setor}`,
          files: [pdfFile],
        })
      } else {
        const url  = URL.createObjectURL(pdfBlob)
        const link = document.createElement('a')
        link.href     = url
        link.download = nomeArquivo
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      console.error('Erro PDF:', err)
      if (err?.name !== 'AbortError') {
        alert(`Erro ao gerar PDF: ${err?.message ?? 'desconhecido'}`)
      }
    } finally {
      setGerando(false)
    }
  }

  if (!ficha) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
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
        body { font-family: Arial, sans-serif; background: white; margin: 0; padding: 0; }
      `}</style>

      {/* Botões */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button onClick={gerarECompartilhar} disabled={gerando}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
          {gerando
            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Gerando...</>
            : '📤 Compartilhar PDF'
          }
        </button>
        <button onClick={() => window.print()}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-800">
          🖨️ Imprimir
        </button>
        <button onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-gray-300">
          Fechar
        </button>
      </div>

      {/* Conteúdo visual para impressão */}
      <div className="max-w-[210mm] mx-auto p-6 bg-white text-gray-900" style={{ minHeight: '297mm' }}>

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

        <TextoSecao titulo="1. Descrição da Ocorrência" value={ficha.descricao} />
        <TextoSecao titulo="2. Análise de Causa Raiz"   value={ficha.causaRaiz} />
        <TextoSecao titulo="3. Parecer da Fábrica"      value={ficha.parecerFabrica} />
        <TextoSecao titulo="4. Ação Corretiva"          value={ficha.acaoCorretiva} />
        <TextoSecao titulo="5. Ação Preventiva"         value={ficha.acaoPreventiva} />

        {(ficha.prazoSolucao || ficha.responsavelSolucao) && (
          <Secao titulo="Resolução">
            <div className="grid grid-cols-2 gap-4 py-1">
              <Linha label="Prazo para Solução"       value={ficha.prazoSolucao} />
              <Linha label="Responsável pela Solução" value={ficha.responsavelSolucao} />
            </div>
          </Secao>
        )}

        {ficha.fotos?.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
              Evidências Fotográficas ({ficha.fotos.length})
            </div>
            <div className="grid grid-cols-3 gap-3 px-3">
              {ficha.fotos.map((foto, i) => (
                <div key={foto.id} className="border border-gray-200 rounded overflow-hidden">
                  <img src={foto.url} alt={foto.titulo || `Foto ${i + 1}`} className="w-full h-32 object-cover" />
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

        <div className="mb-4 break-inside-avoid">
          <div className="bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 mb-2">
            Assinaturas ({ficha.assinaturas?.length || 0})
          </div>
          <div className="grid grid-cols-3 gap-4 px-3">
            {ficha.assinaturas?.length > 0 ? (
              ficha.assinaturas.map((a, i) => (
                <div key={i} className="border border-green-200 bg-green-50 rounded p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 border border-green-300 flex items-center justify-center flex-shrink-0 text-green-600 font-bold text-sm">✓</div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{a.nome}</p>
                    <p className="text-xs text-gray-500 capitalize">{a.cargo}</p>
                    <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              ))
            ) : (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border border-dashed border-gray-300 rounded p-4 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Aguardando assinatura</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2 mt-4 flex justify-between text-xs text-gray-400">
          <span>JBC PERFIL — Sistema de Qualidade</span>
          <span>{ficha.numero} — Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </>
  )
}
