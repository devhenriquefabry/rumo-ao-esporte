import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { FileText, Download, Printer, Eye, EyeOff, X, AlertTriangle, CheckCircle2, Info, XCircle, History } from 'lucide-react';
import type { InscricaoStatus, RegulamentoVersao, DocumentoStatus } from '../../types/eventos';
import { STATUS_INSCRICAO, formatarDataHora } from '../../utils/eventos/eventosRules';
import '../../styles/eventos.css';

export const TEXTO_ACEITE_REGULAMENTO =
    'Declaro que li e estou ciente do regulamento do campeonato, comprometendo-me a cumprir as regras estabelecidas pela organização.';

export function StatusBadge({ status }: { status: InscricaoStatus }) {
    const s = STATUS_INSCRICAO[status] || STATUS_INSCRICAO.aguardando_pagamento;
    return <span className="ev-badge" style={{ color: s.cor, background: s.fundo }}>{s.label}</span>;
}

export function DocumentoBadge({ status, temArquivo = true }: { status: DocumentoStatus; temArquivo?: boolean }) {
    if (!temArquivo) return <span className="ev-badge" style={{ color: '#7a4d00', background: '#fff6d6' }}>Sem documento</span>;
    if (status === 'aprovado') return <span className="ev-badge" style={{ color: '#047857', background: '#d1fae5' }}>Doc. aprovado</span>;
    if (status === 'rejeitado') return <span className="ev-badge" style={{ color: '#991b1b', background: '#fee2e2' }}>Doc. rejeitado</span>;
    return <span className="ev-badge" style={{ color: '#1d4ed8', background: '#dbeafe' }}>Doc. em análise</span>;
}

export function Alerta({ tipo = 'info', children }: { tipo?: 'info' | 'ok' | 'aviso' | 'erro'; children: ReactNode }) {
    const Icone = tipo === 'ok' ? CheckCircle2 : tipo === 'aviso' ? AlertTriangle : tipo === 'erro' ? XCircle : Info;
    return <div className={`ev-alert ${tipo}`}><Icone size={18} /><div>{children}</div></div>;
}

export function Modal({ titulo, aberto, onFechar, children, rodape, largo }: {
    titulo: ReactNode; aberto: boolean; onFechar: () => void; children: ReactNode; rodape?: ReactNode; largo?: boolean;
}) {
    if (!aberto) return null;
    return (
        <div className="ev-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className={`ev-modal ${largo ? 'largo' : ''}`} role="dialog" aria-modal="true">
                <div className="ev-modal-topo">
                    <h3>{titulo}</h3>
                    <button className="ev-x" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
                </div>
                <div className="ev-modal-corpo">{children}</div>
                {rodape && <div className="ev-modal-rodape">{rodape}</div>}
            </div>
        </div>
    );
}

export function AceiteRegulamento({ marcado, onChange, versao, desabilitado }: {
    marcado: boolean; onChange: (v: boolean) => void; versao?: number; desabilitado?: boolean;
}) {
    return (
        <label className={`ev-check ${marcado ? 'marcado' : ''}`}>
            <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={(e) => onChange(e.target.checked)} />
            <span>
                <strong>{TEXTO_ACEITE_REGULAMENTO}</strong>
                {versao ? <span className="ev-muted ev-small" style={{ display: 'block', marginTop: 4 }}>Regulamento — versão {versao}</span> : null}
            </span>
        </label>
    );
}

async function baixarBlob(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('falha');
    return res.blob();
}

/**
 * Regulamento do evento: visualizar (embutido), baixar e imprimir.
 * Usado na página pública, na inscrição, na área do responsável e na finalização.
 */
