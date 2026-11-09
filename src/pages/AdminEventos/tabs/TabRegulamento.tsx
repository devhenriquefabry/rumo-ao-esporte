import { useMemo, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import { useLoading } from '../../../components/LoadingService';
import type { RegulamentoVersao } from '../../../types/eventos';
import { atualizarEvento, enviarArquivo } from '../../../utils/eventos/eventosService';
import { formatarDataHora, mensagemErro } from '../../../utils/eventos/eventosRules';
import { RegulamentoCard, Alerta } from '../../../components/eventos/EventosUI';
import type { TabProps } from './tipos';

export default function TabRegulamento({ evento, setEvento, equipes, inscricoes, adminNome, canEdit }: TabProps) {
    const { showAlert, showConfirm } = useDialog();
    const { setLoading } = useLoading();
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [notas, setNotas] = useState('');
    const [importante, setImportante] = useState(true);

    const versaoAtual = evento.regulamento?.versao || 0;

    // Quem aceitou qual versão
    const aceites = useMemo(() => {
        const lista = evento.tipo === 'equipes'
            ? equipes.filter(e => e.status !== 'cancelada').map(e => ({ id: e.id!, nome: e.nome, responsavel: e.responsavel.nome, aceites: e.aceites || [] }))
            : inscricoes.filter(i => i.status !== 'cancelada').map(i => ({ id: i.id!, nome: i.participante.nome, responsavel: i.participante.nome, aceites: i.aceites || [] }));
        return lista.map(l => {
            const ultimo = [...l.aceites].sort((a, b) => b.versao - a.versao || b.aceitoEm.localeCompare(a.aceitoEm))[0];
            return { ...l, ultimo };
        });
    }, [evento.tipo, equipes, inscricoes]);

    const pendentes = aceites.filter(a => !a.ultimo || a.ultimo.versao < versaoAtual).length;

    const publicar = () => {
        if (!arquivo) { showAlert('Escolha o arquivo PDF do regulamento.', 'warning'); return; }
        if (arquivo.type && arquivo.type !== 'application/pdf') { showAlert('O regulamento deve ser um arquivo PDF.', 'warning'); return; }
        const nova = versaoAtual + 1;
        const texto = versaoAtual
            ? `Publicar a versão ${nova} do regulamento? A versão ${versaoAtual} continua no histórico.${importante ? ' Os responsáveis serão avisados e precisarão registrar ciência da nova versão.' : ''}`
            : 'Publicar o regulamento do evento? Ele ficará disponível na página pública, na inscrição e na área dos responsáveis.';
        showConfirm(texto, async () => {
            setLoading(true, 'Enviando regulamento...');
            try {
                const url = await enviarArquivo(arquivo, 'regulamento');
                const versao: RegulamentoVersao = {
                    versao: nova, url, nomeArquivo: arquivo.name, publicadoEm: new Date().toISOString(),
                    publicadoPor: adminNome, notas: notas.trim(), alteracaoImportante: versaoAtual > 0 ? importante : false,
                };
                const historico = [...(evento.regulamentoHistorico || []), versao];
                await atualizarEvento(evento.id!, { regulamento: versao, regulamentoHistorico: historico });
                setEvento(prev => prev ? { ...prev, regulamento: versao, regulamentoHistorico: historico } : prev);
                setArquivo(null);
                setNotas('');
                showAlert(`Regulamento versão ${nova} publicado!`, 'success');
            } catch (e) {
                showAlert(mensagemErro(e, 'Erro ao publicar o regulamento.'), 'error');
            } finally {
                setLoading(false);
            }
        }, 'info', 'Publicar regulamento');
    };

    return (
        <>
            {canEdit && (
                <div className="ev-card">
                    <h2><Upload size={18} /> Anexar regulamento do evento</h2>
                    <p className="ev-muted" style={{ marginBottom: 12 }}>
                        Envie o PDF com as regras desta competição (até 5MB). Cada evento tem seu próprio regulamento; publicar uma nova
                        versão não altera edições anteriores e mantém o histórico.
                    </p>
                    <div className="ev-grid c2">
                        <div className="ev-field">
                            <label>Arquivo PDF</label>
                            <label className="ev-btn secundario" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
                                <FileText size={16} /> {arquivo ? arquivo.name : 'Escolher PDF'}
                                <input type="file" accept="application/pdf" hidden onChange={e => setArquivo(e.target.files?.[0] || null)} />
                            </label>
                        </div>
                        <div className="ev-field">
                            <label>{versaoAtual ? 'O que mudou nesta versão' : 'Observação (opcional)'}</label>
                            <input className="ev-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder={versaoAtual ? 'Ex.: alteração no critério de desempate' : ''} />
                        </div>
                    </div>
                    {versaoAtual > 0 && (
                        <label className={`ev-check ${importante ? 'marcado' : ''}`} style={{ marginTop: 12 }}>
                            <input type="checkbox" checked={importante} onChange={e => setImportante(e.target.checked)} />
                            <span><strong>Alteração importante</strong> — avisar os responsáveis na área deles e pedir nova ciência do regulamento.</span>
                        </label>
                    )}
                    <button className="ev-btn primario" style={{ marginTop: 14 }} onClick={publicar} disabled={!arquivo}>
                        <Upload size={16} /> {versaoAtual ? `Publicar versão ${versaoAtual + 1}` : 'Publicar regulamento'}
                    </button>
                </div>
            )}

            <RegulamentoCard regulamento={evento.regulamento} nomeEvento={evento.nome} historico={evento.regulamentoHistorico} />

            <div className="ev-card">
                <h3>Aceites do regulamento</h3>
                {versaoAtual > 0 && pendentes > 0 && (
                    <Alerta tipo="aviso">{pendentes} inscrição(ões) ainda não registraram ciência da versão {versaoAtual}.</Alerta>
                )}
                {aceites.length === 0 ? <p className="ev-muted">Nenhuma inscrição ainda.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>{evento.tipo === 'equipes' ? 'Equipe' : 'Participante'}</th><th>Responsável</th><th>Última versão aceita</th><th>Data</th><th>Etapa</th></tr></thead>
                            <tbody>
                                {aceites.map(a => (
                                    <tr key={a.id}>
                                        <td style={{ fontWeight: 700 }}>{a.nome}</td>
                                        <td>{a.ultimo?.nome || a.responsavel}</td>
                                        <td>{a.ultimo ? <span style={{ color: a.ultimo.versao < versaoAtual ? '#b45309' : '#047857', fontWeight: 800 }}>v{a.ultimo.versao}</span> : <span style={{ color: '#c62828' }}>—</span>}</td>
                                        <td>{formatarDataHora(a.ultimo?.aceitoEm)}</td>
                                        <td>{a.ultimo?.etapa === 'finalizacao' ? 'Finalização da relação' : a.ultimo?.etapa === 'nova_versao' ? 'Nova versão' : a.ultimo ? 'Cadastro' : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
