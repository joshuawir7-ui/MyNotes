"use client";

import { useLocalUrl } from "@/hooks/use-local-url";
import React, { useState, useEffect, useRef } from "react";

interface LocalImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | null;
    fallback?: React.ReactNode;
}

export function LocalImage({ src, alt = "", className, fallback, ...props }: LocalImageProps) {
    const [isNearViewport, setIsNearViewport] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === 'undefined') {
            setIsNearViewport(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [src]);

    // Only invoke useLocalUrl when image is near or within the viewport
    const resolvedUrl = useLocalUrl(isNearViewport ? src : null);
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

    return (
        <div ref={containerRef} className="w-full h-full">
            {hasError ? (
                (src && src !== effectiveSrc && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) ? (
                    <img
                        src={src}
                        alt={alt}
                        decoding="async"
                        loading={props.loading || "lazy"}
                        className={className}
                        {...props}
                    />
                ) : (
                    fallback ? <>{fallback}</> : null
                )
            ) : !effectiveSrc ? (
                fallback ? <>{fallback}</> : (
                    <div className={`animate-pulse bg-zinc-300/20 dark:bg-zinc-800/20 ${className || 'w-full h-48 rounded-xl'}`} />
                )
            ) : (
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
            )}
        </div>
    );
}
