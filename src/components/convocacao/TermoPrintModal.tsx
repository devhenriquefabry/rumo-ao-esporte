import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { CONV_UI, Switch } from './ConvocacaoToggle';
import TermoAutorizacao, { TERMO_PRINT_STYLE } from './TermoAutorizacao';
import type { LinhaTermo } from './TermoAutorizacao';
import type { AutorizacaoConfig, AutorizacaoResposta, ConvocacaoJogador } from '../../types/convocacao';

interface TermoPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    tituloEvento: string;
    config: AutorizacaoConfig;
    jogadores: ConvocacaoJogador[];
    respostas: AutorizacaoResposta[];
}

const LARGURA_A4 = 794; // 210mm a 96dpi

export default function TermoPrintModal({
    isOpen,
    onClose,
    tituloEvento,
    config,
    jogadores,
    respostas
}: TermoPrintModalProps) {
    const [somenteAutorizados, setSomenteAutorizados] = useState(false);
    const [completarAte20, setCompletarAte20] = useState(false);
    const [escala, setEscala] = useState(1);
    const [alturaFolha, setAlturaFolha] = useState(0);
    const areaRef = useRef<HTMLDivElement>(null);
    const folhaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const calcular = () => {
            const disponivel = (areaRef.current?.clientWidth || window.innerWidth) - 40;
            setEscala(Math.min(disponivel / LARGURA_A4, 1));
        };

        const timer = setTimeout(calcular, 60);
        window.addEventListener('resize', calcular);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calcular);
        };
    }, [isOpen]);

    const linhas: LinhaTermo[] = useMemo(() => {
        const porJogador = new Map<string, AutorizacaoResposta>();
        respostas.forEach(r => porJogador.set(r.jogadorId, r));

        return jogadores
            .map(j => {
                const resposta = porJogador.get(j.id);
                return {
                    nome: j.nome,
                    turma: j.turma,
                    formaTransporte: resposta?.formaTransporte,
                    assinaturaData: resposta?.assinaturaData,
                    assinanteNome: resposta?.assinanteNome,
                    status: resposta?.status
                } as LinhaTermo;
            })
            .filter(linha => (somenteAutorizados ? linha.status === 'autorizado' : true));
    }, [jogadores, respostas, somenteAutorizados]);

    // A escala usa `transform`, que não altera o espaço ocupado no layout —
    // medimos a folha real para o contêiner não sobrar altura em branco.
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => setAlturaFolha(folhaRef.current?.offsetHeight || 0), 120);
        return () => clearTimeout(timer);
    }, [isOpen, linhas, completarAte20, escala, config]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(6,26,64,0.55)',
                zIndex: 1200,
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(3px)'
            }}
        >
            <style>{TERMO_PRINT_STYLE}</style>

            <div
                className="termo-nao-imprimir"
                style={{
                    background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)',
                    padding: '14px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                }}
            >
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.05rem', fontWeight: 800 }}>
                    Documento único de autorizações
                </h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dce7f3', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Switch checked={somenteAutorizados} onChange={setSomenteAutorizados} />
                        Somente autorizados
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dce7f3', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Switch checked={completarAte20} onChange={setCompletarAte20} />
                        Completar 20 linhas
                    </label>
                    <button
                        onClick={() => window.print()}
                        style={{
                            background: CONV_UI.green,
                            color: '#fff',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Printer size={18} /> IMPRIMIR
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.14)',
                            border: 'none',
                            color: '#fff',
                            padding: '8px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div ref={areaRef} style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', justifyContent: 'center' }}>
                <div
                    className="termo-caixa-preview"
                    style={{
                        width: `${LARGURA_A4 * escala}px`,
                        height: alturaFolha ? `${alturaFolha * escala}px` : undefined,
                        overflow: 'hidden',
                        boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
                        background: '#fff',
                        alignSelf: 'flex-start'
                    }}
                >
                    <TermoAutorizacao
                        ref={folhaRef}
                        tituloEvento={tituloEvento}
                        config={config}
                        linhas={linhas}
                        minLinhas={completarAte20 ? 20 : 0}
                        escala={escala}
                    />
                </div>
            </div>
        </div>
    );
}
