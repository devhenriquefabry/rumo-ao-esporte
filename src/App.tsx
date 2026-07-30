
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicForm from './pages/PublicForm';
import SchoolSystemRequestForm from './pages/SchoolSystemRequestForm';
import SchoolSystemRequestsView from './pages/SchoolSystemRequestsView';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard/index';
import AdminDetails from './pages/AdminDetails';
import AdminStats from './pages/AdminStats';
import AdminExport from './pages/AdminExport';

import AdminSettings from './pages/AdminSettings';
import AdminWhatsApp from './pages/AdminWhatsApp';
import AdminTurmas from './pages/AdminTurmas';
import AdminTurmaDetails from './pages/AdminTurmaDetails';
import AdminAutoAllocation from './pages/AdminAutoAllocation';
import AdminPlanAutoAllocation from './pages/AdminPlanAutoAllocation';
import AdminBirthdays from './pages/AdminBirthdays';
import AdminCarteirinhas from './pages/AdminCarteirinhas';
import AdminTestes from './pages/AdminTestes';
import AdminLinks from './pages/AdminLinks';
import AdminFinanceiro from './pages/AdminFinanceiro';
import AdminFinanceiroCobrancas from './pages/AdminFinanceiroCobrancas';
import AdminPaymentDetails from './pages/AdminPaymentDetails';
import AdminPaymentProviderSettings from './pages/AdminPaymentProviderSettings';
import AdminGastos from './pages/AdminGastos';
import AdminNovoCadastro from './pages/AdminNovoCadastro';
import AdminMigrateTurmas from './pages/AdminMigrateTurmas'; // Migration tool
import AdminAttendanceRecords from './pages/AdminAttendanceRecords';
import ChamadaTurma from './pages/ChamadaTurma';
import StudentContract from './pages/StudentContract';
import { CustomDialogProvider } from './context/CustomDialogContext';
import MaintenanceGuard from './components/MaintenanceGuard';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import NewVersionPrompt from './components/NewVersionPrompt';
import './App.css';

// Student Portal Imports
import StudentLogin from './pages/StudentLogin';
import StudentLayout from './layouts/StudentLayout';
import StudentHome from './pages/StudentHome';
import StudentCarteirinha from './pages/StudentCarteirinha';
import StudentPayments from './pages/StudentPayments';
import StudentSettings from './pages/StudentSettings';
import StudentWhatsApp from './pages/StudentWhatsApp';
import StudentProfile from './pages/StudentProfile';
import StudentAccess from './pages/StudentAccess';
import StudentReservas from './pages/StudentReservas';
import StudentWhatsPortaria from './pages/StudentWhatsPortaria';
import StudentWhatsGrupo from './pages/StudentWhatsGrupo';
import StudentEstatuto from './pages/StudentEstatuto';
import StudentRegimento from './pages/StudentRegimento';
import StudentRadio from './pages/StudentRadio';
import StudentHorarios from './pages/StudentHorarios';
import StudentStore from './pages/StudentStore';
import MandatoryContractPage from './pages/MandatoryContractPage';

// Teacher Portal Imports
import TeacherLayout from './layouts/TeacherLayout';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherTurmaDetails from './pages/TeacherTurmaDetails';
import TeacherStudentDetails from './pages/TeacherStudentDetails';

import AdminTeachers from './pages/AdminTeachers'; // Import new component

import { LoadingProvider } from './components/LoadingService';

import AdminPlans from './pages/AdminPlans'; // Import new component
import AdminContractList from './pages/AdminContractList';
import AdminContractTemplate from './pages/AdminContractTemplate';
import AdminEmployees from './pages/AdminEmployees';
import Portaria from './pages/Portaria';
import AdminRentals from './pages/AdminRentals';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminSimuladorPage from './pages/AdminSimuladorPage';
import AdminConvocacaoList from './pages/AdminConvocacaoList';
import AdminConvocacaoDetails from './pages/AdminConvocacaoDetails';
import AdminMidias from './pages/AdminMidias';
import AdminDocumentos from './pages/AdminDocumentos';
import AdminMensagens from './pages/AdminMensagens';
import AdminMensagensCobrancas from './pages/AdminMensagens/AdminMensagensCobrancas';
import AdminMensagensAutomacao from './pages/AdminMensagens/AdminMensagensAutomacao';
import AdminMensagensFila from './pages/AdminMensagens/AdminMensagensFila';
import AdminMensagensConfig from './pages/AdminMensagens/AdminMensagensConfig';
import AdminMensagensHistorico from './pages/AdminMensagens/AdminMensagensHistorico';
import AdminEvolutionMessages from './pages/AdminEvolutionMessages';
import AdminStore from './pages/AdminStore';

