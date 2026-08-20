import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"
import { translations } from "@/lib/translations"
import { ChevronRight, ChevronLeft } from "lucide-react"

interface BalanceOnboardingProps {
    onClose: () => void;
}

export function BalanceOnboarding({ onClose }: BalanceOnboardingProps) {
    const [step, setStep] = useState(1);
    const [isOpen, setIsOpen] = useState(true);
    const language = useStore(state => state.language) || 'en';
    
    // Safely get translations
    const baseTranslations = (translations as any)[language] || (translations as any)['en'];
    let t = baseTranslations?.pages?.balance?.onboarding;
    
    // Fallback if not found
    if (!t) {
        t = (translations as any)['en']?.pages?.balance?.onboarding;
    }

    const wrapperRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const updateCardScale = () => {
            if (wrapperRef.current && cardRef.current) {
                const scale = wrapperRef.current.offsetWidth / 750;
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

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(onClose, 300); // match exit animation
    };

    const nextStep = () => {
        if (step < 5) setStep(step + 1);
        else handleClose();
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    if (!isOpen) return null;

    const renderCarouselContent = () => {
        switch (step) {
            case 2:
                return (
                    <div className="flex flex-row w-full h-full p-[40px] items-center gap-[40px]">
                        <div className="w-[45%] h-full flex items-center justify-center relative">
                            {/* Visual representation of Balance circle */}
                            <div className="w-[280px] h-[280px] rounded-full border-[12px] border-zinc-100 dark:border-zinc-800 relative flex items-center justify-center shadow-lg bg-white dark:bg-[#1c1c1c]">
                                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="12" className="text-black dark:text-white" strokeDasharray="276" strokeDashoffset="60" strokeLinecap="round" />
                                </svg>
                                <div className="flex flex-col items-center">
                                    <span className="text-[14px] text-zinc-500 font-medium">Balance</span>
                                    <span className="text-[32px] font-bold text-black dark:text-white">$1,250</span>
                                </div>
                                <div className="absolute top-4 -right-4 bg-white dark:bg-zinc-800 shadow-md rounded-full px-4 py-2 text-[14px] font-bold text-green-500 flex items-center gap-1 border border-zinc-100 dark:border-zinc-700">
                                    + $500
                                </div>
                                <div className="absolute bottom-4 -left-4 bg-white dark:bg-zinc-800 shadow-md rounded-full px-4 py-2 text-[14px] font-bold text-red-500 flex items-center gap-1 border border-zinc-100 dark:border-zinc-700">
                                    - $120
                                </div>
                            </div>
                        </div>
                        <div className="w-[55%] flex flex-col gap-[20px]">
                            <h3 className="text-[32px] font-bold text-black dark:text-white">{t.step2.title}</h3>
                            <p className="text-[16px] text-zinc-600 dark:text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.step2.body }} />
                            <div className="flex flex-col gap-[16px] mt-4">
                                <p className="text-[15px] text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: t.step2.meta }} />
                                <p className="text-[15px] text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: t.step2.adds }} />
                                <p className="text-[15px] text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: t.step2.spend }} />
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="flex flex-row w-full h-full p-[32px] sm:p-[40px] gap-[32px] sm:gap-[40px]">
                        <div className="w-[45%] h-full relative rounded-[20px] overflow-hidden bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center p-2">
                            <img 
                                src="/assets/onboarding/gane-screen.png" 
                                alt="Gane UI" 
                                className="h-full w-full object-contain rounded-lg" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/images/gane-screen.png'
                                }}
                            />
                        </div>
                        <div className="w-[55%] flex flex-col justify-center gap-[16px] overflow-y-auto pr-2">
                            <h3 className="text-[36px] sm:text-[40px] font-dancing font-bold text-black dark:text-white leading-tight">
                                {t.step3.title}
                            </h3>
                            <p className="text-[14px] sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: t.step3.body }} />
                            
                            <div className="space-y-3 font-sans">
                                <div>
                                    <h4 className="font-bold text-[15px] text-black dark:text-white mb-1">{t.step3.simpleTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.simpleStep1 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.simpleStep2 }} />
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[15px] text-black dark:text-white mb-1">{t.step3.descTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep1 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep2 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep3 }} />
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="flex flex-row w-full h-full p-[32px] sm:p-[40px] gap-[32px] sm:gap-[40px]">
                        <div className="w-[45%] h-full relative rounded-[20px] overflow-hidden bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center p-2">
                            <img 
                                src="/assets/onboarding/gaste-screen.png" 
                                alt="Gaste UI" 
                                className="h-full w-full object-contain rounded-lg" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/images/gaste-screen.png'
                                }}
                            />
                        </div>
                        <div className="w-[55%] flex flex-col justify-center gap-[16px] overflow-y-auto pr-2">
                            <h3 className="text-[36px] sm:text-[40px] font-dancing font-bold text-black dark:text-white leading-tight">
                                {t.step4.title}
                            </h3>
                            <p className="text-[14px] sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: t.step4.body }} />
                            
                            <div className="space-y-3 font-sans">
                                <div>
                                    <h4 className="font-bold text-[15px] text-black dark:text-white mb-1">{t.step4.simpleTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.simpleStep1 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.simpleStep2 }} />
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[15px] text-black dark:text-white mb-1">{t.step4.descTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep1 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep2 }} />
                                        <li className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep3 }} />
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="flex flex-row w-full h-full p-[32px] sm:p-[40px] gap-[32px] sm:gap-[40px] items-center">
                        <div className="w-[45%] flex-shrink-0 flex items-center justify-center h-full">
                            <img 
                                src="/assets/onboarding/archive-box.png" 
                                alt="Archive Box" 
                                className="w-[85%] max-w-[260px] object-contain shadow-none filter-none" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/images/archive-box.png'
                                }}
                            />
                        </div>
                        <div className="w-[55%] flex flex-col justify-center pr-4 sm:pr-6">
                            <h3 className="text-[36px] sm:text-[42px] font-dancing font-bold text-black dark:text-white leading-none mb-1">
                                {t.step5.title}
                            </h3>
                            <div className="h-[2px] bg-black dark:bg-white w-full max-w-[340px] mt-1.5 mb-5" />
                            <p className="text-[15px] sm:text-[16px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: t.step5.body }} />
                        </div>
                    </div>
                );
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                onClick={step === 1 ? undefined : handleClose}
            >
                <motion.div 
                    ref={wrapperRef}
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="w-full relative flex-shrink-0 flex flex-col items-center gap-4" 
                    style={{ maxWidth: '750px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Main Card Box */}
                    <div className="w-full relative overflow-hidden flex-shrink-0" style={{ aspectRatio: '750 / 440' }}>
                        <div
                            ref={cardRef}
                            className="bg-white dark:bg-[#121212] rounded-[32px] flex flex-row w-[750px] h-[440px] absolute top-0 left-0 shadow-[0_20px_60px_rgba(0,0,0,0.15)] items-stretch border border-zinc-100 dark:border-zinc-800 overflow-hidden origin-top-left"
                        >
                            {step === 1 ? (
                                // Step 1: Centered Onboarding Card (matching reference image 2)
                                <div className="flex flex-col w-full h-full px-[32px] py-[28px] sm:px-[48px] sm:py-[36px] items-center justify-center text-center overflow-y-auto">
                                    {/* Dollar Bill Image with diffuse shadow */}
                                    <div className="relative mb-3 flex-shrink-0">
                                        <img 
                                            src="/assets/onboarding/dollar-bill.png" 
                                            alt="Dollar Bill" 
                                            className="balance-onboarding-bill cursor-pointer hover:scale-105 transition-transform duration-300" 
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/images/dollar-bill.png'
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Title */}
                                    <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-black dark:text-white uppercase mb-2 leading-tight">
                                        {t.step1.title}
                                    </h2>

                                    {/* Body with Dancing Script Quote */}
                                    <div className="max-w-[660px] text-center mb-5">
                                        <p className="font-dancing text-[19px] sm:text-[22px] font-semibold text-black dark:text-white mb-2 leading-snug">
                                            {t.step1.quote || "“Quien carga su propio balde da valor a cada gota que es derramada”"}
                                        </p>
                                        <p 
                                            className="text-[13px] sm:text-[14px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans"
                                            dangerouslySetInnerHTML={{ __html: t.step1.bodyText || t.step1.body }}
                                        />
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex flex-row items-center justify-center gap-3 flex-shrink-0">
                                        <button 
                                            onClick={nextStep}
                                            className="px-7 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-[14px] hover:scale-105 transition-transform shadow-md"
                                        >
                                            {t.step1.ctaLearn}
                                        </button>
                                        <button 
                                            onClick={handleClose}
                                            className="px-7 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full font-bold text-[14px] hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            {t.step1.ctaDismiss}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Steps 2-5: Carousel
                                <div className="w-full h-full relative">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={step}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="w-full h-full"
                                        >
                                            {renderCarouselContent()}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Navigation Control Bar (Outside, Below the White Card) */}
                    {step > 1 && (
                        <div className="flex items-center justify-center gap-3 bg-white/95 dark:bg-[#1c1c1c]/95 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/20 dark:border-zinc-700/50 shadow-2xl z-30">
                            {step > 2 && (
                                <button 
                                    onClick={prevStep}
                                    className="w-[36px] h-[36px] rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                            )}

                            {/* Progress dots */}
                            <div className="flex gap-1.5 items-center px-2">
                                {[2, 3, 4, 5].map((idx) => (
                                    <div 
                                        key={idx} 
                                        className={`h-[7px] rounded-full transition-all duration-300 ${step === idx ? 'w-[22px] bg-black dark:bg-white' : 'w-[7px] bg-zinc-300 dark:bg-zinc-700'}`} 
                                    />
                                ))}
                            </div>

                            {/* Action Button (Siguiente / Entendido) */}
                            <button 
                                onClick={nextStep}
                                className="px-6 h-[38px] rounded-full bg-black dark:bg-white text-white dark:text-black font-semibold text-[13px] flex items-center gap-1.5 hover:scale-105 transition-transform shadow-md"
                            >
                                {step === 5 ? t.step5.ctaFinish : t.next}
                                {step < 5 && <ChevronRight size={16} />}
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
