import { useState } from 'react';
import { CreditCard, RefreshCw, Upload, FileCheck2, Download, Printer, QrCode } from 'lucide-react';
import type { Evento, EventoCategoria, InscricaoStatus, PagamentoInscricao } from '../../types/eventos';
import { PixPaymentBox } from '../PixPaymentBox';
import { consultarPagamentoPix, enviarArquivo, gerarCobrancaPix } from '../../utils/eventos/eventosService';
import { formatarDataHora, formatarMoeda, mensagemErro } from '../../utils/eventos/eventosRules';
import { pdfComprovantePagamento } from '../../utils/eventos/eventosPdf';
import { useDialog } from '../../context/CustomDialogContext';
import { Alerta } from './EventosUI';
import { MODO_EMULADOR } from '../../firebase';

const workerUrl = import.meta.env.VITE_WORKER_URL as string;

interface Props {
    evento: Evento;
    categoria?: EventoCategoria;
    inscricaoId: string;
    inscritoNome: string;
    responsavel: { nome: string; cpf: string; email: string; telefone: string };
    pagamento: PagamentoInscricao;
    status: InscricaoStatus;
    /** Status para o qual a inscrição vai quando o pagamento é confirmado. */
    statusAposPagamento: InscricaoStatus;
    onSalvar: (dados: { pagamento: PagamentoInscricao; status?: InscricaoStatus }) => Promise<void>;
}

