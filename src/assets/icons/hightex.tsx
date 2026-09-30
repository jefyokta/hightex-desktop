import { useEffect, useRef } from 'react'
import { animate, createScope, createTimeline } from 'animejs'
import { cn } from '@/lib/utils'


type Props = {
    size?: number
    replayOnClick?: boolean
    loop?: boolean
    onComplete?: () => void,
    className?: string
}

const ORDER = [
    '.hx-h-left',
    '.hx-h-bar',
    '.hx-h-right',
    '.hx-h-cap',
    '.hx-t-bar',
    '.hx-t-stem',
]

export default function HighTexLogo({
    size = 512,
    replayOnClick = true,
    loop = false,
    onComplete,
    className = ''
}: Props) {
    const rootRef = useRef<SVGSVGElement>(null)
    const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)
    const timelineRef = useRef<ReturnType<typeof createTimeline> | null>(null)

    useEffect(() => {
        if (!rootRef.current) return

        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches

        scopeRef.current = createScope({ root: rootRef }).add(() => {
            if (reduceMotion) {
                animate('.hx-frame, .hx-part', {
                    strokeDashoffset: 0,
                    fillOpacity: 1,
                    strokeWidth: 1,
                    duration: 0,
                })
                onComplete?.()
                return
            }

            const tl = createTimeline({
                defaults: { ease: 'inOutSine' },
                onComplete,
                ...(loop ? { loop: true, loopDelay: 500 } : {}),
            })

            tl.add('.hx-frame', { strokeDashoffset: [1, 0], duration: 1000 }, 0)

            ORDER.forEach((sel, i) =>
                tl.add(sel, { strokeDashoffset: [1, 0], duration: 800 }, 300 + i * 130),
            )

            ORDER.forEach((sel, i) =>
                tl.add(
                    sel,
                    { fillOpacity: [0, 1], strokeWidth: [3, 1], duration: 500, ease: 'outQuad' },
                    1600 + i * 90,
                ),
            )

            if (loop) {
                ORDER.forEach((sel, i) =>
                    tl.add(sel, { fillOpacity: [1, 0], strokeWidth: [1, 3], duration: 400, ease: 'inQuad' }, 3500 + i * 60),
                )
                ORDER.forEach((sel, i) =>
                    tl.add(sel, { strokeDashoffset: [0, -1], duration: 600 }, 4100 + i * 100),
                )
                tl.add('.hx-frame', { strokeDashoffset: [0, -1], duration: 800 }, 4300)
            }

            timelineRef.current = tl
        })

        return () => scopeRef.current?.revert()
    }, [loop])

    return (
        <svg
            ref={rootRef}
            className={cn("hx-logo", className)}
            width={size}
            height={size}
            viewBox="0 0 512 512"
            role="img"
            aria-label="HighTex"
            onClick={replayOnClick ? () => timelineRef.current?.restart() : undefined}
            style={{ cursor: replayOnClick ? 'pointer' : 'default', overflow: 'visible' }}
        >
            <rect width="512" height="512" rx="96" fill="#F8FAFC" />

            <path
                className="hx-frame"
                d="m 136,56 h 240 c 44.32,0 80,35.68 80,80 v 240 c 0,44.32 -35.68,80 -80,80 H 136 C 91.68,456 56,420.32 56,376 V 136 C 56,91.68 91.68,56 136,56 Z"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={3}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />

            <path
                className="hx-part hx-t-stem"
                d="M348.86639 203.38483h28.300369v182.46278h-28.300369z"
                fill="#6b8f71"
                fillOpacity={0}
                stroke="#6b8f71"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
            <path
                className="hx-part hx-h-bar"
                d="M230.62639 248.90343h71.58007v40.670494h-71.58007z"
                fill="#6b8f71"
                fillOpacity={0}
                stroke="#6b8f71"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
            <path
                className="hx-part hx-h-left"
                d="M158.40416 118.80312h54.102825v278.88055h-54.102825z"
                fill="#1f2937"
                fillOpacity={0}
                stroke="#000000"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
            <path
                className="hx-part hx-h-right"
                d="M299.8407 197.31348h49.640739v198.00519h-49.640739z"
                fill="#1f2937"
                fillOpacity={0}
                stroke="#000000"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
            <path
                className="hx-part hx-h-cap"
                d="M299.97147 118.71529h50.058487v31.923506h-50.058487z"
                fill="#1f2937"
                fillOpacity={0}
                stroke="#000000"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
            <path
                className="hx-part hx-t-bar"
                d="M278.9996 149.66742h151.29424v40.26379h-151.29424z"
                fill="#6b8f71"
                fillOpacity={0}
                stroke="#6b8f71"
                strokeWidth={3}
                strokeLinejoin="bevel"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
            />
        </svg>
    )
}