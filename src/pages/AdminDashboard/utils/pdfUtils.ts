/**
 * Converte uma URL de imagem em Base64, redimensionando-a para otimizar o PDF.
 * @param url URL da imagem
 * @param maxWidth Largura máxima para redimensionamento
 * @returns Promise com string Base64
 */
export const getBase64ImageFromURL = async (url: string, maxWidth = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Crucial para CORS
        
        // Adicionar um timestamp para evitar cache agressivo que possa vir sem headers CORS
        const cacheBusterUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Falha ao obter contexto 2D do canvas'));
                return;
            }

            // Calcular novas dimensões mantendo o aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            // Desenhar imagem no canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Converter para Base64 (JPEG para menor tamanho)
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataURL);
        };

        img.onerror = (err) => {
            console.error(`Erro ao carregar imagem: ${url}`, err);
            reject(new Error(`Erro ao carregar imagem: ${url}`));
        };

        img.src = cacheBusterUrl;
    });
};
