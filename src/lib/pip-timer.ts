/**
 * Picture-in-Picture Manager for MyNotes Timer on Windows / Desktop Web.
 * 
 * Capabilities:
 * 1. Document Picture-in-Picture API (Chrome / Edge 116+ on Windows 10/11):
 *    Opens a true native OS always-on-top window with interactive Play/Pause & Reset buttons.
 * 2. Canvas Video Picture-in-Picture Fallback (Firefox / Safari / older Chromium):
 *    Streams a live 2D canvas of the timer to an always-on-top native OS Video PiP window.
 * 3. In-App Draggable Fallback:
 *    Renders the in-page floating glass card when PiP is unavailable or refused.
 */

import { timerEngine, useTimerStore } from "@/lib/timer-engine"

let activePipWindow: any = null
let activePipVideo: HTMLVideoElement | null = null
let activePipCanvas: HTMLCanvasElement | null = null
let activePipAnimId: number | null = null

export function isPipSupported(): boolean {
    if (typeof window === "undefined") return false
    return (
        "documentPictureInPicture" in window ||
        ("pictureInPictureEnabled" in document && document.pictureInPictureEnabled)
    )
}

export function isPipActive(): boolean {
    if (activePipWindow && !activePipWindow.closed) return true
    if (typeof document !== "undefined" && document.pictureInPictureElement) return true
    return false
}

export async function closePictureInPicture(): Promise<void> {
    if (activePipWindow && !activePipWindow.closed) {
        try {
            activePipWindow.close()
        } catch (e) {
            console.warn("[PiP] Error closing pip window:", e)
        }
        activePipWindow = null
    }

    if (typeof document !== "undefined" && document.pictureInPictureElement) {
        try {
            await document.exitPictureInPicture()
        } catch (e) {
            console.warn("[PiP] Error exiting video pip:", e)
        }
    }

    if (activePipAnimId) {
        cancelAnimationFrame(activePipAnimId)
        activePipAnimId = null
    }

    if (activePipVideo) {
        activePipVideo.pause()
        activePipVideo.srcObject = null
        activePipVideo.remove()
        activePipVideo = null
    }

    activePipCanvas = null
    timerEngine.setUIPreferences({ isFloating: false })
}

/**
 * Toggles Picture-in-Picture floating window on desktop.
 */
export async function togglePictureInPicture(): Promise<boolean> {
    if (typeof window === "undefined") return false

    // If already active, close it
    if (isPipActive()) {
        await closePictureInPicture()
        return false
    }

    // 1. PRIMARY: Document Picture-in-Picture (Native always-on-top window on Windows)
    if ("documentPictureInPicture" in window) {
        try {
            const pip = await (window as any).documentPictureInPicture.requestWindow({
                width: 280,
                height: 140,
                disallowReturnToOpener: false,
            })
            activePipWindow = pip

            // Copy CSS stylesheets
            Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((el) => {
                try {
                    pip.document.head.appendChild(el.cloneNode(true))
                } catch (_) {}
            })

            const isDark = document.documentElement.classList.contains("dark")
            pip.document.documentElement.className = isDark ? "dark" : ""
            pip.document.title = "MyNotes Focus Timer"
            pip.document.body.style.margin = "0"
            pip.document.body.style.padding = "0"
            pip.document.body.style.overflow = "hidden"
            pip.document.body.style.backgroundColor = isDark ? "#09090b" : "#f4f4f5"
            pip.document.body.style.fontFamily = "system-ui, -apple-system, sans-serif"

            // Build interactive UI directly in the PiP window DOM
            setupDocumentPipUI(pip)

            pip.addEventListener("pagehide", () => {
                activePipWindow = null
                timerEngine.setUIPreferences({ isFloating: false })
            })

            timerEngine.setUIPreferences({ isFloating: true })
            return true
        } catch (err) {
            console.warn("[PiP] Document PiP failed, trying Video PiP:", err)
        }
    }

    // 2. FALLBACK: Canvas Video Picture-in-Picture
    if (typeof document !== "undefined" && document.pictureInPictureEnabled) {
        try {
            const success = await openVideoPip()
            if (success) {
                timerEngine.setUIPreferences({ isFloating: true })
                return true
            }
        } catch (err) {
            console.warn("[PiP] Video PiP fallback failed:", err)
        }
    }

    // 3. LAST FALLBACK: In-app floating element
    const current = useTimerStore.getState().isFloating
    timerEngine.setUIPreferences({ isFloating: !current })
    return !current
}

/**
 * Sets up the interactive UI inside a Document Picture-in-Picture window.
 */
