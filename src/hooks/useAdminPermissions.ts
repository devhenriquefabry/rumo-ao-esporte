import { useState, useEffect } from 'react';
import type { Employee } from '../types/user';
import { DEFAULT_ADMIN_PERMISSIONS } from '../types/user';
import { DIRETORIA_PERMISSIONS, isDiretoriaEmail } from '../config/accessProfiles';

const MAIN_ADMIN_EMAILS = [
    ((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase()
];

const isMainAdminEmail = (email?: string | null) =>
    !!email && MAIN_ADMIN_EMAILS.includes(email.trim().toLowerCase());

export function useAdminPermissions() {
    const [role, setRole] = useState<'admin' | 'employee'>('admin');
    const [permissions, setPermissions] = useState(DEFAULT_ADMIN_PERMISSIONS);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<Employee | null>(null);

    useEffect(() => {
        const storedAuth = localStorage.getItem('rae_admin_auth');

        if (!storedAuth) {
            setLoading(false);
            return;
        }

        let unsubscribe: (() => void) | undefined;

        const setupListener = async () => {
            try {
                // First check if it's the legacy "true" string (Main Admin - ALWAYS FULL ACCESS)
                if (storedAuth === 'true') {
                    setRole('admin');
                    setPermissions(DEFAULT_ADMIN_PERMISSIONS);
                    setUser({ id: 'admin', nome: 'Administrador', email: MAIN_ADMIN_EMAILS[0], role: 'admin', active: true, permissions: DEFAULT_ADMIN_PERMISSIONS });
                    setLoading(false);
                } else {
                    // It's a JSON object (Employee)
                    const parsedUser = JSON.parse(storedAuth) as Employee;

                    if (isMainAdminEmail(parsedUser.email)) {
                        setRole('admin');
                        setPermissions(DEFAULT_ADMIN_PERMISSIONS);
                        setUser({ ...parsedUser, role: 'admin', active: true, permissions: DEFAULT_ADMIN_PERMISSIONS });
                        setLoading(false);
                        return;
                    }

                    // Perfil "Diretoria": permissões definidas no código (não confiar no localStorage)
                    if (isDiretoriaEmail(parsedUser.email)) {
                        setRole('employee');
                        setPermissions(DIRETORIA_PERMISSIONS);
                        setUser({ ...parsedUser, role: 'employee', active: true, permissions: DIRETORIA_PERMISSIONS });
                        setLoading(false);
                        return;
                    }

                    // We trust the ID from local storage to know WHO it is, but NOT the permissions.
                    // Initial state: Set user basic info, but permissions pending.
                    setUser(parsedUser);

                    if (parsedUser.id && parsedUser.role !== 'admin') {
                        try {
                            const { doc, onSnapshot } = await import('firebase/firestore');
                            const { db } = await import('../firebase');

                            const docRef = doc(db, 'employees', parsedUser.id);

                            // REAL-TIME LISTENER
                            unsubscribe = onSnapshot(docRef, (docSnap) => {
                                if (docSnap.exists()) {
                                    const freshData = docSnap.data() as Employee;

                                    // Security Check: If deactivated, force logout or strictly limit
                                    if (freshData.active === false) {
                                        console.warn("User deactivated in real-time. restricting access.");
                                        setPermissions({ canEdit: false, allowedRoutes: [] }); // Lock out
                                        // Optional: force logout handled by UI or next action
                                    } else {
                                        setPermissions(freshData.permissions || { canEdit: false, allowedRoutes: [] });
                                        setRole(freshData.role);
                                    }

                                    setUser({ ...parsedUser, ...freshData });
                                    setLoading(false);
                                } else {
                                    // Document deleted? Lock out.
                                    setPermissions({ canEdit: false, allowedRoutes: [] });
                                    setUser(null);
                                    setLoading(false);
                                }
                            }, (err) => {
                                console.error("Real-time permission error:", err);
                                setLoading(false);
                            });

                        } catch (err) {
                            console.error("Error setting up listener:", err);
                            setLoading(false);
                        }
                    } else {
                        // If somehow role is admin in JSON (shouldn't happen for employees), trust it? 
                        // Or treating as Main Admin fallback
                        setRole(parsedUser.role);
                        setPermissions(parsedUser.permissions);
                        setLoading(false);
                    }
                }
            } catch (e) {
                console.error("Error parsing admin auth", e);
                setRole('admin');
                setLoading(false);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const isAllowed = (path: string) => {
        if (permissions.allowedRoutes.includes('*')) return true;
        // Check exact match or if the path starts with an allowed route (for sub-routes)
        return permissions.allowedRoutes.some(allowed => path.startsWith(allowed));
    };

    return {
        role,
        canEdit: permissions.canEdit,
        allowedRoutes: permissions.allowedRoutes,
        isAllowed,
        loading,
        user
    };
}
