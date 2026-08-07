import { useState, useEffect, useRef } from 'react';
import { Printer, Lock, Unlock, Save, ArrowLeft, ChevronDown } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { planService } from '../../utils/planService';
import type { Plan } from '../../utils/planService';


export interface ContractData {
    responsavel: {
        nome: string;
        cpf: string;
        email: string;
        telefonePrincipal: string;
        endereco: {
            rua: string;
            numero: string;
            bairro: string;
            cidade: string;
            uf: string;
            cep: string;
        };
    };
    alunos: Array<{
        nome: string;
        dataNascimento: string;
        sexo: string;
        cpf?: string;
        rg?: string;

        customContract?: string;
        planoId?: string; // ID do plano vinculado
        signatureData?: string; // Base64 signature
    }>;
}

interface ContractEditorProps {
    mode: 'student' | 'template';
    registrationId?: string;
    studentIndex?: number;
    data?: ContractData;
    student?: ContractData['alunos'][0];
    onBack?: () => void;
    title?: string;
    hideToolbar?: boolean;
}

export default function ContractEditor({
    mode,
    registrationId,
    studentIndex = 0,
    data: initialData,
    student: initialStudent,
    onBack,
    title,
    hideToolbar = false
}: ContractEditorProps) {
    const [data, setData] = useState<ContractData | null>(initialData || null);
    const [student, setStudent] = useState<ContractData['alunos'][0] | null>(initialStudent || null);
    const [loading, setLoading] = useState(!initialData);
    const [isEditable, setIsEditable] = useState(false);
    const [saving, setSaving] = useState(false);
    const [templateHtml, setTemplateHtml] = useState<string | null>(null);
    const contractRef = useRef<any>(null);
    const [contractScale, setContractScale] = useState(1);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    // Plan integration
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [showPlanDropdown, setShowPlanDropdown] = useState(false);

    // Responsive scaling - calculate scale based on container width
    const containerRef = useRef<any>(null);

    useEffect(() => {
        const calculateScale = () => {
            const A4_WIDTH = 794; // 210mm in pixels at 96dpi
            // Use container width if available, otherwise viewport
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
            const availableWidth = containerWidth - 40; // padding

            if (availableWidth < A4_WIDTH) {
                const scale = availableWidth / A4_WIDTH;
                setContractScale(Math.min(scale, 1));
            } else {
                setContractScale(1);
            }
        };

        // Initial calculation with delay for DOM to settle
        setTimeout(calculateScale, 100);
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [loading]);

    // Fetch data for student mode
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load plans first
                const allPlans = await planService.getPlans();
                setPlans(allPlans);

                if (mode === 'student' && registrationId && !initialData) {
                    const docRef = doc(db, 'rumo_ao_esporte_2026_registrations', registrationId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const regData = snap.data() as ContractData;
                        setData(regData);
                        const currentStudent = regData.alunos?.[studentIndex] || regData.alunos?.[0];
                        if (currentStudent) {
                            setStudent(currentStudent);
                            // Set the selected plan
                            // Set the selected plan -> Logic: Student > Registration Root > Default
                            let planToSet = null;

                            if (currentStudent.planoId) {
                                planToSet = allPlans.find(p => p.id === currentStudent.planoId) || null;
                            }

                            // Fallback to Root Plan ID if no student plan found
                            if (!planToSet && (regData as any).planId) {
                                planToSet = allPlans.find(p => p.id === (regData as any).planId) || null;
                            }

                            // Final Fallback to Default
                            if (!planToSet) {
                                planToSet = allPlans.find(p => p.isDefault) || allPlans[0];
                            }

                            setSelectedPlan(planToSet);
                            // Set signature
                            setSignatureData(currentStudent.signatureData || null);
                        }
                    }
                } else if (mode === 'template') {
                    const docRef = doc(db, 'rae_settings', 'contract_template');
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setTemplateHtml(snap.data().html);
                    }
                    // Load default plan for template display
                    const defaultPlan = allPlans.find(p => p.isDefault) || allPlans[0];
                    setSelectedPlan(defaultPlan || null);
                }
            } catch (error) {
                console.error("Error fetching contract data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [mode, registrationId, studentIndex, initialData]);

    const handleSave = async () => {
        if (!contractRef.current) return;
        setSaving(true);

        try {
            const contractHTML = contractRef.current.innerHTML;

            if (mode === 'template') {
                // Save as global template
                const docRef = doc(db, 'rae_settings', 'contract_template');
                await setDoc(docRef, {
                    html: contractHTML,
                    updatedAt: new Date()
                }, { merge: true });
                alert('Modelo de contrato salvo com sucesso! As alterações serão aplicadas a todos os novos contratos.');
            } else if (mode === 'student' && registrationId && data) {
                // Save for specific student including plan
                const updatedAlunos = [...data.alunos];
                updatedAlunos[studentIndex] = {
                    ...updatedAlunos[studentIndex],
                    customContract: contractHTML,
                    planoId: selectedPlan?.id, // Save selected plan
                    signatureData: signatureData || undefined
                };

                const docRef = doc(db, 'rumo_ao_esporte_2026_registrations', registrationId);
                await updateDoc(docRef, { alunos: updatedAlunos });

                setData(prev => prev ? { ...prev, alunos: updatedAlunos } : null);
                setStudent(updatedAlunos[studentIndex]);
                alert('Contrato salvo com sucesso! As alterações são exclusivas para este aluno.');
            }
        } catch (error) {
            console.error("Erro ao salvar contrato:", error);
            alert('Erro ao salvar contrato. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const handlePlanChange = (plan: Plan) => {
        setSelectedPlan(plan);
        setShowPlanDropdown(false);
    };

    // Format currency
    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handlePrint = () => {
        window.print();
    };

    const toggleEditMode = () => {
        const newState = !isEditable;
        setIsEditable(newState);

        if (contractRef.current) {
            const elements = contractRef.current.querySelectorAll('[data-editable]');
            elements.forEach((el: any) => {
                el.contentEditable = newState ? "true" : "false";
                if (newState) {
                    el.style.cursor = 'text';
                    el.style.outline = '1px dashed #ccc';
                } else {
                    el.style.cursor = 'default';
                    el.style.outline = 'none';
                }
            });
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Carregando contrato...</div>;

    // For template mode without student data, use placeholder
    const displayData = data || {
        responsavel: {
            nome: '[NOME DO RESPONSÁVEL]',
            cpf: '[CPF]',
            email: '[EMAIL]',
            telefonePrincipal: '[TELEFONE]',
            endereco: {
                rua: '[RUA]',
                numero: '[NÚMERO]',
                bairro: '[BAIRRO]',
                cidade: '[CIDADE]',
                uf: '[UF]',
                cep: '[CEP]'
            }
        },
        alunos: []
    };

    const displayStudent = student || {
        nome: '[NOME DO ALUNO]',
        dataNascimento: '[DATA NASCIMENTO]',
        sexo: 'M',
        cpf: '[CPF]',
        rg: '[RG]'
    };

    const currentDate = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    const editableProps = {
        'data-editable': true,
        suppressContentEditableWarning: true,
        contentEditable: false
    };

    const displayTitle = title || (mode === 'template' ? 'Modelo de Contrato' : `Contrato - ${displayStudent.nome}`);

    return (
        <div ref={containerRef} style={{ background: '#525659', minHeight: '100vh', padding: '40px 0', fontFamily: 'Times New Roman, serif' }}>

            {/* Toolbar - Only when not hidden */}
            {!hideToolbar && (
                <div className="no-print" style={{
                    maxWidth: '210mm', margin: '0 auto 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    flexWrap: 'wrap', gap: '15px'
                }}>
                    {onBack ? (
                        <button
                            onClick={onBack}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none',
                                color: '#666', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold'
                            }}
                        >
                            <ArrowLeft size={20} /> Voltar
                        </button>
                    ) : <div />}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 'bold', color: '#333' }}>{displayTitle}</div>

                        {/* Plan Selector - Only for student mode */}
                        {mode === 'student' && plans.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowPlanDropdown(!showPlanDropdown)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: '#e3f2fd',
                                        color: '#1565c0',
                                        border: '1px solid #90caf9',
                                        padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem' }}>Plano:</span>
                                    {selectedPlan?.nome || 'Selecionar'}
                                    <ChevronDown size={16} />
                                </button>
                                {showPlanDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, marginTop: '5px',
                                        background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '200px', overflow: 'hidden'
                                    }}>
                                        {plans.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={() => handlePlanChange(plan)}
                                                style={{
                                                    padding: '10px 15px', cursor: 'pointer',
                                                    background: selectedPlan?.id === plan.id ? '#e3f2fd' : '#fff',
                                                    borderBottom: '1px solid #eee'
                                                }}
                                            >
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>{plan.nome}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                    {formatCurrency(plan.valores?.mensalidade?.ateVencimento || plan.valor || 0)}/mês
                                                    {plan.isDefault && <span style={{ marginLeft: '8px', color: '#ff8f00' }}>★ Padrão</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={toggleEditMode}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: isEditable ? '#fff3e0' : '#f5f5f5',
                                color: isEditable ? '#e65100' : '#555',
                                border: '1px solid #ddd',
                                padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isEditable ? <Unlock size={18} /> : <Lock size={18} />}
                            {isEditable ? 'Edição Habilitada' : 'Habilitar Edição'}
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', background: '#00a63a', color: '#fff', border: 'none',
                            padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        <Printer size={20} /> Imprimir
                    </button>
                </div>
            )}

            {/* Floating Save Button */}
            {isEditable && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="no-print"
                    style={{
                        position: 'fixed',
                        bottom: '30px',
                        right: '30px',
                        background: mode === 'template' ? '#1565c0' : '#2e7d32',
                        color: '#fff',
                        border: 'none',
                        padding: '15px 30px',
                        borderRadius: '50px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        zIndex: 1000,
                        transition: 'transform 0.2s, background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Save size={24} />
                    {saving ? 'Salvando...' : (mode === 'template' ? 'SALVAR MODELO' : 'SALVAR EDIÇÃO')}
                </button>
            )}

            {/* A4 Paper */}
            <div ref={contractRef} className="contract-page" style={{
                background: '#fff',
                width: '210mm',
                minHeight: '297mm',
                margin: contractScale < 1 ? '0 0 0 20px' : '0 auto',
                padding: '20mm',
                boxShadow: '0 0 20px rgba(0,0,0,0.3)',
                boxSizing: 'border-box',
                color: '#000',
                lineHeight: '1.5',
                fontSize: '12pt',
                textAlign: 'justify',
                transform: contractScale < 1 ? `scale(${contractScale})` : 'none',
                transformOrigin: 'top left',
                marginBottom: contractScale < 1 ? `calc(-297mm * (1 - ${contractScale}))` : '0'
            }}>
                {/* Use saved template or custom contract or default */}
                {(mode === 'student' && displayStudent.customContract) ? (
                    <div dangerouslySetInnerHTML={{ __html: displayStudent.customContract }} />
                ) : (mode === 'template' && templateHtml) ? (
                    <div dangerouslySetInnerHTML={{ __html: templateHtml }} />
                ) : (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }} {...editableProps}>
                            <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte e ao Lazer - REAL" style={{ height: '80px', marginBottom: '10px' }} contentEditable={false} />
                            <h2 style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '10px 0', lineHeight: '1.4' }}>
                                Termo de Adesão e Participação nas Atividades Esportivas<br />
                                da Associação Rumo ao Esporte e ao Lazer - REAL
                            </h2>
                        </div>

                        <p style={{ textIndent: '30px', marginBottom: '15px' }} {...editableProps}>
                            Pelo presente instrumento, de um lado, <strong>RUMO AO ESPORTE E AO LAZER - REAL</strong>, associação privada sem fins lucrativos, inscrita no CNPJ sob o nº 60.642.277/0001-40, com sede na Avenida Cota Emerick, nº 87, Fundos - Loja Doce Luiza, Centro, Martins Soares/MG, CEP 36.972-000, e-mail rumoaoesporte@gmail.com e telefone (33) 9978-6088, doravante denominada <strong>ASSOCIAÇÃO</strong>, e, de outro lado, <strong>{displayData.responsavel.nome.toUpperCase()}</strong>, brasileiro(a), portador(a) do CPF nº <strong>{displayData.responsavel.cpf}</strong>, residente e domiciliado(a) à {displayData.responsavel.endereco.rua}, nº {displayData.responsavel.endereco.numero}, Bairro {displayData.responsavel.endereco.bairro}, {displayData.responsavel.endereco.cidade}/{displayData.responsavel.endereco.uf}, doravante denominado(a) <strong>ASSOCIADO(A)/RESPONSÁVEL</strong>, na qualidade de representante legal do(a) atleta <strong>{displayStudent.nome.toUpperCase()}</strong>, resolvem firmar o presente Termo de Adesão e Participação nas Atividades Esportivas, conforme o Estatuto Social e as cláusulas seguintes.
                        </p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 1 - DO OBJETO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>1.1 O presente termo tem por objeto a adesão e participação do atleta nas atividades esportivas e socioeducativas promovidas pela ASSOCIAÇÃO, especialmente na prática do futebol, visando ao desenvolvimento esportivo, social, disciplinar e cidadão de crianças e adolescentes.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 2 - DAS ATIVIDADES</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>2.1 As atividades consistirão em treinamentos, atividades práticas e teóricas, avaliações, amistosos, competições, eventos internos e externos e demais ações promovidas pela ASSOCIAÇÃO.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>2.2 Parágrafo único: A frequência seguirá cronograma divulgado pela ASSOCIAÇÃO, podendo ser ajustado conforme necessidade, disponibilidade e organização do projeto.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 3 - DAS NORMAS DE CONDUTA E DISCIPLINA</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>3.1 Os atletas deverão manter comportamento respeitoso, assiduidade e disciplina durante as atividades, sendo vedado:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Uso de palavrões, agressões físicas ou verbais;</li>
                            <li>b) Desrespeito a atletas, profissionais, voluntários ou responsáveis;</li>
                            <li>c) Danos ao patrimônio da ASSOCIAÇÃO ou de terceiros.</li>
                        </ul>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>3.2 Parágrafo único: O descumprimento das normas sujeitará o associado às penalidades de advertência verbal ou escrita, suspensão por até 90 (noventa) dias ou desligamento, conforme a gravidade da falta, reincidência e demais critérios previstos no Estatuto Social, assegurado o direito de defesa.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 4 - DAS RESPONSABILIDADES DO ASSOCIADO/RESPONSÁVEL</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>4.1 Compete ao ASSOCIADO/RESPONSÁVEL:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Garantir, sempre que possível, a presença e pontualidade do atleta;</li>
                            <li>b) Comunicar faltas ou impedimentos relevantes;</li>
                            <li>c) Zelar pela boa convivência e incentivar valores éticos e cooperativos;</li>
                            <li>d) Informar à ASSOCIAÇÃO qualquer condição de saúde ou limitação física relevante do atleta.</li>
                        </ul>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 5 - DA CONTRIBUIÇÃO ASSOCIATIVA</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>
                            5.1 O ASSOCIADO/RESPONSÁVEL contribuirá mensalmente para a manutenção das atividades da ASSOCIAÇÃO, conforme previsto em seu Estatuto Social:
                        </p>
                        {selectedPlan ? (
                            <div style={{ marginLeft: '20px', marginBottom: '10px', background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                                <p style={{ margin: '5px 0' }}><strong>Plano:</strong> {selectedPlan.nome}</p>

                                <p style={{ margin: '10px 0 5px 0', fontWeight: 'bold', color: '#1565c0' }}>Valores Mensais:</p>
                                <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '5px 0' }}>
                                    <li>• Até o vencimento: {formatCurrency(selectedPlan.valores?.mensalidade?.ateVencimento || 0)}</li>
                                    <li>• Após o vencimento: {formatCurrency(selectedPlan.valores?.mensalidade?.aposVencimento || selectedPlan.valores?.mensalidade?.ateVencimento || 0)}</li>
                                </ul>
                            </div>
                        ) : null}
                        <p style={{ marginBottom: '10px' }} {...editableProps}>
                            5.2 A mensalidade possui natureza de contribuição associativa destinada à manutenção e desenvolvimento das atividades institucionais da ASSOCIAÇÃO.
                        </p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 6 - DO UNIFORME E MATERIAIS</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.1 O uso do uniforme completo e padronizado da ASSOCIAÇÃO será obrigatório nos treinos, amistosos, competições e demais atividades em que assim for determinado.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.2 O uniforme será de propriedade do atleta e deverá ser adquirido pelo ASSOCIADO/RESPONSÁVEL conforme padrão e orientações estabelecidos pela ASSOCIAÇÃO.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.3 O ASSOCIADO/RESPONSÁVEL deverá zelar pela conservação das peças, sendo de sua responsabilidade eventual reposição por perda, extravio ou dano.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 7 - DA SEGURANÇA E RESPONSABILIDADE</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>7.1 A ASSOCIAÇÃO adotará medidas de segurança e prevenção compatíveis com as atividades desenvolvidas.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>7.2 O ASSOCIADO/RESPONSÁVEL declara estar ciente dos riscos naturais inerentes à prática esportiva, permanecendo a responsabilidade da ASSOCIAÇÃO limitada aos casos previstos na legislação aplicável.</p>

                        <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 8 - DO USO DE IMAGEM</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>8.1 O ASSOCIADO/RESPONSÁVEL autoriza gratuitamente o uso da imagem e voz do atleta em fotos, vídeos e materiais institucionais relacionados às atividades da ASSOCIAÇÃO, inclusive em redes sociais e canais oficiais.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>8.2 A utilização terá finalidade exclusivamente institucional, esportiva e de divulgação das atividades da ASSOCIAÇÃO, sem gerar direito a remuneração.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 9 - DO PRAZO E DO DESLIGAMENTO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.1 O presente termo vigorará a partir de sua assinatura enquanto permanecer a participação do atleta e a condição associativa do responsável perante a ASSOCIAÇÃO.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.2 O ASSOCIADO/RESPONSÁVEL poderá solicitar seu desligamento e o do atleta a qualquer momento, mediante comunicação à administração.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.3 Não haverá cobrança de multa pelo pedido de desligamento, permanecendo devidos somente os valores vencidos até a data do efetivo desligamento.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.4 O desligamento por motivo disciplinar observará as penalidades e procedimentos previstos no Estatuto Social da ASSOCIAÇÃO.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.5 O desligamento por inadimplência observará exclusivamente o prazo e as condições estabelecidas no Estatuto Social.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 10 - DA INADIMPLÊNCIA</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>10.1 Em caso de inadimplência, será observado o período de 03 (três) meses para regularização, podendo o associado quitar os valores em aberto até o último dia desse período para evitar seu desligamento.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>10.2 Após o período de 03 (três) meses, não havendo regularização, ocorrerá o desligamento, observadas as situações excepcionais previstas no Estatuto Social.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>10.3 Para eventual retorno, os valores anteriormente devidos deverão ser quitados, sem juros ou multas, podendo haver correção monetária pelo IPCA, a critério da Diretoria.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 11 - DA INSCRIÇÃO E ADESÃO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>11.1 A inscrição e adesão serão formalizadas mediante aprovação pela ASSOCIAÇÃO e:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Preenchimento e assinatura da Ficha de Inscrição e Adesão;</li>
                            <li>b) Apresentação dos documentos de identificação do atleta e de seu responsável legal;</li>
                            <li>c) Apresentação das demais informações ou autorizações necessárias à participação nas atividades.</li>
                        </ul>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>11.2 A participação em deslocamentos, competições ou eventos externos dependerá das autorizações exigidas pela ASSOCIAÇÃO.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 12 - DO FORO</h3>
                        <p style={{ marginBottom: '20px' }} {...editableProps}>Para dirimir eventuais controvérsias decorrentes deste termo, fica eleito o foro da Comarca de Manhumirim/MG, observadas as disposições legais aplicáveis.</p>
                        <p style={{ marginBottom: '40px' }} {...editableProps}>Parágrafo único: Para fins de comunicação formal, poderão ser utilizados e-mail e WhatsApp para envio de notificações, avisos e comunicações administrativas.</p>

                        <div style={{ textAlign: 'center', marginTop: '60px', marginBottom: '60px' }} {...editableProps}>
                            <p>Martins Soares/MG, {currentDate}.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '40px' }} {...editableProps}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ height: '62px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                                    <img src="/assinatura-associacao.png" alt="Assinatura da associação" style={{ height: '58px', maxWidth: '95%', objectFit: 'contain' }} />
                                </div>
                                <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                                    <strong>ASSOCIAÇÃO</strong><br />
                                    ASSOCIAÇÃO RUMO AO ESPORTE E AO LAZER - REAL
                                </div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ height: '62px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                                    {signatureData && (
                                        <img src={signatureData} alt="Assinatura do associado/responsável" style={{ height: '58px', maxWidth: '95%', objectFit: 'contain' }} />
                                    )}
                                </div>
                                <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                                    <strong>ASSOCIADO(A)/RESPONSÁVEL</strong><br />
                                    {displayData.responsavel.nome.toUpperCase()}<br />
                                    CPF: {displayData.responsavel.cpf}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '80px' }} {...editableProps}>
                            <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>TESTEMUNHAS:</p>
                            <p style={{ marginBottom: '20px' }}>1. __________________________________________________________________ | CPF: __________________________</p>
                            <p>2. __________________________________________________________________ | CPF: __________________________</p>
                        </div>

                        <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>

                        {/* ANEXO I */}
                        <div style={{ border: '1px solid #000', padding: '20px' }} {...editableProps}>
                            <h3 style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                                ANEXO I – FICHA DE INSCRIÇÃO E ADESÃO DO ATLETA<br />
                                ASSOCIAÇÃO RUMO AO ESPORTE E AO LAZER - REAL
                            </h3>

                            <div style={{ marginBottom: '20px' }}>
                                <strong>DADOS DO ATLETA:</strong><br />
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginBottom: '5px' }}>Nome completo: {displayStudent.nome.toUpperCase()}</div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>Data de Nascimento: {displayStudent.dataNascimento}</div>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>Sexo: {displayStudent.sexo === 'M' ? 'Masculino' : 'Feminino'}</div>
                                </div>
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginTop: '5px' }}>Documento de identidade (RG ou CPF): {displayStudent.cpf || displayStudent.rg || '-'}</div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <strong>DADOS DO RESPONSÁVEL LEGAL:</strong><br />
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginBottom: '5px' }}>Nome completo: {displayData.responsavel.nome.toUpperCase()}</div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>CPF: {displayData.responsavel.cpf}</div>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>RG: -</div>
                                </div>
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginTop: '5px' }}>
                                    Endereço: {displayData.responsavel.endereco.rua}, {displayData.responsavel.endereco.numero}, {displayData.responsavel.endereco.bairro}
                                </div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>Cidade/UF: {displayData.responsavel.endereco.cidade}/{displayData.responsavel.endereco.uf}</div>
                                    <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', flex: 1 }}>CEP: {displayData.responsavel.endereco.cep}</div>
                                </div>
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginTop: '5px' }}>Telefone/WhatsApp: {displayData.responsavel.telefonePrincipal}</div>
                                <div style={{ borderBottom: '1px solid #ccc', padding: '5px 0', marginTop: '5px' }}>E-mail: {displayData.responsavel.email}</div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <strong>TERMO DE COMPROMISSO:</strong><br />
                                <p style={{ fontSize: '10pt', marginTop: '5px' }}>
                                    Declaro que as informações acima são verdadeiras e que li e estou de acordo com o Estatuto Social, regulamentos e condições constantes do Termo de Adesão e Participação nas Atividades Esportivas da Associação Rumo ao Esporte e ao Lazer - REAL, do qual esta ficha é parte integrante.
                                </p>
                                <p style={{ fontSize: '10pt', marginTop: '5px' }}>
                                    Autorizo a participação do atleta nas atividades da ASSOCIAÇÃO e o uso de sua imagem nos termos da autorização constante do referido instrumento.
                                </p>
                            </div>

                            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                                Martins Soares/MG, {currentDate}.
                            </div>

                            <div style={{ marginTop: '50px', width: '80%', margin: '40px auto 0', textAlign: 'center' }}>
                                <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                                    {signatureData && (
                                        <img src={signatureData} alt="Assinatura do responsável legal" style={{ height: '46px', maxWidth: '95%', objectFit: 'contain' }} />
                                    )}
                                </div>
                                <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
                                    <center>Assinatura do Responsável Legal</center>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                /* Container wrapper for proper scaling */
                .contract-wrapper {
                    width: 100%;
                    overflow-x: auto;
                }

                /* Mobile & Tablet Scaling - Scale A4 (210mm ≈ 794px) to fit viewport */
                @media screen and (max-width: 850px) {
                    .contract-page {
                        transform-origin: top left !important;
                        transform: scale(calc((100vw - 40px) / 794)) !important;
                        margin-left: 20px !important;
                    }
                    .no-print {
                        flex-direction: column !important;
                        gap: 10px !important;
                        padding: 10px !important;
                        max-width: calc(100vw - 20px) !important;
                    }
                }

                @media print {
                    @page { margin: 0; size: auto; }
                    body * { visibility: hidden; }
                    .contract-page, .contract-page * { visibility: visible; }
                    .contract-page {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 20mm !important;
                        box-shadow: none !important;
                        background: white !important;
                        transform: none !important;
                    }
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .page-break { page-break-after: always; }
                    [contenteditable] { outline: none !important; cursor: default !important; }
                }
            `}</style>
        </div>
    );
}
