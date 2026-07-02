import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';

export default function AdminExport() {
    const [loading, setLoading] = useState(false);
    const [loadingFinance, setLoadingFinance] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [modality, setModality] = useState('all');

    const handleExport = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const querySnapshot = await getDocs(collection(db, "arena_simonesia_2026_registrations"));
            let rawData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

            // Apply Modality Filter
            if (modality !== 'all') {
                rawData = rawData.filter(reg => reg.modalidade === modality);
            }

            // Apply Date Filter
            if (startDate) {
                const sDate = new Date(startDate);
                rawData = rawData.filter(reg => {
                    const regDate = reg.createdAt?.seconds ? new Date(reg.createdAt.seconds * 1000) : null;
                    return regDate && regDate >= sDate;
                });
            }
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                rawData = rawData.filter(reg => {
                    const regDate = reg.createdAt?.seconds ? new Date(reg.createdAt.seconds * 1000) : null;
                    return regDate && regDate <= eDate;
                });
            }

            if (rawData.length === 0) {
                setError('Nenhum dado encontrado com os filtros selecionados.');
                setLoading(false);
                return;
            }

            const flatData: any[] = [];

            // Helper to safe get
            const get = (obj: any, path: string) => {
                return path.split('.').reduce((acc, part) => acc && acc[part], obj) || '';
            };

            rawData.forEach((reg: any) => {
                const alunos = reg.alunos || [];

                alunos.forEach((aluno: any, index: number) => {
                    flatData.push({
                        'ID Registro': reg.id,
                        'Data Inscrição': reg.createdAt?.seconds ? new Date(reg.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '',

                        // Responsável
                        'Nome Responsável': get(reg, 'responsavel.nome'),
                        'CPF Responsável': get(reg, 'responsavel.cpf'),
                        'RG Responsável': get(reg, 'responsavel.rg'),
                        'Email Responsável': get(reg, 'responsavel.email'),
                        'Celular Responsável': get(reg, 'responsavel.telefone'),
                        'Endereço': `${get(reg, 'responsavel.endereco.rua')}, ${get(reg, 'responsavel.endereco.numero')}`,
                        'Bairro': get(reg, 'responsavel.endereco.bairro'),
                        'Cidade': get(reg, 'responsavel.endereco.cidade'),

                        // Modalidade
                        'Modalidade': reg.modalidade,
                        'Plano Voleibol': reg.planoVoleibol || '',
                        'Preço Estimado': reg.preco || '',

                        // Aluno
                        'Nome Aluno': aluno.nome,
                        'Data Nasc. Aluno': aluno.dataNascimento,
                        'Sexo Aluno': aluno.sexo,
                        'CPF Aluno': aluno.cpf,

                        // Inscrição / Categoria
                        'Categoria': index === 0 && reg.categoriaFutebol ? reg.categoriaFutebol : (aluno.categoria || 'Verificar Idade'),

                        // Saúde
                        'Restrição Médica': reg.saude?.restricaoMedica ? 'Sim' : 'Não',
                        'Detalhes Restrição': reg.saude?.detalheRestricao || '',
                        'Autorizado Ativ. Física': reg.saude?.autorizadoAtividades ? 'Sim' : 'Não',

                        // Autorizações
                        'Uso Imagem': reg.autorizacoes?.usoImagem ? 'Sim' : 'Não',
                        'Passeios': reg.autorizacoes?.passeios ? 'Sim' : 'Não',
                        'Ausa de Profissionais': reg.autorizacoes?.ausenciaProfissionais ? 'Sim' : 'Não',
                        'Termos Aceitos': reg.termosAceitos ? 'Sim' : 'Não',
                    });
                });
            });

            // Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(flatData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Inscrições Arena Simonésia 2026");

            // File Name with Date
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(workbook, `Inscricoes_Arena_Simonesia_2026_${dateStr}.xlsx`);

            setSuccess(`Arquivo gerado com sucesso! (${flatData.length} registros de alunos)`);

        } catch (err) {
            console.error(err);
            setError('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportFinance = async () => {
        setLoadingFinance(true);
        setError('');
        setSuccess('');

        try {
            const querySnapshot = await getDocs(collection(db, "financial_payments"));
            const rawData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

            if (rawData.length === 0) {
                setError('Nenhum pagamento encontrado para exportar.');
                return;
            }

            const flatData = rawData.map(p => ({
                'ID Pagamento': p.id,
                'ID Aluno/Reg': p.studentId,
                'Data Vencimento': p.dueDate ? new Date(p.dueDate).toLocaleDateString('pt-BR') : '',
                'Data Pagamento': p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('pt-BR') : '',
                'Valor (R$)': p.value || 0,
                'Status': p.status,
                'Tipo Cobrança': p.billingType,
                'Descrição': p.description || '',
                'Link Fatura': p.invoiceUrl || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(flatData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Financeiro Arena Simonésia 2026");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(workbook, `Financeiro_Arena_Simonesia_2026_${dateStr}.xlsx`);

            setSuccess(`Relatório financeiro gerado! (${flatData.length} registros)`);

        } catch (err) {
            console.error(err);
            setError('Erro ao exportar financeiro.');
        } finally {
            setLoadingFinance(false);
        }
    };

    return (
        <PageContainer style={{ maxWidth: '800px' }}>
            <PageTitle
                title="EXPORTAR DADOS"
                subtitle="Gere um arquivo Excel (.xlsx) contendo todos os dados detalhados de todas as inscrições realizadas até o momento."
            />

            <div style={{
                background: '#fff',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                textAlign: 'center'
            }}>
                <div style={{ width: '64px', height: '64px', margin: '0 auto 20px auto', display: 'flex', justifyContent: 'center' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#217346" strokeWidth="1.5">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <path d="M8 13h2"></path>
                        <path d="M8 17h2"></path>
                        <path d="M14 13h2"></path>
                        <path d="M14 17h2"></path>
                    </svg>
                </div>

                <h3 style={{ marginBottom: '20px', color: '#1e293b', fontWeight: '800' }}>Exportar Dados do Sistema</h3>

                {/* Filters UI */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '15px',
                    marginBottom: '30px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '5px' }}>MODALIDADE</label>
                        <select
                            value={modality}
                            onChange={(e) => setModality(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                        >
                            <option value="all">Todas</option>
                            <option value="futebol">Futebol</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '5px' }}>DATA INÍCIO</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '5px' }}>DATA FIM</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                </div>

                {error && <div style={{ color: '#ef4444', marginBottom: '20px', background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: '600', fontSize: '0.9rem' }}>{error}</div>}
                {success && <div style={{ color: '#10b981', marginBottom: '20px', background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0', fontWeight: '600', fontSize: '0.9rem' }}>{success}</div>}

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        style={{
                            background: loading ? '#ccc' : '#217346',
                            color: '#fff',
                            border: 'none',
                            padding: '15px 25px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            borderRadius: '10px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 10px rgba(33, 115, 70, 0.2)'
                        }}
                    >
                        {loading ? 'Processando...' : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Inscritos (XLSX)</>}
                    </button>

                    <button
                        onClick={handleExportFinance}
                        disabled={loadingFinance}
                        style={{
                            background: loadingFinance ? '#ccc' : '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            padding: '15px 25px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            borderRadius: '10px',
                            cursor: loadingFinance ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
                        }}
                    >
                        {loadingFinance ? 'Processando...' : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg> Financeiro (XLSX)</>}
                    </button>
                </div>
            </div>
        </PageContainer>
    );
}