export function RegulamentoCard({ regulamento, nomeEvento, historico, aviso, compacto }: {
    regulamento?: RegulamentoVersao | null;
    nomeEvento: string;
    historico?: RegulamentoVersao[];
    aviso?: ReactNode;
    compacto?: boolean;
}) {
    const [mostrar, setMostrar] = useState(false);
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [ocupado, setOcupado] = useState<'' | 'baixar' | 'imprimir'>('');

    if (!regulamento) {
        return (
            <div className="ev-card">
                <h3><FileText size={18} /> Regulamento do evento</h3>
                <p className="ev-muted">O regulamento ainda não foi publicado pela organização.</p>
            </div>
        );
    }

    const nomeArquivo = `Regulamento - ${nomeEvento} - v${regulamento.versao}.pdf`;

    const baixar = async () => {
        setOcupado('baixar');
        try { saveAs(await baixarBlob(regulamento.url), nomeArquivo); }
        catch { window.open(regulamento.url, '_blank'); }
        finally { setOcupado(''); }
    };

    const imprimir = async () => {
        setOcupado('imprimir');
        try {
            const blobUrl = URL.createObjectURL(await baixarBlob(regulamento.url));
            const frame = document.createElement('iframe');
            frame.style.position = 'fixed';
            frame.style.right = '0';
            frame.style.bottom = '0';
            frame.style.width = '0';
            frame.style.height = '0';
            frame.style.border = '0';
            frame.src = blobUrl;
            frame.onload = () => {
                try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
                catch { window.open(blobUrl, '_blank'); }
                setTimeout(() => { frame.remove(); URL.revokeObjectURL(blobUrl); }, 60000);
            };
            document.body.appendChild(frame);
        } catch {
            window.open(regulamento.url, '_blank');
        } finally {
            setOcupado('');
        }
    };

    return (
        <div className="ev-card">
            <h3><FileText size={18} /> Regulamento do evento</h3>
            {aviso}
            <p className="ev-muted" style={{ marginBottom: 12 }}>
                Versão <strong>{regulamento.versao}</strong> · publicada em {formatarDataHora(regulamento.publicadoEm)}
                {regulamento.notas ? <><br />Alterações: {regulamento.notas}</> : null}
            </p>
            <div className="ev-actions">
                <button className="ev-btn azul" onClick={() => setMostrar(!mostrar)}>
                    {mostrar ? <EyeOff size={16} /> : <Eye size={16} />} {mostrar ? 'Ocultar' : 'Visualizar'}
                </button>
                <button className="ev-btn secundario" onClick={baixar} disabled={!!ocupado}><Download size={16} /> {ocupado === 'baixar' ? 'Baixando...' : 'Baixar'}</button>
                <button className="ev-btn secundario" onClick={imprimir} disabled={!!ocupado}><Printer size={16} /> {ocupado === 'imprimir' ? 'Preparando...' : 'Imprimir'}</button>
                {!compacto && historico && historico.length > 1 && (
                    <button className="ev-btn neutro" onClick={() => setMostrarHistorico(!mostrarHistorico)}><History size={16} /> Versões anteriores</button>
                )}
            </div>
            {mostrar && (
                <div style={{ marginTop: 14 }}>
                    <iframe className="ev-pdf-frame" src={regulamento.url} title="Regulamento" />
                    <p className="ev-muted ev-small" style={{ marginTop: 6 }}>
                        Não apareceu? <a href={regulamento.url} target="_blank" rel="noreferrer">Abrir o regulamento em outra aba</a>.
                    </p>
                </div>
            )}
            {mostrarHistorico && historico && (
                <div className="ev-table-wrap" style={{ marginTop: 14 }}>
                    <table className="ev-table">
                        <thead><tr><th>Versão</th><th>Publicada em</th><th>Alterações</th><th></th></tr></thead>
                        <tbody>
                            {[...historico].sort((a, b) => b.versao - a.versao).map(v => (
                                <tr key={v.versao}>
                                    <td>v{v.versao}</td>
                                    <td>{formatarDataHora(v.publicadoEm)}</td>
                                    <td>{v.notas || '-'}</td>
                                    <td><a href={v.url} target="_blank" rel="noreferrer">Abrir</a></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** Moldura das páginas públicas / do responsável. */
export function EventosShell({ children, voltar, direita }: { children: ReactNode; voltar?: { to: string; label: string }; direita?: ReactNode }) {
    return (
        <div className="ev-page">
            <div className="ev-shell">
                <div className="ev-topbar">
                    <Link to="/eventos" className="ev-brand" style={{ background: 'none', border: 'none', padding: 0 }}>
                        <img src="/rumo-ao-esporte-logo.png" alt="REAL" />
                        <span>Eventos REAL</span>
                    </Link>
                    <div className="ev-actions">
                        {voltar && <Link to={voltar.to}>← {voltar.label}</Link>}
                        {direita}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Passos({ passos, atual }: { passos: string[]; atual: number }) {
    return (
        <div className="ev-steps">
            {passos.map((p, i) => (
                <div key={p} className={`ev-step ${i < atual ? 'feito' : i === atual ? 'atual' : ''}`}>
                    <span className="bola">{i < atual ? '✓' : i + 1}</span>{p}
                </div>
            ))}
        </div>
    );
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
    return (
        <div className="ev-vazio" style={{ color: '#fff' }}>
            <div style={{ width: 38, height: 38, border: '4px solid rgba(255,255,255,.3)', borderTop: '4px solid #00a63a', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            {texto}
        </div>
    );
}
