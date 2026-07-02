interface TeacherFormModalProps {
    isOpen: boolean;
    editingId: string | null;
    formData: {
        nome: string;
        email: string;
        telefone: string;
        cpf: string;
        active: boolean;
        senha: string;
    };
    setFormData: (data: any) => void;
    onSave: (e: React.FormEvent) => void;
    onClose: () => void;
    readOnly?: boolean;
}

export default function TeacherFormModal({ isOpen, editingId, formData, setFormData, onSave, onClose, readOnly }: TeacherFormModalProps) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
            <div className="native-card" style={{ width: '100%', maxWidth: '550px', margin: 0, animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', padding: '35px', borderRadius: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ margin: 0, color: '#007d2f', fontSize: '1.6rem', fontWeight: '900' }}>
                        {readOnly ? 'Detalhes do Professor' : (editingId ? 'Editar Professor' : 'Novo Professor')}
                    </h2>
                </div>

                <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Nome Completo</label>
                            <input
                                className="native-input"
                                style={{ height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                required
                                placeholder="Ex: João Silva"
                                disabled={readOnly}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Email (Login no Portal)</label>
                            <input
                                type="email"
                                className="native-input"
                                style={{ height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                required
                                placeholder="professor@exemplo.com"
                                disabled={readOnly}
                            />
                            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#999', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#007d2f' }} /> Usado para acesso ao Portal do Professor.
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Senha de Acesso</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="native-input"
                                    style={{ height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem', fontFamily: 'monospace' }}
                                    value={formData.senha}
                                    onChange={e => setFormData({ ...formData, senha: e.target.value })}
                                    required
                                    placeholder="Senha"
                                    disabled={readOnly}
                                />
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#999', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#007d2f' }} /> Padrão: arena2026
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Telefone</label>
                                <input
                                    className="native-input"
                                    style={{ height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                    value={formData.telefone}
                                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                    disabled={readOnly}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>CPF</label>
                                <input
                                    className="native-input"
                                    style={{ height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                    value={formData.cpf}
                                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                    disabled={readOnly}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '15px', background: '#f8f9fa', borderRadius: '15px' }}>
                        <input
                            type="checkbox"
                            id="activeCheck"
                            checked={formData.active}
                            onChange={e => setFormData({ ...formData, active: e.target.checked })}
                            style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#007d2f' }}
                            disabled={readOnly}
                        />
                        <label htmlFor="activeCheck" style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', color: '#333' }}>Manter cadastro ativo</label>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, height: '55px', borderRadius: '15px', border: 'none', background: '#f5f5f5', color: '#666', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' }}>
                            {readOnly ? 'FECHAR' : 'CANCELAR'}
                        </button>
                        {!readOnly && (
                            <button type="submit" style={{ flex: 1, height: '55px', borderRadius: '15px', border: 'none', background: '#007d2f', color: '#fff', fontWeight: '900', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 6px 15px rgba(0, 125, 47, 0.3)' }}>SALVAR</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
