"use client";

import { useLocalUrl } from "@/hooks/use-local-url";
import { Capacitor } from "@capacitor/core";
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

    const effectiveSrc = (resolvedUrl && !resolvedUrl.startsWith('indexeddb://') && !resolvedUrl.startsWith('drive://'))
        ? resolvedUrl
        : (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')) ? src : '');

    if (!src) {
        if (fallback) return <>{fallback}</>;
        return null;
    }

    // Foreign-platform local URIs (e.g. Android file:// viewed on Web before the phone uploads it to Drive,
    // or Web indexeddb:// viewed on Android) cannot resolve locally until synced as drive://<id>
    const isForeignLocalUri = typeof window !== 'undefined' && (
        (!Capacitor.isNativePlatform() && (src.startsWith('file://') || src.startsWith('/data/') || src.startsWith('content://'))) ||
        (Capacitor.isNativePlatform() && src.startsWith('indexeddb://'))
    );
    if (isForeignLocalUri && !effectiveSrc) {
        if (fallback) return <>{fallback}</>;
        return null;
    }

    if (hasError) {
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
        return <div className={`min-h-[80px] rounded-xl animate-pulse bg-zinc-300/20 dark:bg-zinc-800/20 ${className || ''}`} />;
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