export default function PagamentoBox({ evento, categoria, inscricaoId, inscritoNome, responsavel, pagamento, status, statusAposPagamento, onSalvar }: Props) {
    const { showAlert } = useDialog();
    const [ocupado, setOcupado] = useState<'' | 'gerar' | 'verificar' | 'enviar'>('');

    const confirmado = pagamento.status === 'confirmado' || pagamento.status === 'isento';

    const gerarPix = async () => {
        setOcupado('gerar');
        try {
            const cobranca = await gerarCobrancaPix({
                valor: pagamento.valor,
                nome: responsavel.nome,
                cpf: responsavel.cpf,
                email: responsavel.email,
                telefone: responsavel.telefone,
                descricao: `Inscrição ${evento.nome} - ${categoria?.nome || ''} - ${inscritoNome}`.slice(0, 180),
                referencia: `EVT_${inscricaoId}`,
            });
            await onSalvar({ pagamento: { ...pagamento, metodo: 'pix', ...cobranca } });
        } catch (e) {
            showAlert(`${mensagemErro(e, 'Erro ao gerar o PIX.')} Se preferir, pague diretamente à organização e envie o comprovante abaixo.`, 'error');
        } finally {
            setOcupado('');
        }
    };

    /** Só no modo de teste local: marca a cobrança sandbox como paga no Worker. */
    const simularPagamento = async () => {
        if (!pagamento.transacaoId) return;
        try {
            const res = await fetch(`${workerUrl}/payment-providers/cora/stage-pay`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: pagamento.transacaoId }),
            });
            if (!res.ok) throw new Error('falha');
            showAlert('Pagamento de teste simulado. Agora clique em "Já paguei — confirmar pagamento".', 'info');
        } catch {
            showAlert('Não foi possível simular o pagamento de teste.', 'error');
        }
    };

    const verificar = async () => {
        if (!pagamento.transacaoId) return;
        setOcupado('verificar');
        try {
            const pago = await consultarPagamentoPix(pagamento.transacaoId);
            if (!pago) {
                showAlert('Ainda não identificamos o pagamento. Se você acabou de pagar, aguarde 1 ou 2 minutos e verifique novamente.', 'info');
                return;
            }
            await onSalvar({
                pagamento: { ...pagamento, status: 'confirmado', confirmadoEm: new Date().toISOString(), confirmadoPor: 'automatico' },
                status: statusAposPagamento,
            });
            showAlert('Pagamento confirmado! O comprovante já está disponível.', 'success');
        } catch {
            showAlert('Não foi possível consultar o pagamento agora. Tente novamente.', 'error');
        } finally {
            setOcupado('');
        }
    };

    const enviarComprovante = async (file?: File | null) => {
        if (!file) return;
        setOcupado('enviar');
        try {
            const url = await enviarArquivo(file, 'evento_pagamento');
            await onSalvar({ pagamento: { ...pagamento, status: 'em_analise', comprovanteEnviadoUrl: url }, status: 'pagamento_em_analise' });
            showAlert('Comprovante enviado! A organização vai conferir e liberar sua inscrição.', 'success');
        } catch (e) {
            showAlert(mensagemErro(e, 'Erro ao enviar o comprovante.'), 'error');
        } finally {
            setOcupado('');
        }
    };

    const comprovante = (modo: 'baixar' | 'imprimir') => pdfComprovantePagamento({
        evento, categoria, inscritoNome, responsavelNome: responsavel.nome, responsavelCpf: responsavel.cpf, pagamento, inscricaoId,
    }, modo);

    if (confirmado) {
        return (
            <div className="ev-card">
                <h3><FileCheck2 size={18} /> Pagamento</h3>
                <Alerta tipo="ok">
                    {pagamento.status === 'isento'
                        ? 'Evento gratuito — inscrição isenta de taxa.'
                        : <>Pagamento de <strong>{formatarMoeda(pagamento.valor)}</strong> confirmado em {formatarDataHora(pagamento.confirmadoEm)}{pagamento.transacaoId ? ` · transação ${pagamento.transacaoId}` : ''}.</>}
                </Alerta>
                {pagamento.status === 'confirmado' && (
                    <div className="ev-actions">
                        <button className="ev-btn azul" onClick={() => comprovante('baixar')}><Download size={16} /> Comprovante (PDF)</button>
                        <button className="ev-btn secundario" onClick={() => comprovante('imprimir')}><Printer size={16} /> Imprimir</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="ev-card">
            <h3><CreditCard size={18} /> Pagamento da inscrição · {formatarMoeda(pagamento.valor)}</h3>

            {status === 'pagamento_em_analise' && (
                <Alerta tipo="info">
                    Comprovante recebido. A organização está conferindo o pagamento — você será liberado assim que for aprovado.
                    {pagamento.comprovanteEnviadoUrl && <> <a href={pagamento.comprovanteEnviadoUrl} target="_blank" rel="noreferrer">Ver comprovante enviado</a>.</>}
                </Alerta>
            )}

            {!pagamento.transacaoId ? (
                <>
                    <p className="ev-muted" style={{ marginBottom: 12 }}>Gere o PIX e pague pelo app do seu banco. A confirmação é automática.</p>
                    <button className="ev-btn primario grande" onClick={gerarPix} disabled={!!ocupado}>
                        <QrCode size={18} /> {ocupado === 'gerar' ? 'Gerando PIX...' : 'Gerar PIX para pagamento'}
                    </button>
                </>
            ) : (
                <>
                    <PixPaymentBox paymentId={pagamento.transacaoId} pixQrCode={pagamento.pixCopiaECola} pixQrCodeUrl={pagamento.pixQrCodeUrl} />
                    <button className="ev-btn azul grande bloco" style={{ marginTop: 14 }} onClick={verificar} disabled={!!ocupado}>
                        <RefreshCw size={18} className={ocupado === 'verificar' ? 'spin' : ''} /> {ocupado === 'verificar' ? 'Verificando...' : 'Já paguei — confirmar pagamento'}
                    </button>
                    {MODO_EMULADOR && pagamento.transacaoId.startsWith('test_inv_') && (
                        <button className="ev-btn ouro bloco" style={{ marginTop: 8 }} onClick={simularPagamento}>
                            Simular pagamento (somente modo teste)
                        </button>
                    )}
                </>
            )}

            <hr className="ev-divisor" />
            <p className="ev-muted ev-small" style={{ marginBottom: 8 }}>
                Pagou de outra forma (transferência, dinheiro na secretaria)? Envie o comprovante para aprovação manual da organização.
            </p>
            <label className="ev-btn neutro" style={{ cursor: ocupado ? 'wait' : 'pointer' }}>
                <Upload size={16} /> {ocupado === 'enviar' ? 'Enviando...' : 'Enviar comprovante'}
                <input type="file" accept="image/*,application/pdf" hidden disabled={!!ocupado} onChange={e => enviarComprovante(e.target.files?.[0])} />
            </label>
        </div>
    );
}
