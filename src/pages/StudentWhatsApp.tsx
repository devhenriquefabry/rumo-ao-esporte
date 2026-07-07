import { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';
import { MessageCircle } from 'lucide-react';

export default function StudentWhatsApp() {
    const [seconds, setSeconds] = useState(3);

    useEffect(() => {
        const timer = setInterval(() => {
            setSeconds((prev) => prev - 1);
        }, 1000);

        const redirect = setTimeout(() => {
            const phone = '553235314777';
            const text = 'Olá, sou aluno da Rumo ao Esporte e gostaria de tirar uma dúvida.';
            window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        }, 3000);

        return () => {
            clearInterval(timer);
            clearTimeout(redirect);
        };
    }, []);

    return (
        <PageContainer>
            <div style={{
                height: '60vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: '#25D366', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '20px',
                    boxShadow: '0 10px 20px rgba(37, 211, 102, 0.3)'
                }} className="animate-scale-in">
                    <MessageCircle size={40} />
                </div>

                <h2 style={{ color: '#17428f', margin: '0 0 10px 0' }}>Fale Conosco</h2>
                <p style={{ color: '#666', fontSize: '1.1rem', maxWidth: '400px', margin: '0 0 30px 0' }}>
                    Você está sendo redirecionado para o WhatsApp da Secretaria...
                </p>

                <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#00a63a'
                }}>
                    {seconds}
                </div>
            </div>
        </PageContainer>
    );
}
