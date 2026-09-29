"use client";

import { useLocalUrl } from "@/hooks/use-local-url";
import React, { useState, useEffect } from "react";

interface LocalImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | null;
    fallback?: React.ReactNode;
}

export function LocalImage({ src, alt = "", className, fallback, ...props }: LocalImageProps) {
    const resolvedUrl = useLocalUrl(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [src, resolvedUrl]);

    // Use resolvedUrl if valid, or fallback to src if src is a direct base64/http/blob URL
    const effectiveSrc = (resolvedUrl && !resolvedUrl.startsWith('indexeddb://'))
        ? resolvedUrl
        : (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')) ? src : '');

    if (!src) {
        if (fallback) return <>{fallback}</>;
        return null;
    }

    if (hasError) {
        // If effectiveSrc failed but original src is a valid data/http URL, try src
        if (src && src !== effectiveSrc && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
            return (
                <img
                    src={src}
                    alt={alt}
                    decoding="async"
                    loading={props.loading || "lazy"}
                    className={className}
                    {...props}
                />
            );
        }
        if (fallback) return <>{fallback}</>;
        return null;
    }

    if (!effectiveSrc) {
        if (fallback) return <>{fallback}</>;
        return <div className={`animate-pulse bg-zinc-300/20 dark:bg-zinc-800/20 ${className || ''}`} />;
    }

    return (
        <img
            src={effectiveSrc}
            alt={alt}
            decoding="async"
            loading={props.loading || "lazy"}
            className={className}
            onError={(e) => {
                setHasError(true);
                props.onError?.(e);
            }}
            {...props}
        />
    );
}
