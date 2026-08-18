import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex flex-col items-center justify-center py-12 px-4 select-none">
      {/* Top glowing progress line relative to the main container */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 overflow-hidden rounded-full opacity-80">
        <div className="w-full h-full bg-primary/30 animate-loading-bar" />
      </div>

      {/* Glassmorphic spinner card */}
      <div className="glass-panel p-8 rounded-3xl flex flex-col items-center gap-4 relative overflow-hidden max-w-xs text-center border-primary/20 w-full shadow-2xl animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-purple-500/5 pointer-events-none" />
        
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary border border-primary/20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping opacity-25" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight font-dancing text-foreground">MyNotes</h2>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Cargando apartado...
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
