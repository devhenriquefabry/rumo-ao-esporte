import { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';

interface SignatureCanvasProps {
    onConfirm: (signatureDataUrl: string) => void;
    onClear?: () => void;
    showConfirmButton?: boolean;
    autoConfirm?: boolean;
}

export default function SignatureCanvas({ onConfirm, onClear, showConfirmButton = true, autoConfirm = false }: SignatureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

    // Use a ref to track drawing state for the non-passive event listeners
    const drawingStateRef = useRef({
        isDrawing: false,
        hasSignature: false
    });

    // Initialize canvas context
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                context.lineWidth = 2;
                context.lineCap = 'round';
                context.strokeStyle = '#000000';
                setCtx(context);
                resizeCanvas();
            }

            // ADD NON-PASSIVE TOUCH EVENT LISTENERS
            const handleTouchStart = (e: TouchEvent) => {
                e.preventDefault();
                startDrawingNative(e);
            };
            const handleTouchMove = (e: TouchEvent) => {
                e.preventDefault();
                drawNative(e);
            };
            const handleTouchEnd = (e: TouchEvent) => {
                e.preventDefault();
                stopDrawingNative();
            };

            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

            return () => {
                canvas.removeEventListener('touchstart', handleTouchStart);
                canvas.removeEventListener('touchmove', handleTouchMove);
                canvas.removeEventListener('touchend', handleTouchEnd);
            };
        }

        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas && canvas.parentElement) {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = 150; // Reduced height for compaction

            const context = canvas.getContext('2d');
            if (context) {
                context.lineWidth = 2;
                context.lineCap = 'round';
                context.strokeStyle = '#000000';
            }
        }
    };

    // Drawing functions (Native equivalents for touch)
    const startDrawingNative = (e: TouchEvent) => {
        drawingStateRef.current.isDrawing = true;
        const context = canvasRef.current?.getContext('2d');
        if (!context || !canvasRef.current) return;

        const { x, y } = getCoordinatesNative(e);
        context.beginPath();
        context.moveTo(x, y);
    };

    const drawNative = (e: TouchEvent) => {
        if (!drawingStateRef.current.isDrawing) return;
        const context = canvasRef.current?.getContext('2d');
        if (!context || !canvasRef.current) return;

        const { x, y } = getCoordinatesNative(e);
        context.lineTo(x, y);
        context.stroke();

        if (!drawingStateRef.current.hasSignature) {
            drawingStateRef.current.hasSignature = true;
            setHasSignature(true);
        }
    };

    const stopDrawingNative = () => {
        drawingStateRef.current.isDrawing = false;
        const context = canvasRef.current?.getContext('2d');
        if (context) context.closePath();
        if (autoConfirm) saveSignature();
    };

    // Drawing functions (Mouse events)
    const startDrawingMouse = (e: React.MouseEvent) => {
        drawingStateRef.current.isDrawing = true;
        if (!ctx || !canvasRef.current) return;

        const { x, y } = getCoordinatesMouse(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const drawMouse = (e: React.MouseEvent) => {
        if (!drawingStateRef.current.isDrawing || !ctx || !canvasRef.current) return;

        const { x, y } = getCoordinatesMouse(e);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (!drawingStateRef.current.hasSignature) {
            drawingStateRef.current.hasSignature = true;
            setHasSignature(true);
        }
    };

    const stopDrawingMouse = () => {
        drawingStateRef.current.isDrawing = false;
        if (ctx) ctx.closePath();
        if (autoConfirm) saveSignature();
    };

    const getCoordinatesNative = (e: TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;

        // Calculate scaling factors between internal resolution and CSS display size
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const getCoordinatesMouse = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();

        // Calculate scaling factors between internal resolution and CSS display size
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        drawingStateRef.current.hasSignature = false;
        setHasSignature(false);
        if (onClear) onClear();
    };

    const saveSignature = () => {
        if (!canvasRef.current || !drawingStateRef.current.hasSignature) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onConfirm(dataUrl);
    };

    const handleConfirm = () => saveSignature();

    return (
        <div className="signature-container" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{
                marginBottom: '10px',
                color: '#666',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8f9fa',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #eee'
            }}>
                <PenTool size={14} />
                <span>Assine abaixo (dedo ou mouse)</span>
            </div>

            <div style={{
                border: '2px dashed #ccc',
                borderRadius: '12px',
                background: '#fff',
                overflow: 'hidden',
                position: 'relative',
                touchAction: 'none' // Critical for mobile
            }}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawingMouse}
                    onMouseMove={drawMouse}
                    onMouseUp={stopDrawingMouse}
                    onMouseLeave={stopDrawingMouse}
                    style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
                />
                {!hasSignature && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#ddd',
                        pointerEvents: 'none',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        opacity: 0.4
                    }}>
                        ASSINAR AQUI
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                    type="button"
                    onClick={clearCanvas}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        color: '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.9rem'
                    }}
                >
                    <Eraser size={16} />
                    Limpar
                </button>
                {showConfirmButton && (
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!hasSignature}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: hasSignature ? '#17428f' : '#ccc',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            fontWeight: 'bold',
                            cursor: hasSignature ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '0.9rem',
                            boxShadow: hasSignature ? '0 4px 10px rgba(0, 35, 127, 0.2)' : 'none'
                        }}
                    >
                        <Check size={16} />
                        Confirmar
                    </button>
                )}
            </div>
        </div>
    );
}
