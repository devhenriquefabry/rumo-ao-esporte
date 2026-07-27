import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { formatModalidade } from '../utils/modalidadeUtils';

interface StudentCardProps {
    student: {
        nome: string;
        dataNascimento: string;
        cpf: string;
        fotoUrl?: string;
    };
    responsavel?: {
        nome: string;
        cpf: string;
        telefonePrincipal?: string;
        telefone?: string;
        email: string;
        endereco?: {
            rua?: string;
            numero?: string;
            bairro?: string;
            cidade?: string;
            estado?: string;
        };
    };
    numeroCota?: string;
    modalidade?: string | string[];
    width?: string | number;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, responsavel, numeroCota, modalidade, width = '100%' }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        const generateQR = async () => {
            if (student.nome) {
                try {
                    // Use student CPF, fallback to Responsible CPF, fallback to 000...
                    const cpfToUse = student.cpf || responsavel?.cpf || '000.000.000-00';
                    const data = `${cpfToUse}|${student.dataNascimento || ''}|${student.nome}`;
                    const url = await QRCode.toDataURL(data, { margin: 1, width: 128 });
                    setQrCodeUrl(url);
                } catch (err) {
                    console.error("Error generating QR code:", err);
                }
            }
        };
        generateQR();
    }, [student, responsavel]);

    const formatName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 4) {
            for (let i = 2; i < parts.length - 1; i++) {
                parts[i] = parts[i][0].toUpperCase() + '.';
            }
        }
        return parts.join(' ');
    };

    const formatAddress = () => {
        if (!responsavel?.endereco) return '-';
        const e = responsavel.endereco;
        const parts = [e.rua, e.numero, e.bairro, e.cidade, e.estado].filter(Boolean);
        return parts.join(', ') || '-';
    };

    return (
        <div style={{ width: width, maxWidth: '100%', perspective: '1200px', perspectiveOrigin: 'center center' }}>
            <div
                className="flip-card-inner"
                style={{
                    position: 'relative',
                    paddingBottom: '63.7%',
                    transition: 'transform 0.65s ease-in-out',
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformOrigin: 'center center',
                    willChange: 'transform'
                }}
            >
                {/* FRONT SIDE */}
                <div className="student-card-container" style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url(/carteirinha.png)',
                    backgroundSize: '100% 100%',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    userSelect: 'none',
                    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg) translateZ(0.5px)'
                }}>
                    {/* PHOTO */}
                    <div style={{
                        position: 'absolute',
                        top: '47.5%',
                        left: '9.0%',
                        width: '21.0%',
                        paddingBottom: '21.0%',
                        overflow: 'hidden',
                        borderRadius: '4px',
                        background: '#fff',
                        border: '1px solid #ddd'
                    }}>
                        {student.fotoUrl ? (
                            <img
                                src={student.fotoUrl}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', color: '#ccc'
                            }}>FOTO</div>
                        )}
                    </div>

                    {/* NAME */}
                    <div className="card-name" style={{
                        position: 'absolute',
                        top: '40.6%',
                        left: '46.0%',
                        right: '5%',
                        fontWeight: '900',
                        color: '#00a63a',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {formatName(student.nome)}
                    </div>

                    {/* COTA */}
                    <div className="card-field" style={{
                        position: 'absolute',
                        top: '47.7%',
                        left: '52.5%',
                        fontWeight: '800',
                        color: '#333'
                    }}>
                        {numeroCota || '-'}
                    </div>

                    {/* CPF */}
                    <div className="card-field" style={{
                        position: 'absolute',
                        top: '57.25%',
                        left: '43.0%',
                        fontWeight: '800',
                        color: '#333'
                    }}>
                        {student.cpf || '-'}
                    </div>

                    {/* BIRTH DATE */}
                    <div className="card-field" style={{
                        position: 'absolute',
                        top: '66.3%',
                        left: '68.0%',
                        fontWeight: '800',
                        color: '#333'
                    }}>
                        {student.dataNascimento || '-'}
                    </div>

                    {/* MODALIDADE */}
                    <div className="card-field" style={{
                        position: 'absolute',
                        top: '75.6%',
                        left: '55.0%',
                        right: '5%',
                        fontWeight: '800',
                        color: '#333',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {formatModalidade(modalidade)}
                    </div>

                    {/* QR CODE */}
                    {qrCodeUrl && (
                        <div className="card-qr" style={{
                            position: 'absolute',
                            top: '6.8%',
                            right: '5.4%',
                            width: '14.5%',
                            background: '#fff',
                            padding: '1px',
                            borderRadius: '2px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            lineHeight: 0
                        }}>
                            <img
                                src={qrCodeUrl}
                                alt="QR Code"
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                        </div>
                    )}
                </div>

                {/* BACK SIDE */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url(/verso-carteirinha.png)',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    userSelect: 'none',
                    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
                    border: '1px solid #0b58ba',
                    boxSizing: 'border-box',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg) translateZ(0.5px)',
                    color: '#fff',
                    padding: '3% 4%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2%'
                }}>
                    {/* Header: Logo + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
                        <img src="/escudo-futsal.svg" alt="Logo" style={{ height: 'clamp(16px, 5vw, 24px)', borderRadius: '2px' }} />
                        <span style={{ fontWeight: 'bold', fontSize: 'clamp(8px, 2.5vw, 12px)' }}>Rumo ao Esporte 2026</span>
                        <span style={{ marginLeft: 'auto', fontSize: 'clamp(6px, 1.8vw, 9px)', opacity: 0.7, textTransform: 'uppercase' }}>Responsável Financeiro</span>
                    </div>

                    {/* Name */}
                    <div style={{
                        fontSize: 'clamp(10px, 3.5vw, 16px)',
                        fontWeight: 'bold',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        {responsavel?.nome || '-'}
                    </div>

                    {/* Row: CPF + Phone */}
                    <div style={{ display: 'flex', gap: '10%', position: 'relative', zIndex: 1 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 'clamp(5px, 1.5vw, 8px)', opacity: 0.7 }}>CPF</div>
                            <div style={{ fontSize: 'clamp(7px, 2vw, 11px)', fontWeight: '600' }}>{responsavel?.cpf || '-'}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 'clamp(5px, 1.5vw, 8px)', opacity: 0.7 }}>Telefone</div>
                            <div style={{ fontSize: 'clamp(7px, 2vw, 11px)', fontWeight: '600' }}>{responsavel?.telefonePrincipal || responsavel?.telefone || '-'}</div>
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 'clamp(5px, 1.5vw, 8px)', opacity: 0.7 }}>Email</div>
                        <div style={{ fontSize: 'clamp(7px, 2vw, 11px)', fontWeight: '600', wordBreak: 'break-all' }}>
                            {responsavel?.email || '-'}
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 'clamp(5px, 1.5vw, 8px)', opacity: 0.7 }}>Endereço</div>
                        <div style={{
                            fontSize: 'clamp(6px, 1.8vw, 10px)',
                            fontWeight: '500',
                            wordBreak: 'break-word',
                            lineHeight: '1.25'
                        }}>
                            {formatAddress()}
                        </div>
                    </div>
                    <img
                        src="/escudo-futsal.svg"
                        alt="Logo Real"
                        style={{
                            position: 'absolute',
                            right: '6.5%',
                            bottom: '11%',
                            width: '17%',
                            height: 'auto',
                            objectFit: 'contain',
                            zIndex: 1
                        }}
                    />
                </div>
            </div>

            {/* FLIP BUTTON */}
            <button
                type="button"
                aria-pressed={isFlipped}
                aria-label={isFlipped ? 'Ver frente da carteirinha' : 'Ver verso da carteirinha'}
                onClick={() => setIsFlipped(!isFlipped)}
                style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    background: isFlipped ? '#00a63a' : '#f5f5f5',
                    color: isFlipped ? '#fff' : '#555',
                    border: isFlipped ? 'none' : '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                {isFlipped ? 'Ver Frente' : 'Ver Verso'}
            </button>

            {/* Responsive CSS */}
            <style>{`
                .flip-card-inner {
                    transform-box: border-box;
                }
                .student-card-container .card-name {
                    font-size: clamp(7px, 3.5cqw, 14px);
                }
                .student-card-container .card-field {
                    font-size: clamp(6px, 3cqw, 12px);
                }
                @media (prefers-reduced-motion: reduce) {
                    .flip-card-inner {
                        transition-duration: 0.01ms !important;
                    }
                }
                @media (max-width: 480px) {
                    .student-card-container .card-name {
                         font-size: clamp(8px, 4vw, 12px);
                    }
                     .student-card-container .card-field {
                         font-size: clamp(7px, 3.5vw, 10px);
                    }
                }
            `}</style>
        </div>
    );
};

export default StudentCard;
