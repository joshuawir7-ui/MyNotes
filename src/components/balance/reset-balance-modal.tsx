"use client"

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ResetBalanceModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    language?: string
}

export function ResetBalanceModal({
    isOpen,
    onClose,
    onConfirm,
    language = 'es'
}: ResetBalanceModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="reset-balance-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        key="reset-balance-modal"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-[340px] sm:max-w-[370px] bg-white dark:bg-[#121212] rounded-[44px] px-7 py-8 sm:px-9 sm:py-9 shadow-2xl border border-black/5 dark:border-white/10 flex flex-col items-center text-center select-none"
                    >
                        {/* Icon: Big thick circular reset arrow */}
                        <div className="flex justify-center items-center text-black dark:text-white mb-2">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-8 h-8 sm:w-9 sm:h-9 text-black dark:text-white"
                            >
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                            </svg>
                        </div>

                        {/* Divider Line */}
                        <div className="w-[82%] h-[1.5px] bg-black dark:bg-white rounded-full mb-3 mt-1" />

                        {/* Title in Dancing Script font */}
                        <h3 className="font-dancing text-lg sm:text-xl font-bold text-black dark:text-white mb-2.5 leading-tight">
                            {language === 'es' ? '¿Reiniciar Balance?' : 'Reset balance?'}
                        </h3>

                        {/* Body Text */}
                        <p className="text-black dark:text-white text-xs sm:text-sm leading-relaxed mb-6 font-medium max-w-[280px]">
                            {language === 'es' ? (
                                <>
                                    Tu balance actual volverá a 0$, ¿seguro?
                                    <br />
                                    Siguieras conservando el historial, esta{" "}
                                    <span className="font-bold">
                                        acción es recomendable para volver a contar tu cantidad total de dinero.
                                    </span>
                                </>
                            ) : (
                                <>
                                    Your current balance will return to $0, are you sure?
                                    <br />
                                    You will still keep the history, this{" "}
                                    <span className="font-bold">
                                        action is recommended to recount your total amount of money.
                                    </span>
                                </>
                            )}
                        </p>

                        {/* Buttons Stack */}
                        <div className="flex flex-col gap-3.5 w-full items-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-[170px] sm:w-[190px] py-2.5 rounded-xl bg-[#D9D9D9] dark:bg-[#3A3A3A] text-white font-bold text-sm sm:text-base hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="w-[170px] sm:w-[190px] py-2.5 rounded-xl bg-[#3A3A3A] dark:bg-[#D9D9D9] text-white dark:text-[#18181b] font-bold text-sm sm:text-base hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                            >
                                {language === 'es' ? 'Reiniciar' : 'Reset'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
