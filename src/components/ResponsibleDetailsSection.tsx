import { useState } from 'react';
import { User, Phone, MapPin, ChevronDown, ChevronRight } from 'lucide-react';

interface ResponsibleSectionProps {
    data: any;
    setData: (data: any) => void;
    isEditing?: boolean;
}

// Externalized to prevent focus loss
const EditField = ({ label, value, onChange }: any) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                background: '#fcfcfc'
            }}
        />
    </div>
);

export default function ResponsibleDetailsSection({ data, setData, isEditing = false }: ResponsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleDateChange = (val: string) => {
        let v = val.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
        else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
        setData({ ...data, responsavel: { ...data.responsavel, dataNascimento: v } });
    };

    const handleCPFChange = (val: string) => {
        let v = val.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{3})/, "$1.$2");
        setData({ ...data, responsavel: { ...data.responsavel, cpf: v } });
    };

    const DisplayField = ({ label, value }: { label: string, value: string }) => (
        <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '2px' }}>{label}</label>
            <div style={{ fontSize: '0.95rem', color: '#333', fontWeight: '500', padding: '1px 0' }}>{value || '---'}</div>
        </div>
    );

    return (
        <div className="detail-card" style={{
            background: '#fff',
            padding: '12px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            borderLeft: '4px solid #007d2f',
            width: '100%',
            marginBottom: '10px'
        }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee', cursor: 'pointer', userSelect: 'none' }}
            >
                {isOpen ? <ChevronDown size={18} color="#007d2f" /> : <ChevronRight size={18} color="#007d2f" />}
                <User size={18} color="#007d2f" />
                <h3 style={{ margin: 0, color: '#333', fontSize: '1rem', flex: 1 }}>Responsável Financeiro</h3>
            </div>

            {isOpen && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1fr', gap: '12px', alignItems: 'start', marginTop: '10px' }} className="responsible-grid">
                        {/* Left Col: Personal Data */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {isEditing ? (
                                <>
                                    <EditField label="Nome Completo" value={data.responsavel?.nome} onChange={(v: string) => setData({ ...data, responsavel: { ...data.responsavel, nome: v } })} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <EditField label="CPF" value={data.responsavel?.cpf} onChange={handleCPFChange} />
                                        <EditField label="Data Nasc" value={data.responsavel?.dataNascimento} onChange={handleDateChange} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <EditField label="Telefone" value={data.responsavel?.telefonePrincipal} onChange={(v: string) => setData({ ...data, responsavel: { ...data.responsavel, telefonePrincipal: v } })} />
                                        <EditField label="Email" value={data.responsavel?.email} onChange={(v: string) => setData({ ...data, responsavel: { ...data.responsavel, email: v } })} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <DisplayField label="Nome Completo" value={data.responsavel?.nome} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <DisplayField label="CPF" value={data.responsavel?.cpf} />
                                        <DisplayField label="Data Nasc" value={data.responsavel?.dataNascimento} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <DisplayField label="Telefone" value={data.responsavel?.telefonePrincipal} />
                                        <DisplayField label="Email" value={data.responsavel?.email} />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right Col: Address & Contact Action */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#555', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <MapPin size={14} /> Endereço
                                </h4>
                                <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: '1.4' }}>
                                    <div>{data.responsavel?.endereco?.rua}, {data.responsavel?.endereco?.numero}</div>
                                    <div style={{ color: '#666' }}>{data.responsavel?.endereco?.bairro} - {data.responsavel?.endereco?.cidade}/{data.responsavel?.endereco?.uf}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>CEP: {data.responsavel?.endereco?.cep}</div>
                                </div>
                            </div>

                            {data.responsavel?.telefonePrincipal && (
                                <a
                                    href={`https://wa.me/55${data.responsavel.telefonePrincipal.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        background: '#25D366',
                                        color: '#fff',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        transition: 'opacity 0.2s',
                                        marginTop: 'auto'
                                    }}
                                >
                                    <Phone size={16} /> Falar no WhatsApp
                                </a>
                            )}
                        </div>
                    </div>

                    <style>{`
                        @media (max-width: 800px) {
                            .responsible-grid { grid-template-columns: 1fr !important; }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
}
