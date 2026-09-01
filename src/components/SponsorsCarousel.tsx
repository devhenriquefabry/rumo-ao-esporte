import { sponsors } from '../data/sponsors';

interface SponsorsCarouselProps {
    /** 'dark' para fundos escuros (landing), 'light' para fundos claros. */
    variant?: 'dark' | 'light';
    title?: string;
}

export default function SponsorsCarousel({
    variant = 'dark',
    title = 'Nossos Patrocinadores'
}: SponsorsCarouselProps) {
    if (sponsors.length === 0) return null;

    // A faixa roda duas cópias da lista e desliza -50%: quando a primeira
    // cópia sai, a segunda está exatamente na posição inicial, então o loop
    // não tem emenda visível.
    const loop = [...sponsors, ...sponsors];

    // Ritmo constante (~3.2s por logo) para a faixa não acelerar quando
    // a lista de patrocinadores crescer.
    const duration = sponsors.length * 3.2;

    return (
        <div className={`sponsors-carousel sponsors-carousel--${variant}`}>
            <style>
                {`
                    .sponsors-carousel {
                        width: 100%;
                        margin-top: 2.25rem;
                        padding-top: 1.75rem;
                        border-top: 1px solid var(--sc-divider);
                    }
                    .sponsors-carousel--dark {
                        --sc-divider: rgba(255, 255, 255, 0.16);
                        --sc-label: rgba(255, 255, 255, 0.72);
                        --sc-tile-bg: rgba(255, 255, 255, 0.96);
                        --sc-tile-border: rgba(255, 255, 255, 0.28);
                        --sc-tile-shadow: 0 10px 24px rgba(6, 26, 64, 0.22);
                    }
                    .sponsors-carousel--light {
                        --sc-divider: rgba(23, 66, 143, 0.12);
                        --sc-label: #63708a;
                        --sc-tile-bg: #ffffff;
                        --sc-tile-border: rgba(23, 66, 143, 0.10);
                        --sc-tile-shadow: 0 6px 18px rgba(6, 26, 64, 0.10);
                    }

                    .sponsors-carousel__label {
                        margin: 0 0 1.25rem 0;
                        text-align: center;
                        color: var(--sc-label);
                        font-size: 0.72rem;
                        font-weight: 700;
                        letter-spacing: 0.18em;
                        text-transform: uppercase;
                    }

                    .sponsors-carousel__viewport {
                        overflow: hidden;
                        /* Suaviza as bordas: as logos entram e saem em fade
                           em vez de serem cortadas na reta. */
                        -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
                        mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
                    }

                    .sponsors-carousel__track {
                        display: flex;
                        width: max-content;
                        gap: 18px;
                        animation: sponsors-scroll linear infinite;
                    }

                    .sponsors-carousel__viewport:hover .sponsors-carousel__track {
                        animation-play-state: paused;
                    }

                    .sponsors-carousel__item {
                        flex: 0 0 auto;
                        width: 92px;
                        height: 92px;
                        border-radius: 16px;
                        overflow: hidden;
                        background: var(--sc-tile-bg);
                        border: 1px solid var(--sc-tile-border);
                        box-shadow: var(--sc-tile-shadow);
                    }

                    .sponsors-carousel__item img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        display: block;
                    }

                    @keyframes sponsors-scroll {
                        from { transform: translateX(0); }
                        to   { transform: translateX(-50%); }
                    }

                    @media (max-width: 768px) {
                        .sponsors-carousel {
                            margin-top: 1.75rem;
                            padding-top: 1.35rem;
                        }
                        .sponsors-carousel__item {
                            width: 74px;
                            height: 74px;
                            border-radius: 14px;
                        }
                        .sponsors-carousel__track {
                            gap: 14px;
                        }
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .sponsors-carousel__track {
                            animation: none;
                        }
                        .sponsors-carousel__viewport {
                            overflow-x: auto;
                        }
                    }
                `}
            </style>

            <p className="sponsors-carousel__label">{title}</p>

            <div className="sponsors-carousel__viewport">
                <div
                    className="sponsors-carousel__track"
                    style={{ animationDuration: `${duration}s` }}
                >
                    {loop.map((sponsor, index) => (
                        <div
                            className="sponsors-carousel__item"
                            key={`${sponsor.name}-${index}`}
                            title={sponsor.name}
                        >
                            <img
                                src={sponsor.logo}
                                alt={sponsor.name}
                                loading="lazy"
                                aria-hidden={index >= sponsors.length}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
