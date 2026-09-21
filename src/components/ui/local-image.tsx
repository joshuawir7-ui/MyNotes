"use client";

import { useLocalUrl } from "@/hooks/use-local-url";
import React from "react";

interface LocalImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | null;
    fallback?: React.ReactNode;
}

export function LocalImage({ src, alt = "", className, fallback, ...props }: LocalImageProps) {
    const resolvedUrl = useLocalUrl(src);

    if (!src || !resolvedUrl || resolvedUrl.startsWith('indexeddb://')) {
        if (fallback) return <>{fallback}</>;
        return <div className={`animate-pulse bg-zinc-300/20 dark:bg-zinc-800/20 ${className || ''}`} />;
    }

    return (
        <img
            src={resolvedUrl}
            alt={alt}
            className={className}
            onError={(e) => {
                e.currentTarget.style.display = 'none';
            }}
            {...props}
        />
    );
}
