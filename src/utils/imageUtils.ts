export const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        console.log(`[Compression] Iniciando para: ${file.name} (${file.type}, ${file.size} bytes)`);

        // Timeout de segurança (10s)
        const items = setTimeout(() => {
            reject(new Error("Tempo limite de compressão excedido (10s)"));
        }, 10000);

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    clearTimeout(items);
                    reject(new Error("Falha ao obter contexto do Canvas 2D"));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Preserve transparency for PNGs, use JPEG for others (smaller size)
                const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const quality = outputType === 'image/jpeg' ? 0.7 : 0.8;

                canvas.toBlob((blob) => {
                    clearTimeout(items);
                    if (blob) {
                        console.log(`[Compression] Sucesso: ${blob.size} bytes (Format: ${outputType})`);
                        resolve(blob);
                    } else {
                        reject(new Error('Falha na conversão Canvas -> Blob (blob nulo)'));
                    }
                }, outputType, quality);
            };

            img.onerror = (error) => {
                clearTimeout(items);
                console.error("[Compression] Erro ao carregar imagem no objeto Image:", error);
                reject(new Error("Erro ao carregar imagem para compressão (arquivo corrompido ou formato inválido?)"));
            };
        };

        reader.onerror = (error) => {
            clearTimeout(items);
            console.error("[Compression] Erro no FileReader:", error);
            reject(new Error("Erro ao ler arquivo local"));
        };
    });
};
