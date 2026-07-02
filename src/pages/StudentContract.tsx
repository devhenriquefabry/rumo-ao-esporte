import { useParams, useNavigate } from 'react-router-dom';
import ContractEditor from '../components/contracts/ContractEditor';

export default function StudentContract() {
    const { id, studentIndex } = useParams();
    const navigate = useNavigate();

    return (
        <ContractEditor
            mode="student"
            registrationId={id}
            studentIndex={studentIndex ? parseInt(studentIndex) : 0}
            onBack={() => navigate(-1)}
        />
    );
}
