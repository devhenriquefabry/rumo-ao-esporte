export interface Employee {
    id: string;
    nome: string;
    email: string;
    senha?: string; // Optional because we might not always load it, but needed for form
    active: boolean;
    role: 'admin' | 'employee'; // 'admin' usually reserved for the main account, but employees can be 'employee'
    permissions: {
        canEdit: boolean; // Editor vs Read Only
        allowedRoutes: string[]; // List of paths from ADMIN_MENU_ITEMS
    };
    createdAt?: any;
    updatedAt?: any;
}

export const DEFAULT_ADMIN_PERMISSIONS = {
    canEdit: true,
    allowedRoutes: ['*'] // wildcard for all
};
