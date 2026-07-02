import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface SidebarItemProps {
    to: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    subItems?: { to: string; label: string; badge?: number }[];
    collapsed: boolean;
    isMobile: boolean;
    onNavigate: () => void;
}

export default function SidebarItem({ to, label, icon, badge, subItems, collapsed, isMobile: _isMobile, onNavigate }: SidebarItemProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const normalizePath = (p: string) => p.endsWith('/') ? p.slice(0, -1) : p;
    const currentPath = normalizePath(location.pathname);
    const targetPath = normalizePath(to);

    const isPathActive = currentPath === targetPath || (targetPath !== '/admin/dashboard' && targetPath !== '/professor/turmas' && currentPath.startsWith(`${targetPath}/`)) || (currentPath === targetPath);

    const isSubItemActive = subItems?.some((sub: any) => {
        const subTo = normalizePath(sub.to);
        return currentPath === subTo || currentPath.startsWith(`${subTo}/`);
    });

    const isActive = isPathActive || isSubItemActive;
    const [isOpen, setIsOpen] = useState(isActive);

    useEffect(() => {
        if (isActive) setIsOpen(true);
    }, [isActive]);

    if (subItems) {
        return (
            <>
                <div style={{ marginBottom: '4px', padding: collapsed ? '0 5px' : '0 10px' }}>
                    <button
                        className="touch-feedback"
                        onClick={() => {
                            if (collapsed) {
                                navigate(to);
                                onNavigate();
                            } else {
                                setIsOpen(!isOpen);
                            }
                        }}
                        title={collapsed ? label : ''}
                        style={{
                            width: '100%',
                            padding: collapsed ? '12px 0' : '8px 16px',
                            border: 'none',
                            background: isActive ? '#fcf2f2' : 'transparent',
                            color: isActive ? '#007d2f' : '#00237f',
                            textAlign: collapsed ? 'center' : 'left',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: collapsed ? '0' : '10px',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ color: isActive ? '#007d2f' : '#00237f', display: 'flex' }}>{icon}</span>
                        {!collapsed && <span style={{ flex: 1, textTransform: 'uppercase' }}>{label}</span>}
                        {!collapsed && <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />}
                    </button>
                    {isOpen && !collapsed && (
                        <div style={{ paddingLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {subItems.map((sub: any) => {
                                const isSubActive = location.pathname === sub.to;
                                return (
                                    <button
                                        key={sub.to}
                                        onClick={() => {
                                            navigate(sub.to);
                                            onNavigate();
                                        }}
                                        style={{
                                            padding: '6px 15px',
                                            border: 'none',
                                            background: isSubActive ? '#007d2f' : 'transparent',
                                            color: isSubActive ? '#fff' : '#00237f',
                                            borderRadius: '6px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontSize: '0.78rem',
                                            fontWeight: isSubActive ? '700' : '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <div style={{ width: '6px', height: '6px', background: isSubActive ? '#fff' : '#00237f', borderRadius: '50%', opacity: isSubActive ? 1 : 0.4 }} />
                                            <span style={{ textTransform: 'uppercase', flex: 1 }}>{sub.label}</span>
                                        </div>
                                        {sub.badge !== undefined && sub.badge > 0 && (
                                            <span style={{
                                                background: isSubActive ? '#fff' : '#007d2f',
                                                color: isSubActive ? '#007d2f' : '#fff',
                                                fontSize: '0.65rem',
                                                fontWeight: 'bold',
                                                padding: '1px 6px',
                                                borderRadius: '8px',
                                                minWidth: '18px',
                                                textAlign: 'center'
                                            }}>
                                                {sub.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                {!collapsed && <div style={{ height: '1px', background: 'rgba(0, 35, 127, 0.08)', margin: '4px -10px' }} />}
            </>
        );
    }

    return (
        <div style={{ marginBottom: '4px', padding: collapsed ? '0 5px' : '0 10px' }}>
            <button
                className="touch-feedback"
                onClick={() => {
                    navigate(to);
                    onNavigate();
                }}
                title={collapsed ? label : ''}
                style={{
                    width: '100%',
                    padding: collapsed ? '12px 0' : '8px 16px',
                    border: 'none',
                    background: isActive ? '#007d2f' : 'transparent',
                    color: isActive ? '#fff' : '#00237f',
                    textAlign: collapsed ? 'center' : 'left',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? '700' : '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: collapsed ? '0' : '10px',
                    minHeight: '36px',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                }}
                onMouseOver={e => !isActive && (e.currentTarget.style.background = '#f0f4ff')}
                onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
                <span style={{ color: isActive ? '#fff' : '#00237f', display: 'flex' }}>{icon}</span>
                {!collapsed && <span style={{ flex: 1, textTransform: 'uppercase' }}>{label}</span>}
                {badge !== undefined && badge > 0 && !collapsed && (
                    <span style={{
                        background: isActive ? '#fff' : '#00237f',
                        color: isActive ? '#007d2f' : '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '10px'
                    }}>
                        {badge}
                    </span>
                )}
            </button>
            {!collapsed && <div style={{ height: '1px', background: 'rgba(0, 35, 127, 0.08)', margin: '4px -10px' }} />}
        </div>
    );
}
