import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import type { AtletaEvento, EventoCategoria } from '../../types/eventos';
import { enviarArquivo } from '../../utils/eventos/eventosService';
import { novoId, validarIdade, faixaEtariaTexto, mensagemErro } from '../../utils/eventos/eventosRules';
import { useDialog } from '../../context/CustomDialogContext';
import { Modal, Alerta } from './EventosUI';

interface Props {
    aberto: boolean;
    onFechar: () => void;
    atleta?: AtletaEvento | null;
    categoria?: EventoCategoria;
    exigirDocumento: boolean;
    outrosAtletas: AtletaEvento[];
    onSalvar: (atleta: AtletaEvento) => Promise<void>;
    /** Admin pode salvar fora da faixa etária (com registro). */
    permitirForaDaIdade?: boolean;
}

export default function AtletaFormModal({ aberto, onFechar, atleta, categoria, exigirDocumento, outrosAtletas, onSalvar, permitirForaDaIdade }: Props) {
    const { showAlert } = useDialog();
    const [nome, setNome] = useState('');
    const [nascimento, setNascimento] = useState('');
    const [camisa, setCamisa] = useState('');
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!aberto) return;
        setNome(atleta?.nome || '');
        setNascimento(atleta?.dataNascimento || '');
        setCamisa(atleta?.camisa || '');
        setArquivo(null);
    }, [aberto, atleta]);

    const salvar = async () => {
        const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
        if (nomeLimpo.split(' ').length < 2) { showAlert('Informe o nome completo do atleta.', 'warning'); return; }
        if (!nascimento) { showAlert('Informe a data de nascimento.', 'warning'); return; }
        if (categoria && !permitirForaDaIdade) {
            const erro = validarIdade(categoria, nascimento);
            if (erro) { showAlert(erro, 'warning'); return; }
        }
        const camisaLimpa = camisa.trim();
        if (camisaLimpa && outrosAtletas.some(a => a.id !== atleta?.id && (a.camisa || '').trim() === camisaLimpa)) {
            showAlert(`A camisa ${camisaLimpa} já está sendo usada por outro atleta.`, 'warning'); return;
        }
        if (outrosAtletas.some(a => a.id !== atleta?.id && a.nome.trim().toLowerCase() === nomeLimpo.toLowerCase())) {
            showAlert('Este atleta já está na relação.', 'warning'); return;
        }
        if (exigirDocumento && !arquivo && !atleta?.documentoUrl) { showAlert('Anexe o documento do atleta (foto ou PDF).', 'warning'); return; }

        setSalvando(true);
        try {
            let documentoUrl = atleta?.documentoUrl || '';
            let documentoNome = atleta?.documentoNome || '';
            let documentoStatus = atleta?.documentoStatus || 'pendente';
            let motivoRejeicao = atleta?.motivoRejeicao || '';
            if (arquivo) {
                documentoUrl = await enviarArquivo(arquivo, 'evento_doc');
                documentoNome = arquivo.name;
                documentoStatus = 'pendente'; // documento novo volta para análise
                motivoRejeicao = '';
            }
            await onSalvar({
                id: atleta?.id || novoId(),
                nome: nomeLimpo, dataNascimento: nascimento, camisa: camisaLimpa,
                documentoUrl, documentoNome, documentoStatus, motivoRejeicao,
            });
            onFechar();
        } catch (e) {
            showAlert(mensagemErro(e, 'Erro ao salvar o atleta.'), 'error');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Modal aberto={aberto} onFechar={onFechar} titulo={atleta ? 'Editar atleta' : 'Adicionar atleta'}
            rodape={<>
                <button className="ev-btn neutro" onClick={onFechar}>Cancelar</button>
                <button className="ev-btn primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar atleta'}</button>
            </>}>
            {categoria && <Alerta tipo="info">Categoria <strong>{categoria.nome}</strong>: {faixaEtariaTexto(categoria)}.</Alerta>}
            {atleta?.documentoStatus === 'rejeitado' && <Alerta tipo="erro">Documento rejeitado{atleta.motivoRejeicao ? `: ${atleta.motivoRejeicao}` : ''}. Envie um novo arquivo.</Alerta>}
            <div className="ev-grid">
                <div className="ev-field">
                    <label>Nome completo</label>
                    <input className="ev-input" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
                </div>
                <div className="ev-grid c2">
                    <div className="ev-field">
                        <label>Data de nascimento</label>
                        <input className="ev-input" type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
                    </div>
                    <div className="ev-field">
                        <label>Nº da camisa</label>
                        <input className="ev-input" inputMode="numeric" value={camisa} onChange={e => setCamisa(e.target.value.slice(0, 3))} placeholder="Opcional" />
                    </div>
                </div>
                <div className="ev-field">
                    <label>Documento {exigirDocumento ? '(obrigatório)' : '(opcional)'}</label>
                    <label className="ev-btn secundario" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
                        <Upload size={16} /> {arquivo ? arquivo.name : atleta?.documentoUrl ? 'Trocar documento' : 'Anexar RG / certidão (foto ou PDF)'}
                        <input type="file" accept="image/*,application/pdf" hidden onChange={e => setArquivo(e.target.files?.[0] || null)} />
                    </label>
                    {atleta?.documentoUrl && !arquivo && <a className="ev-small" href={atleta.documentoUrl} target="_blank" rel="noreferrer">Ver documento atual</a>}
                </div>
            </div>
        </Modal>
    );
}
