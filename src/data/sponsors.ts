export interface Sponsor {
    name: string;
    logo: string;
    /** Telefone em formato internacional, só dígitos (55 + DDD + número). */
    whatsapp: string;
}

// Ordem = ordem das cotas na tabela da associação (Master primeiro).
// Para adicionar/remover um patrocinador: salve a logo em public/patrocinadores/
// e inclua (ou remova) uma entrada aqui.
export const sponsors: Sponsor[] = [
    { name: 'Padaria Dellacittà', logo: '/patrocinadores/a-padaria-dellacitta.png', whatsapp: '5533998288049' },
    { name: 'Route Coffee Corretora', logo: '/patrocinadores/route-coffee.png', whatsapp: '5533984269923' },
    { name: 'Mercado Central', logo: '/patrocinadores/mercado-central.png', whatsapp: '5533987493289' },
    { name: 'King Lanches', logo: '/patrocinadores/king-lanches.png', whatsapp: '5533984595910' },
    { name: 'Wesley Material de Construção', logo: '/patrocinadores/wesley-construcao.png', whatsapp: '5533984105250' },
    { name: 'Auto Escola Raça', logo: '/patrocinadores/autoescola-raca.png', whatsapp: '5533999601009' },
    { name: 'Impacto Performance', logo: '/patrocinadores/impacto-performance.png', whatsapp: '5533999341626' },
    { name: 'Templone Barbearia', logo: '/patrocinadores/templone-barbearia.png', whatsapp: '5533984021271' },
    { name: 'Arena G-Bol', logo: '/patrocinadores/g-bol.png', whatsapp: '5533984052123' },
    { name: 'Rodrigues de Carvalho Advogados', logo: '/patrocinadores/rodrigues-de-carvalho-advogados.png', whatsapp: '5533999988635' },
    { name: 'Sacolão do Valdinei', logo: '/patrocinadores/sacolao-do-valdinei.png', whatsapp: '5533999682084' },
];

/** Mensagem que já vai preenchida ao abrir a conversa com o patrocinador. */
export const SPONSOR_WHATSAPP_MESSAGE =
    'Olá! Cheguei até vocês pelo app do Rumo ao Esporte.';

export const sponsorWhatsappLink = (sponsor: Sponsor) =>
    `https://wa.me/${sponsor.whatsapp}?text=${encodeURIComponent(SPONSOR_WHATSAPP_MESSAGE)}`;
