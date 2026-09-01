export interface Sponsor {
    name: string;
    logo: string;
}

// Para adicionar/remover um patrocinador: salve a logo em public/patrocinadores/
// e inclua (ou remova) uma entrada aqui.
export const sponsors: Sponsor[] = [
    { name: 'Sacolão do Valdinei', logo: '/patrocinadores/sacolao-do-valdinei.png' },
    { name: 'Wesley Construção', logo: '/patrocinadores/wesley-construcao.png' },
    { name: 'Templone Barbearia', logo: '/patrocinadores/templone-barbearia.png' },
    { name: 'Rodrigues de Carvalho Advogados', logo: '/patrocinadores/rodrigues-de-carvalho-advogados.png' },
    { name: 'G-BOL', logo: '/patrocinadores/g-bol.png' },
    { name: 'Mercado Central', logo: '/patrocinadores/mercado-central.png' },
    { name: 'Autoescola Raça', logo: '/patrocinadores/autoescola-raca.png' },
    { name: 'King Lanches', logo: '/patrocinadores/king-lanches.png' },
    { name: 'Route Coffee', logo: '/patrocinadores/route-coffee.png' },
    { name: 'A Padaria Dellacittà', logo: '/patrocinadores/a-padaria-dellacitta.png' },
];
