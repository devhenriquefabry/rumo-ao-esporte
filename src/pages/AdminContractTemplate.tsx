import { useNavigate } from 'react-router-dom';
import ContractEditor from '../components/contracts/ContractEditor';

export default function AdminContractTemplate() {
    const navigate = useNavigate();

    return (
        <ContractEditor
            mode="template"
            onBack={() => navigate('/admin/contratos')}
            title="Modelo de Contrato (Global)"
        />
    );
}