function App() {
  return (
    <CustomDialogProvider>
      <LoadingProvider>
        <BrowserRouter>
          <PWAInstallPrompt />
          <NewVersionPrompt />
          <Routes>
            <Route path="/" element={<PublicForm />} />
            <Route path="/solicitar-sistema-escola" element={<SchoolSystemRequestForm />} />
            <Route path="/solicitacoes-sistema-escola" element={<SchoolSystemRequestsView />} />
            <Route path="/chamada/:modalidadeId/:turmaId" element={<ChamadaTurma />} />
            <Route path="/chamada-v2/:id" element={<ChamadaTurma />} />

            {/* Student Routes */}
            {/* Student Routes */}
            <Route path="/aluno/login" element={<StudentLogin />} />
            <Route path="/aluno/contrato-obrigatorio" element={<MandatoryContractPage />} />
            <Route path="/aluno" element={<StudentLayout />}>
              <Route path="dashboard" element={<StudentHome />} />
              <Route path="carteirinha" element={<StudentCarteirinha />} />
              <Route path="financeiro" element={<StudentPayments />} />
              <Route path="configuracoes" element={<StudentSettings />} />
              <Route path="perfil" element={<StudentProfile />} />
              <Route path="whatsapp" element={<StudentWhatsApp />} />
              <Route path="acessos" element={<StudentAccess />} />
              <Route path="reservas" element={<StudentReservas />} />
              <Route path="whats-portaria" element={<StudentWhatsPortaria />} />
              <Route path="whats-grupo" element={<StudentWhatsGrupo />} />
              <Route path="estatuto" element={<StudentEstatuto />} />
              <Route path="regimento" element={<StudentRegimento />} />
              <Route path="radio" element={<StudentRadio />} />
              <Route path="horarios" element={<StudentHorarios />} />
              <Route path="loja" element={<StudentStore />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Teacher Routes */}
            <Route path="/professor" element={<MaintenanceGuard><TeacherLayout /></MaintenanceGuard>}>
              <Route path="turmas" element={<TeacherDashboard />} />
              <Route path="turmas/:id" element={<TeacherTurmaDetails />} />
              <Route path="aluno/:id/:studentIndex" element={<TeacherStudentDetails />} />
              <Route path="reservas" element={<StudentReservas />} />
              <Route path="jogos/convocacao" element={<AdminConvocacaoList />} />
              <Route path="jogos/convocacao/:id" element={<AdminConvocacaoDetails />} />
              <Route index element={<Navigate to="turmas" replace />} />
            </Route>

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="cadastros/novo" element={<AdminNovoCadastro />} />
              <Route path="cadastros/pendentes" element={<AdminDashboard filterStatus="pendente" />} />
              <Route path="cadastros/desativados" element={<AdminDashboard filterStatus="desativados" />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="relatorios" element={<AdminReportsPage />} />
              <Route path="simulador" element={<AdminSimuladorPage />} />
              <Route path="export" element={<AdminExport />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
              <Route path="financeiro/gastos" element={<AdminGastos />} />
              <Route path="financeiro/cobrancas" element={<AdminFinanceiroCobrancas />} />
              <Route path="financeiro/bancos" element={<AdminPaymentProviderSettings />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="plans/auto-allocation" element={<AdminPlanAutoAllocation />} />
              <Route path="professores" element={<AdminTeachers />} />
              <Route path="portaria" element={<Portaria />} /> {/* New route */}
              <Route path="alugueis" element={<AdminRentals />} />
              <Route path="payment-test" element={<AdminPaymentProviderSettings />} />

              <Route path="settings" element={<AdminSettings />} />
              <Route path="whatsapp" element={<AdminWhatsApp />} />
              <Route path="details/:id" element={<AdminDetails />} />
              <Route path="turmas" element={<AdminTurmas />} />
              <Route path="turmas/chamadas" element={<AdminAttendanceRecords />} />
              <Route path="turmas/migration" element={<AdminMigrateTurmas />} />
              <Route path="turmas/auto-allocation" element={<AdminAutoAllocation />} />
              <Route path="turmas/:id" element={<AdminTurmaDetails />} />
              <Route path="carteirinhas" element={<AdminCarteirinhas />} />
              <Route path="aniversariantes" element={<AdminBirthdays />} />
              <Route path="links" element={<AdminLinks />} />
              <Route path="testes" element={<AdminTestes />} />
              <Route path="funcionarios" element={<AdminEmployees />} />
              <Route path="contratos" element={<AdminContractList />} />
              <Route path="contratos/modelo" element={<AdminContractTemplate />} />
              <Route path="contract/:id/:studentIndex?" element={<StudentContract />} />
              <Route path="jogos/convocacao" element={<AdminConvocacaoList />} />
              <Route path="midias" element={<AdminMidias />} />
              <Route path="documentos" element={<AdminDocumentos />} />
              <Route path="store" element={<AdminStore />} />
              <Route path="jogos/convocacao/:id" element={<AdminConvocacaoDetails />} />
              <Route path="mensagens" element={<AdminMensagens />} />
              <Route path="mensagens/cobrancas" element={<AdminMensagensCobrancas />} />
              <Route path="mensagens/fila" element={<AdminMensagensFila />} />
              <Route path="mensagens/historico" element={<AdminMensagensHistorico />} />
              <Route path="mensagens/automacao" element={<AdminMensagensAutomacao />} />
              <Route path="mensagens/configuracoes" element={<AdminMensagensConfig />} />
              <Route path="mensagens-evolution" element={<AdminEvolutionMessages />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="/admin/financeiro/fatura/:id" element={<AdminPaymentDetails />} />
          </Routes>
        </BrowserRouter>
      </LoadingProvider>
    </CustomDialogProvider >
  );
}

export default App;
