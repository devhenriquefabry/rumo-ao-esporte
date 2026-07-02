import React from 'react';
import { ALL_SYSTEM_ROUTES, getAllFlatRoutes } from '../../config/routes';
import type { Employee } from '../../types/user';
import { Check, Shield, Lock, Eye } from 'lucide-react';

interface EmployeeFormModalProps {
    isOpen: boolean;
    editingId: string | null;
    formData: Partial<Employee>;
    setFormData: (data: any) => void;
    onSave: (e: React.FormEvent) => void;
    onClose: () => void;
}

export default function EmployeeFormModal({ isOpen, editingId, formData, setFormData, onSave, onClose }: EmployeeFormModalProps) {
    if (!isOpen) return null;

    const toggleRoute = (route: string) => {
        let currentRoutes = formData.permissions?.allowedRoutes || [];

        // Fix: Remove wildcard '*' if present, so we start with a clean list or existing explicit routes
        if (currentRoutes.includes('*')) {
            currentRoutes = [];
        }

        let newRoutes: string[];

        // If clicking a route, add/remove it
        if (currentRoutes.includes(route)) {
            newRoutes = currentRoutes.filter(r => r !== route);
        } else {
            newRoutes = [...currentRoutes, route];
        }

        setFormData({
            ...formData,
            permissions: {
                ...formData.permissions,
                allowedRoutes: newRoutes
            }
        });
    };

    const toggleAllRoutes = () => {
        const allRoutes = getAllFlatRoutes();
        const currentRoutes = formData.permissions?.allowedRoutes || [];

        if (currentRoutes.length === allRoutes.length) {
            // Deselect all
            setFormData({ ...formData, permissions: { ...formData.permissions, allowedRoutes: [] } });
        } else {
            // Select all
            setFormData({ ...formData, permissions: { ...formData.permissions, allowedRoutes: allRoutes } });
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
            <div className="native-card" style={{ width: '100%', maxWidth: '600px', margin: 0, animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', padding: '30px', borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ margin: 0, color: '#007d2f', fontSize: '1.6rem', fontWeight: '900' }}>{editingId ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
                </div>

                <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Basic Info */}
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Nome Completo</label>
                            <input
                                className="native-input"
                                style={{ height: '45px', borderRadius: '10px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                value={formData.nome || ''}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                required
                                placeholder="Ex: Maria Souza"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Email (Login)</label>
                            <input
                                type="email"
                                className="native-input"
                                style={{ height: '45px', borderRadius: '10px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem' }}
                                value={formData.email || ''}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                required
                                placeholder="funcionario@uba.com"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>Senha de Acesso</label>
                            <input
                                type="text"
                                className="native-input"
                                style={{ height: '45px', borderRadius: '10px', padding: '0 15px', border: '1.5px solid #eee', width: '100%', fontSize: '1rem', fontFamily: 'monospace' }}
                                value={formData.senha || ''}
                                onChange={e => setFormData({ ...formData, senha: e.target.value })}
                                required
                                placeholder="Senha"
                            />
                        </div>
                    </div>

                    <div style={{ height: '1px', background: '#eee', margin: '10px 0' }} />

                    {/* Permissions Section */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={18} color="#007d2f" /> Permissões de Acesso
                        </h3>

                        {/* Role Toggle */}
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ display: 'block', fontWeight: 'bold', color: '#333' }}>Tipo de Acesso</span>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>Defina se o usuário pode editar dados.</span>
                            </div>
                            <div style={{ display: 'flex', background: '#e9ecef', padding: '4px', borderRadius: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, canEdit: false } })}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                                        background: !formData.permissions?.canEdit ? '#fff' : 'transparent',
                                        color: !formData.permissions?.canEdit ? '#007d2f' : '#666',
                                        boxShadow: !formData.permissions?.canEdit ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                        display: 'flex', alignItems: 'center', gap: '5px'
                                    }}
                                >
                                    <Eye size={14} /> Somente Leitura
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, canEdit: true } })}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                                        background: formData.permissions?.canEdit ? '#fff' : 'transparent',
                                        color: formData.permissions?.canEdit ? '#2ecc71' : '#666',
                                        boxShadow: formData.permissions?.canEdit ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                        display: 'flex', alignItems: 'center', gap: '5px'
                                    }}
                                >
                                    <Lock size={14} /> Editor
                                </button>
                            </div>
                        </div>

                        {/* Menu Checkboxes */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>Acesso às Rotas do Sistema</span>
                                <button type="button" onClick={toggleAllRoutes} style={{ border: 'none', background: 'transparent', color: '#007d2f', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>
                                    Selecionar Todas
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {ALL_SYSTEM_ROUTES.map((category, catIndex) => (
                                    <div key={catIndex} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px' }}>
                                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>{category.category}</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {category.routes.map(item => {
                                                const isSelected = formData.permissions?.allowedRoutes?.includes(item.path);
                                                return (
                                                    <div
                                                        key={item.path}
                                                        onClick={() => toggleRoute(item.path)}
                                                        style={{
                                                            padding: '10px', borderRadius: '8px', border: isSelected ? '1px solid #007d2f' : '1px solid #ddd',
                                                            background: isSelected ? '#fff5f5' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                                                            transition: 'all 0.2s',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '18px', height: '18px', borderRadius: '4px', border: isSelected ? 'none' : '2px solid #ddd',
                                                            background: isSelected ? '#007d2f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                                                        </div>
                                                        <span style={{ fontSize: '0.85rem', color: isSelected ? '#007d2f' : '#555', fontWeight: isSelected ? '700' : '500', lineHeight: 1.2 }}>{item.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
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
                        />
                        <label htmlFor="activeCheck" style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', color: '#333' }}>Manter cadastro ativo</label>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, height: '55px', borderRadius: '15px', border: 'none', background: '#f5f5f5', color: '#666', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' }}>CANCELAR</button>
                        <button type="submit" style={{ flex: 1, height: '55px', borderRadius: '15px', border: 'none', background: '#007d2f', color: '#fff', fontWeight: '900', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 6px 15px rgba(0, 125, 47, 0.3)' }}>SALVAR</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
