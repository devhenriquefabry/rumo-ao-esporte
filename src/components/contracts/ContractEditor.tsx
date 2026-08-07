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
                            <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte" style={{ height: '80px', marginBottom: '10px' }} contentEditable={false} />
                            <h2 style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '10px 0' }}>Itens de Contrato de Prestação de Serviços Educacionais e Esportivos – Escolinha de Futebol</h2>
                        </div>

                        <p style={{ textIndent: '30px', marginBottom: '15px' }} {...editableProps}>
                            Pelo presente instrumento particular, de um lado, <strong>RUMO AO ESPORTE</strong>, escola de esportes situada em Minas Gerais, doravante denominada <strong>CONTRATADA</strong>, e, de outro lado, <strong>{displayData.responsavel.nome.toUpperCase()}</strong>, brasileiro(a), portador(a) do CPF nº <strong>{displayData.responsavel.cpf}</strong>, residente e domiciliado(a) à {displayData.responsavel.endereco.rua}, nº {displayData.responsavel.endereco.numero}, Bairro {displayData.responsavel.endereco.bairro}, {displayData.responsavel.endereco.cidade}/{displayData.responsavel.endereco.uf}, doravante denominado(a) <strong>CONTRATANTE</strong>, na qualidade de representante legal do(a) aluno(a) <strong>{displayStudent.nome.toUpperCase()}</strong>, doravante denominado(a) <strong>ALUNO(A)</strong>, resolvem firmar o presente Contrato de Prestação de Serviços Educacionais e Esportivos, que se regerá pelas cláusulas e condições a seguir descritas.
                        </p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 1 – DO OBJETO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>1.1 O presente contrato tem por objeto a prestação de serviços educacionais e esportivos voltados à iniciação e ao desenvolvimento da prática do futebol, incluindo atividades de formação cidadã, valores éticos, disciplina e convivência em grupo, destinados a crianças entre 03 (três) e 15 (quinze) anos de idade.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 2 – DAS ATIVIDADES</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>2.1 As atividades consistirão em treinamentos, aulas práticas e teóricas, avaliações técnicas e comportamentais, eventos internos e externos, conforme programação elaborada pela CONTRATADA.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>2.2 Parágrafo único: A frequência às atividades será conforme cronograma a ser disponibilizado oportunamente, podendo ser ajustado pela CONTRATADA de acordo com a necessidade do projeto.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 3 – DAS NORMAS DE CONDUTA E DISCIPLINA</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>3.1 Os alunos deverão manter comportamento respeitoso, assiduidade e disciplina durante todas as atividades, sendo vedado:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Uso de palavrões, agressões físicas ou verbais;</li>
                            <li>b) Desrespeito a colegas, professores e funcionários;</li>
                            <li>c) Danos ao patrimônio da escolinha ou de terceiros.</li>
                        </ul>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>3.2 Parágrafo único: A persistência em comportamentos inadequados, após advertência verbal ou escrita, poderá ensejar sanções disciplinares graduais, a critério da CONTRATADA, incluindo advertência formal, suspensão das atividades por prazo determinado e, em casos de maior gravidade ou reiteração de conduta, o desligamento definitivo do aluno, sem prejuízo das obrigações contratuais assumidas pelo CONTRATANTE.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 4 – DAS RESPONSABILIDADES DO CONTRATANTE</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>4.1 Compete ao CONTRATANTE:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Garantir a presença e pontualidade do aluno nas atividades;</li>
                            <li>b) Comunicar antecipadamente eventuais faltas ou impedimentos;</li>
                            <li>c) Zelar pela boa convivência, incentivando valores éticos e cooperativos;</li>
                            <li>d) Informar à CONTRATADA qualquer condição de saúde ou limitação física do aluno.</li>
                        </ul>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 5 – DO VALOR E FORMA DE PAGAMENTO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>
                            5.1 O CONTRATANTE compromete-se a pagar à CONTRATADA, a título de contraprestação pelos serviços educacionais e esportivos ora contratados, os seguintes valores:
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
                            5.2 O inadimplemento da mensalidade na data aprazada sujeitará o CONTRATANTE à incidência de multa moratória de {selectedPlan?.multa || 2}% ({selectedPlan?.multa === 2 ? 'dois' : selectedPlan?.multa || 'dois'} por cento) sobre o valor devido, acrescida de juros de mora de {selectedPlan?.jurosMensais || 1}% ({selectedPlan?.jurosMensais === 1 ? 'um' : selectedPlan?.jurosMensais || 'um'} por cento) ao mês, além de correção monetária com base no índice IPCA ou outro que venha a substituí-lo.
                        </p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 6 – DO UNIFORME E MATERIAIS</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.1 O uso do uniforme completo e padronizado da escolinha é obrigatório durante todas as aulas, treinos, amistosos, campeonatos e demais atividades promovidas pela CONTRATADA.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.2 O uniforme é de propriedade do aluno e deverá ser adquirido pela CONTRATANTE junto à CONTRATADA no momento da matrícula ou conforme orientação repassada pela equipe administrativa.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>6.3 O CONTRATANTE compromete-se a zelar pela conservação das peças adquiridas, ciente de que eventuais reposições por perda, extravio ou dano serão de sua responsabilidade.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 7 – DA SEGURANÇA E ISENÇÃO DE RESPONSABILIDADE</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>7.1 A CONTRATADA envidará todos os esforços para garantir um ambiente seguro, contudo, não se responsabiliza por acidentes, lesões ou enfermidades decorrentes das atividades esportivas, exceto se comprovada culpa exclusiva da equipe técnica ou gestão.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>7.2 O CONTRATANTE declara estar ciente dos riscos naturais da prática esportiva e isenta a CONTRATADA de responsabilidade civil, salvo nos casos de dolo ou negligência comprovada.</p>

                        <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 8 – DO USO DE IMAGEM</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>8.1 O CONTRATANTE autoriza, de forma gratuita, irrevogável e por prazo indeterminado, o uso da imagem e voz do aluno em fotos, vídeos e demais materiais promocionais ou institucionais, inclusive para veiculação em redes sociais e canais oficiais da CONTRATADA.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>8.2 A presente autorização é concedida sem que caiba qualquer indenização ao aluno ou a seu representante legal.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 9 – DO PRAZO E DA RESCISÃO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.1 O presente contrato terá validade pelo prazo de 12 (doze) meses, contados a partir da data de sua assinatura, podendo ser renovado mediante acordo entre as partes, por meio de termo aditivo formal.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.2 O CONTRATANTE poderá solicitar a rescisão deste contrato a qualquer momento, mediante comunicação por escrito à administração da ESCOLINHA.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.3 No entanto em caso de rescisão contratual antecipada por iniciativa do CONTRATANTE, será aplicada, de forma imediata, multa compensatória correspondente a {selectedPlan?.rescisao ? (selectedPlan.rescisao.tipo === 'fixed' ? `R$ ${(selectedPlan.rescisao.valor / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (valor fixo)` : `${selectedPlan.rescisao.valor}% (${selectedPlan.rescisao.valor === 1 ? 'um por cento' : selectedPlan.rescisao.valor === 10 ? 'dez por cento' : selectedPlan.rescisao.valor === 20 ? 'vinte por cento' : selectedPlan.rescisao.valor === 30 ? 'trinta por cento' : selectedPlan.rescisao.valor === 50 ? 'cinquenta por cento' : selectedPlan.rescisao.valor === 70 ? 'setenta por cento' : selectedPlan.rescisao.valor + ' por cento'})`) : '70% (setenta por cento)'} do valor total das mensalidades restantes até o fim do contrato. Além dessa multa, o CONTRATANTE também será responsável pelo pagamento de todas as mensalidades já vencidas e ainda não quitadas, devendo realizar o pagamento integral no momento do cancelamento.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.4 A CONTRATADA poderá rescindir este contrato, independentemente de aviso prévio, nos seguintes casos:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Inadimplemento de 02 (duas mensalidades);</li>
                            <li>b) Comportamento inadequado ou ofensivo do ALUNO ou de seu responsável legal;</li>
                            <li>c) Descumprimento de qualquer obrigação contratual relevante.</li>
                        </ul>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>9.5 Em caso de rescisão, o aluno será desligado das atividades, sem prejuízo da cobrança das obrigações vencidas e não pagas até a data do efetivo desligamento.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 10 - DAS CONSEQUÊNCIAS DO INADIMPLEMENTO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>10.1 O não pagamento de qualquer mensalidade por prazo superior a 10 (dez) dias autoriza a CONTRATADA a suspender imediatamente a participação do aluno nas atividades, até a regularização da pendência.</p>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>10.2 O atraso superior a 30 (trinta) dias ensejará:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) Rescisão contratual por justa causa, com desligamento do aluno;</li>
                            <li>b) Inscrição do débito nos órgãos de proteção ao crédito (SPC/Serasa) e/ou protesto em cartório;</li>
                            <li>c) Encaminhamento para cobrança judicial ou extrajudicial, com acréscimo de honorários advocatícios de 20% (vinte por cento) sobre o valor inadimplido, sem prejuízo da multa, juros e correção monetária.</li>
                        </ul>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 11 – DA MATRÍCULA E FORMALIZAÇÃO</h3>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>11.1 A matrícula do aluno somente será efetivada após:</p>
                        <ul style={{ listStyle: 'none', paddingLeft: '20px', margin: '10px 0' }} {...editableProps}>
                            <li>a) O preenchimento e assinatura da Ficha de Inscrição disponibilizada pela CONTRATADA;</li>
                            <li>b) A apresentação dos seguintes documentos:</li>
                            <li style={{ marginLeft: '20px' }}>• RG e CPF do responsável legal;</li>
                            <li style={{ marginLeft: '20px' }}>• Certidão de nascimento ou RG do aluno;</li>
                            <li style={{ marginLeft: '20px' }}>• Comprovante de endereço atualizado;</li>
                            <li style={{ marginLeft: '20px' }}>• Atestado médico autorizando a prática de atividades físicas.</li>
                        </ul>
                        <p style={{ marginBottom: '10px' }} {...editableProps}>11.2 A ausência de qualquer dos documentos exigidos poderá suspender o início das atividades do aluno até sua regularização, sem que isso gere obrigação de compensação de aulas pela CONTRATADA.</p>

                        <h3 style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }} {...editableProps}>CLÁUSULA 12 – DO FORO</h3>
                        <p style={{ marginBottom: '20px' }} {...editableProps}>Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de <strong>MANHUAÇU/MG</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
                        <p style={{ marginBottom: '40px' }} {...editableProps}>Parágrafo único: Para fins de comunicação formal, as partes autorizam o uso de e-mail e WhatsApp como meios válidos para envio de notificações, convocações e avisos administrativos, conferindo-lhes valor jurídico, desde que seja comprovada a integridade e a data de envio da mensagem.</p>

                        <div style={{ textAlign: 'center', marginTop: '60px', marginBottom: '60px' }} {...editableProps}>
                            <p>Manhuaçu/MG, {currentDate}.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '40px' }} {...editableProps}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ height: '62px', marginBottom: '4px' }}></div>
                                <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                                    <strong>CONTRATADA</strong><br />
                                    RUMO AO ESPORTE
                                </div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ height: '62px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                                    {signatureData && (
                                        <img src={signatureData} alt="Assinatura do contratante" style={{ height: '58px', maxWidth: '95%', objectFit: 'contain' }} />
                                    )}
                                </div>
                                <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                                    <strong>CONTRATANTE</strong><br />
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
                                ANEXO I – FICHA DE INSCRIÇÃO DO ALUNO<br />
                                RUMO AO ESPORTE
                            </h3>

                            <div style={{ marginBottom: '20px' }}>
                                <strong>DADOS DO ALUNO(A):</strong><br />
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
                                    Declaro que as informações acima prestadas são verdadeiras, e que li e estou de acordo com as cláusulas do Contrato de Prestação de Serviços Educacionais e Esportivos, firmado com a RUMO AO ESPORTE, do qual esta ficha é parte integrante.
                                </p>
                                <p style={{ fontSize: '10pt', marginTop: '5px' }}>
                                    Autorizo o uso da imagem do aluno em materiais institucionais e promocionais, conforme previsto em contrato.
                                </p>
                            </div>

                            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                                Manhuaçu/MG, {currentDate}.
                            </div>

                            <div style={{ marginTop: '50px', borderTop: '1px solid #000', paddingTop: '5px', width: '80%', margin: '40px auto 0', textAlign: 'center' }}>
                                <center>Assinatura do Responsável Legal</center>
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
