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
                    <div className="flex flex-row w-full h-full p-[40px] gap-[40px]">
                        <div className="w-[45%] h-full relative rounded-[20px] overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center">
                            <img src="/assets/onboarding/gane-screen.png" alt="Gane UI" className="h-[90%] object-contain" />
                            
                            {/* Callouts over image */}
                            <div className="absolute right-[-10px] top-[40%] flex items-center">
                                <div className="w-[80px] h-[2px] bg-black dark:bg-white border border-white dark:border-black opacity-80" />
                                <div className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-md text-[12px] font-bold whitespace-nowrap z-10 shadow-lg ml-1">
                                    {t.step3.calloutStep2}
                                </div>
                            </div>
                            <div className="absolute right-[0px] top-[60%] flex items-center">
                                <div className="w-[60px] h-[2px] bg-black dark:bg-white border border-white dark:border-black opacity-80" />
                                <div className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-md text-[12px] font-bold whitespace-nowrap z-10 shadow-lg ml-1">
                                    {t.step3.calloutStep3}
                                </div>
                            </div>
                            <div className="absolute left-[5%] bottom-[15%] max-w-[150px]">
                                <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm p-2 rounded-lg border border-black/10 dark:border-white/10 shadow-lg">
                                    <p className="text-[11px] leading-tight text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: t.step3.calloutOptional }} />
                                </div>
                            </div>
                        </div>
                        <div className="w-[55%] flex flex-col justify-center gap-[20px] overflow-y-auto">
                            <h3 className="text-[32px] font-bold text-black dark:text-white uppercase">{t.step3.title}</h3>
                            <p className="text-[15px] text-zinc-600 dark:text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.step3.body }} />
                            
                            <div className="mt-2 space-y-4">
                                <div>
                                    <h4 className="font-bold text-[16px] text-black dark:text-white mb-2">{t.step3.simpleTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.simpleStep1 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.simpleStep2 }} />
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[16px] text-black dark:text-white mb-2">{t.step3.descTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep1 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep2 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step3.descStep3 }} />
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="flex flex-row w-full h-full p-[40px] gap-[40px]">
                        <div className="w-[45%] h-full relative rounded-[20px] overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center">
                            <img src="/assets/onboarding/gaste-screen.png" alt="Gaste UI" className="h-[90%] object-contain" />
                            
                            {/* Callouts over image */}
                            <div className="absolute right-[-10px] top-[40%] flex items-center">
                                <div className="w-[80px] h-[2px] bg-black dark:bg-white border border-white dark:border-black opacity-80" />
                                <div className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-md text-[12px] font-bold whitespace-nowrap z-10 shadow-lg ml-1">
                                    {t.step3.calloutStep2}
                                </div>
                            </div>
                            <div className="absolute right-[0px] top-[60%] flex items-center">
                                <div className="w-[60px] h-[2px] bg-black dark:bg-white border border-white dark:border-black opacity-80" />
                                <div className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-md text-[12px] font-bold whitespace-nowrap z-10 shadow-lg ml-1">
                                    {t.step3.calloutStep3}
                                </div>
                            </div>
                            <div className="absolute left-[5%] bottom-[20%] max-w-[160px]">
                                <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm p-3 rounded-lg border border-black/10 dark:border-white/10 shadow-lg">
                                    <p className="text-[12px] font-bold text-black dark:text-white mb-1" dangerouslySetInnerHTML={{ __html: t.step4.calloutDate }} />
                                    <p className="text-[11px] leading-tight text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.calloutDateDesc }} />
                                </div>
                            </div>
                        </div>
                        <div className="w-[55%] flex flex-col justify-center gap-[20px] overflow-y-auto">
                            <h3 className="text-[32px] font-bold text-black dark:text-white uppercase">{t.step4.title}</h3>
                            <p className="text-[15px] text-zinc-600 dark:text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.step4.body }} />
                            
                            <div className="mt-2 space-y-4">
                                <div>
                                    <h4 className="font-bold text-[16px] text-black dark:text-white mb-2">{t.step4.simpleTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.simpleStep1 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.simpleStep2 }} />
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[16px] text-black dark:text-white mb-2">{t.step4.descTitle}</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep1 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep2 }} />
                                        <li className="text-[14px] text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: t.step4.descStep3 }} />
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="flex flex-row w-full h-full p-[40px] gap-[40px] items-center">
                        <div className="w-[45%] flex-shrink-0 flex items-center justify-center h-full">
                            <img src="/assets/onboarding/archive-box.png" alt="Archive Box" className="w-[80%] object-contain drop-shadow-2xl" />
                        </div>
                        <div className="w-[55%] flex flex-col justify-center gap-[24px]">
                            <h3 className="text-[36px] font-bold text-black dark:text-white leading-tight">{t.step5.title}</h3>
                            <p className="text-[18px] text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-[90%]" dangerouslySetInnerHTML={{ __html: t.step5.body }} />
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
                    className="w-full relative overflow-hidden flex-shrink-0" 
                    style={{ aspectRatio: '876 / 494', maxWidth: '876px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        ref={cardRef}
                        className="bg-white dark:bg-[#121212] rounded-[32px] flex flex-row w-[876px] h-[494px] absolute top-0 left-0 shadow-[0_20px_60px_rgba(0,0,0,0.15)] items-stretch border border-zinc-100 dark:border-zinc-800 overflow-hidden origin-top-left"
                    >
                        {step === 1 ? (
                            // Step 1: Gateway Card (similar to Jupiter)
                            <div className="flex flex-row w-full h-full px-[48px] py-[40px] gap-[48px]">
                                <div className="w-[56%] flex-shrink-0 flex flex-col justify-center gap-6 relative h-full">
                                    <div>
                                        <h2 className="text-[42px] font-bold tracking-tight text-black dark:text-white uppercase leading-none">
                                            {t.step1.title}
                                        </h2>
                                        <div className="h-[2px] bg-black/90 dark:bg-white/60 w-full max-w-[80%] mt-6 mb-6" /> 
                                        <p 
                                            className="text-[20px] font-normal text-zinc-800 dark:text-zinc-200 leading-[1.5] max-w-[420px]"
                                            dangerouslySetInnerHTML={{ __html: t.step1.body }}
                                        />
                                    </div>
                                    
                                    <div className="flex flex-row items-center gap-4 mt-8">
                                        <button 
                                            onClick={nextStep}
                                            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-medium hover:scale-105 transition-transform"
                                        >
                                            {t.step1.ctaLearn}
                                        </button>
                                        <button 
                                            onClick={handleClose}
                                            className="px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            {t.step1.ctaDismiss}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="w-[44%] flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 rounded-[24px] overflow-hidden flex items-center justify-center relative h-full border border-zinc-200 dark:border-zinc-800 shadow-inner">
                                    <img 
                                        src="/assets/onboarding/dollar-bill.png" 
                                        alt="Dollar Bill" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80'
                                        }}
                                    />
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

                                {/* Navigation Arrows */}
                                {step > 1 && (
                                    <div className="absolute bottom-[40px] right-[40px] flex gap-3 items-center">
                                        {step > 2 && (
                                            <button 
                                                onClick={prevStep}
                                                className="w-[44px] h-[44px] rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={nextStep}
                                            className="px-6 h-[44px] rounded-full bg-black dark:bg-white text-white dark:text-black font-medium flex items-center gap-2 hover:scale-105 transition-transform"
                                        >
                                            {step === 5 ? t.step5.ctaFinish : t.next}
                                            {step < 5 && <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                )}
                                
                                {/* Progress dots */}
                                <div className="absolute bottom-[52px] left-[40px] flex gap-2">
                                    {[2, 3, 4, 5].map((idx) => (
                                        <div 
                                            key={idx} 
                                            className={`h-[6px] rounded-full transition-all duration-300 ${step === idx ? 'w-[24px] bg-black dark:bg-white' : 'w-[6px] bg-zinc-300 dark:bg-zinc-700'}`} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
