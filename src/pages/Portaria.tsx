import React, { useState, useEffect } from 'react';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Clock, Search, User, ChevronRight } from 'lucide-react';
import PortariaHistoryList from '../components/PortariaHistoryList';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface StudentSearchItem {
    id: string; // registrationId
    parentData: any;
    studentData: any;
    name: string;
    turmaId: string;
    photoUrl?: string;
}

const Portaria: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<StudentSearchItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllStudents = async () => {
            try {
                const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'), orderBy('responsavel.nome'));
                const snap = await getDocs(q);

                const allStudents: StudentSearchItem[] = [];

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.alunos && Array.isArray(data.alunos)) {
                        data.alunos.forEach((aluno: any) => {
                            allStudents.push({
                                id: doc.id,
                                parentData: data,
                                studentData: aluno,
                                name: aluno.nome || 'Sem nome',
                                turmaId: aluno.turmaId || '',
                                photoUrl: aluno.fotoUrl
                            });
                        });
                    }
                });

                // Sort by student name
                allStudents.sort((a, b) => a.name.localeCompare(b.name));
                setStudents(allStudents);
            } catch (error) {
                console.error("Error fetching students for portaria search:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllStudents();
    }, []);

    const normalizeText = (text: string) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const filteredStudents = searchTerm.length >= 2
        ? students.filter(s => {
            const normalizedSearch = normalizeText(searchTerm);
            const normalizedName = normalizeText(s.name);
            const cpfMatch = s.parentData.responsavel?.cpf?.includes(searchTerm);

            return normalizedName.includes(normalizedSearch) || cpfMatch;
        })
        : [];

    const handleStudentClick = (studentItem: StudentSearchItem) => {
        // Dispatch event to global scanner
        const event = new CustomEvent('trigger-manual-scan', {
            detail: {
                student: studentItem.studentData,
                parent: studentItem.parentData,
                registrationId: studentItem.id
            }
        });
        window.dispatchEvent(event);
        setSearchTerm(''); // Clear search after click
    };
    return (
        <PageContainer>
            <PageTitle
                title="MONITORAMENTO DE PORTARIA"
                subtitle="Histórico em tempo real de acessos ao clube"
            />

            <div style={{
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '20px 30px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <Clock size={24} color="#00a63a" />
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '800' }}>
                        ÚLTIMOS ACESSOS
                    </h2>
                </div>

                <div style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder={loading ? "Carregando alunos..." : "Buscar aluno por nome ou CPF do responsável..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '15px 15px 15px 50px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                fontSize: '1rem',
                                color: '#1e293b',
                                outline: 'none',
                                transition: 'all 0.2s',
                                backgroundColor: loading ? '#f8fafc' : '#fff'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#00a63a'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />

                        {filteredStudents.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '10px',
                                background: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                border: '1px solid #e2e8f0',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 10
                            }}>
                                {filteredStudents.map((item, idx) => (
                                    <div
                                        key={`${item.id}-${idx}`}
                                        onClick={() => handleStudentClick(item)}
                                        style={{
                                            padding: '15px 20px',
                                            borderBottom: idx < filteredStudents.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: '#f1f5f9',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                {item.photoUrl ? (
                                                    <img src={item.photoUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <User size={20} color="#94a3b8" />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{item.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Responsável: {item.parentData.responsavel?.nome}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} color="#cbd5e1" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {searchTerm.length >= 2 && filteredStudents.length === 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '10px',
                                background: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                border: '1px solid #e2e8f0',
                                padding: '20px',
                                textAlign: 'center',
                                color: '#64748b',
                                zIndex: 10
                            }}>
                                Nenhum aluno encontrado.
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '10px' }}>
                    <PortariaHistoryList />
                </div>
            </div>
        </PageContainer>
    );
};

export default Portaria;