function setupDocumentPipUI(pip: any) {
    const isDark = document.documentElement.classList.contains("dark")
    const container = pip.document.createElement("div")
    container.style.cssText = `
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 12px;
        background: ${isDark ? "#0c0c0e" : "#ffffff"};
        color: ${isDark ? "#ffffff" : "#09090b"};
        user-select: none;
    `

    // Time Display
    const timeEl = pip.document.createElement("div")
    timeEl.style.cssText = `
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -1.5px;
        margin-bottom: 8px;
        color: ${isDark ? "#ffffff" : "#09090b"};
    `

    // Controls Row
    const controls = pip.document.createElement("div")
    controls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
    `

    // Play/Pause button
    const playBtn = pip.document.createElement("button")
    playBtn.style.cssText = `
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.1s, opacity 0.1s;
        background: ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"};
        color: inherit;
    `

    // Reset button
    const resetBtn = pip.document.createElement("button")
    resetBtn.style.cssText = `
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        color: ${isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"};
    `
    resetBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
        </svg>
    `
    resetBtn.title = "Reiniciar"
    resetBtn.onclick = () => timerEngine.reset()

    // Restore to App button
    const restoreBtn = pip.document.createElement("button")
    restoreBtn.style.cssText = `
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        color: ${isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"};
    `
    restoreBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
    `
    restoreBtn.title = "Volver a la app"
    restoreBtn.onclick = () => {
        window.focus()
        closePictureInPicture()
    }

    controls.appendChild(playBtn)
    controls.appendChild(resetBtn)
    controls.appendChild(restoreBtn)

    container.appendChild(timeEl)
    container.appendChild(controls)
    pip.document.body.appendChild(container)

    function updateView() {
        const state = timerEngine.getState()
        let ms = state.remainingMs
        if (state.status === "running" && state.endAt) {
            ms = Math.max(0, state.endAt - Date.now())
        }
        const totalSec = Math.ceil(ms / 1000)
        const mins = Math.floor(totalSec / 60)
        const secs = totalSec % 60
        timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

        const isRunning = state.status === "running"
        playBtn.title = isRunning ? "Pausar" : "Iniciar"
        playBtn.style.background = isRunning
            ? "rgba(245, 158, 11, 0.25)"
            : isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"
        playBtn.style.color = isRunning ? "#f59e0b" : "inherit"

        if (isRunning) {
            playBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1"/>
                    <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
            `
        } else {
            playBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            `
        }
    }

    playBtn.onclick = () => {
        const state = timerEngine.getState()
        if (state.status === "running") {
            timerEngine.pause()
        } else if (state.status === "paused") {
            timerEngine.resume()
        } else {
            timerEngine.start()
        }
        updateView()
    }

    updateView()
    const interval = setInterval(updateView, 400)
    pip.addEventListener("pagehide", () => clearInterval(interval))
}

/**
 * Fallback Video Picture-in-Picture using Canvas Stream.
 */
async function openVideoPip(): Promise<boolean> {
    const canvas = document.createElement("canvas")
    canvas.width = 300
    canvas.height = 160
    const ctx = canvas.getContext("2d")
    if (!ctx) return false

    activePipCanvas = canvas

    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.style.position = "fixed"
    video.style.top = "-9999px"
    video.style.left = "-9999px"
    video.style.opacity = "0"
    video.style.pointerEvents = "none"
    document.body.appendChild(video)
    activePipVideo = video

    function draw() {
        if (!ctx || !activePipCanvas) return
        const isDark = document.documentElement.classList.contains("dark")
        const state = timerEngine.getState()

        let ms = state.remainingMs
        if (state.status === "running" && state.endAt) {
            ms = Math.max(0, state.endAt - Date.now())
        }
        const totalSec = Math.ceil(ms / 1000)
        const mins = Math.floor(totalSec / 60)
        const secs = totalSec % 60
        const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

        // Background
        ctx.fillStyle = isDark ? "#09090b" : "#ffffff"
        ctx.fillRect(0, 0, 300, 160)

        // Title
        ctx.fillStyle = isDark ? "#a1a1aa" : "#71717a"
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("MYNOTES FOCUS TIMER", 150, 35)

        // Countdown Text
        ctx.fillStyle = isDark ? "#ffffff" : "#09090b"
        ctx.font = "bold 52px ui-monospace, Menlo, Consolas, monospace"
        ctx.fillText(formatted, 150, 95)

        // Status badge
        ctx.fillStyle = state.status === "running" ? "#22c55e" : state.status === "paused" ? "#f59e0b" : "#71717a"
        ctx.font = "bold 14px system-ui, -apple-system, sans-serif"
        const statusText = state.status === "running" ? "EN EJECUCIÓN" : state.status === "paused" ? "PAUSADO" : "FINALIZADO"
        ctx.fillText(statusText, 150, 135)

        activePipAnimId = requestAnimationFrame(() => {
            setTimeout(draw, 350)
        })
    }

    draw()

    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null
    if (!stream) return false

    video.srcObject = stream
    await video.play()
    await video.requestPictureInPicture()

    video.addEventListener("leavepictureinpicture", () => {
        closePictureInPicture()
    })

    // Setup MediaSession play/pause controls in Windows PiP bar
    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: "Focus Timer",
            artist: "MyNotes",
        })
        navigator.mediaSession.setActionHandler("play", () => timerEngine.resume())
        navigator.mediaSession.setActionHandler("pause", () => timerEngine.pause())
    }

    return true
}

