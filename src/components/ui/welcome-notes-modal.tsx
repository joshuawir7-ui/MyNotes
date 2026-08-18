import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useRef } from "react"
export function WelcomeNotesModal() {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const hasShown = localStorage.getItem('mynotes_welcome_notes_shown');
        if (!hasShown) {
            setIsOpen(true);
            localStorage.setItem('mynotes_welcome_notes_shown', 'true');
        }

        const handleOpenEvent = () => setIsOpen(true);
        window.addEventListener('openWelcomeNotesModal', handleOpenEvent);
        return () => window.removeEventListener('openWelcomeNotesModal', handleOpenEvent);
    }, []);

    const onClose = () => setIsOpen(false);

    useEffect(() => {
        if (!isOpen) return;
        
        const updateCardScale = () => {
            if (wrapperRef.current && cardRef.current) {
                const scale = wrapperRef.current.offsetWidth / 876;
                cardRef.current.style.transform = `scale(${scale})`;
            }
        };

        updateCardScale();
        window.addEventListener('resize', updateCardScale);
        window.addEventListener('orientationchange', updateCardScale);
        return () => {
            window.removeEventListener('resize', updateCardScale);
            window.removeEventListener('orientationchange', updateCardScale);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            >
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&display=swap');
                    .font-handwriting {
                        font-family: 'Dancing Script', cursive;
                    }
                `}</style>
                <motion.div 
                    ref={wrapperRef}
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="w-full relative overflow-hidden flex-shrink-0" 
                    style={{ aspectRatio: '876 / 494', maxWidth: '876px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        ref={cardRef}
                        className="bg-white dark:bg-[#121212] rounded-[32px] px-[48px] py-[40px] flex flex-row w-[876px] h-[494px] absolute top-0 left-0 shadow-[0_20px_60px_rgba(0,0,0,0.15)] items-stretch border border-zinc-100 dark:border-zinc-800 gap-[48px] overflow-hidden origin-top-left"
                    >
                        <div className="w-[56%] flex-shrink-0 flex flex-col justify-between relative h-full gap-[24px]">
                        <div>
                            {/* The elegant 'n' logo */}
                            <div className="text-[100px] font-handwriting text-black dark:text-white leading-none pb-0 pl-2">
                                n
                            </div>
                            {/* Thin horizontal line */}
                            <div className="h-[1.5px] bg-black/90 dark:bg-white/60 w-full max-w-[95%] mb-4 mt-2" /> 
                            
                            <p className="text-[18px] font-normal text-zinc-800 dark:text-zinc-200 leading-[1.4] max-w-[380px] tracking-tight">
                                Ten tus notas a la mano, en cualquier momento, con <span className="font-bold text-black dark:text-white">MyNotes!</span>
                            </p>
                        </div>

                        {/* Bottom section of left column */}
                        <div className="flex flex-row items-start mt-auto gap-[16px] relative w-full">
                            <div className="w-[165px] flex-shrink-0 aspect-[4/5] rounded-[16px] overflow-hidden shadow-sm dark:border dark:border-white/10">
                                <img 
                                    src="/images/orig_pedestals.jpg" 
                                    alt="Pedestals" 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                            
                            {/* Center Hand-drawn elements */}
                            <div className="flex-1 flex flex-col items-start relative mt-2 gap-[8px]">
                                <div className="absolute -top-8 -left-4">
                                    {/* Action lines pointing to Saturn text */}
                                    <svg width="35" height="35" viewBox="0 0 40 40" className="opacity-80 dark:opacity-60">
                                        <path d="M10,20 L22,25 M15,10 L25,20 M5,30 L20,30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-black dark:text-white" />
                                    </svg>
                                </div>
                                
                                <div className="font-handwriting text-[32px] font-bold text-black dark:text-white leading-none">Saturn!</div>
                                <div className="font-handwriting text-[18px] text-black dark:text-white max-w-[220px] leading-[1.4] relative pl-3">
                                    <div className="absolute left-0 top-1 bottom-1 w-[1.5px] bg-black/80 dark:bg-white/60"></div>
                                    <span>It's the hugest planet in the solar system</span>
                                </div>
                                
                                {/* Curly scribble */}
                                <svg width="80" height="30" viewBox="0 0 140 60" className="mt-3 ml-2 opacity-90 dark:opacity-70">
                                    <path d="M10,40 C20,10 30,10 40,40 C50,60 60,60 70,30 C80,10 90,10 100,40 C110,60 120,60 130,40" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" className="text-black dark:text-white" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="w-[34%] flex-shrink-0 bg-black rounded-[24px] overflow-hidden flex items-center justify-center relative h-full dark:border dark:border-zinc-800">
                        <img 
                            src="/images/orig_jupiter.jpg" 
                            alt="Jupiter" 
                            className="w-full h-full object-contain" 
                        />
                    </div>
                </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
