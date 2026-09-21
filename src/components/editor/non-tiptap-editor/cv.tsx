import { Paper } from "@/components/paper"
import { ShouldNotified } from "@/exception/interfaces/should-notified"
import {
    Alert,
    AlertAction,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toWebPBlob } from "@/utils/images-to-webp"

const CV_NOTICE_KEY = "cv-notice-dismissed"

export const Cv = () => {
    const [showNotice, setShowNotice] = useState(false)

    const contentRef = useRef<HTMLDivElement>(null)
    const pictureRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setShowNotice(localStorage.getItem(CV_NOTICE_KEY) !== "true")
    }, [])

    useEffect(() => {
        const load = async () => {
            const profile = await window.profile.get()

            if (contentRef.current) {
                contentRef.current.innerHTML = profile.cv
            }

            const picture = await window.profile.picture()

            if (!picture || !pictureRef.current) {
                return
            }

            const blob = new Blob([new Uint8Array(picture)], {
                type: "image/webp",
            })

            const url = URL.createObjectURL(blob)

            pictureRef.current.innerHTML = `
                <img
                    src="${url}"
                    alt="Profile"
                    class="w-full h-full object-cover"
                />
            `
        }

        load()
    }, [])

    const dismissNotice = () => {
        localStorage.setItem(CV_NOTICE_KEY, "true")
        setShowNotice(false)
    }

    const handleInput = async (
        event: React.FormEvent<HTMLDivElement>,
    ) => {
        await window.profile.set({
            cv: event.currentTarget.innerHTML,
        })
    }

    const openPicturePicker = () => {
        inputRef.current?.click()
    }

    const handlePictureChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0]

        if (!file) {
            return
        }

        if (!file.type.startsWith("image/")) {
            throw new ShouldNotified({
                message: "Invalid profile picture",
                description: "Please select an image file.",
            })
        }


        // const buffer = await file.arrayBuffer()
        const buffer = await (await toWebPBlob(file)).arrayBuffer()
        const bytes = new Uint8Array(buffer)

        await window.profile.setPicture(bytes)

        if (!pictureRef.current) {
            return
        }

        const url = URL.createObjectURL(file)

        pictureRef.current.innerHTML = `
            <img
                src="${url}"
                alt="Profile"
                class="w-full h-full object-cover"
            />
        `

        event.target.value = ""
    }

    return (
        <>
            {showNotice && (
                <Alert className="my-2 w-[21cm] border-amber-200/80 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                    <Info className="text-amber-600 dark:text-amber-400" />

                    <AlertTitle className="text-amber-900 dark:text-amber-100">
                        This CV belongs to your profile
                    </AlertTitle>

                    <AlertDescription className="text-amber-800/80 dark:text-amber-200/80">
                        This CV is part of your profile and will not be included when
                        exporting a document to a HighTex file. All documents will use the
                        same CV.
                    </AlertDescription>

                    <AlertAction>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
                            onClick={dismissNotice}
                        >
                            <span aria-hidden="true">×</span>
                            <span className="sr-only">Dismiss notification</span>
                        </Button>
                    </AlertAction>
                </Alert>
            )}

            <Paper strictHeight={true} className="text-justify">
                <div className="w-full h-full border">
                    <h1 className="text-[14pt] font-bold text-center mb-[16pt]">
                        DAFTAR RIWAYAT HIDUP
                    </h1>

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePictureChange}
                    />

                    <div
                        ref={pictureRef}
                        onClick={openPicturePicker}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {
                                event.preventDefault()
                                openPicturePicker()
                            }
                        }}
                        style={{
                            fontFamily: '"Geist Variable", sans-serif',
                        }}
                        className="float-left flex w-[3cm] h-[4cm] mr-[10pt] mb-[5pt] cursor-pointer items-center justify-center border border-dashed text-center text-xs text-muted-foreground transition hover:bg-muted/50"
                    >
                        <div>
                            <span>Your pretty</span>
                            <br />
                            <b>3×4</b>
                            <br />
                            picture here
                        </div>
                    </div>

                    <div
                        ref={contentRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="outline-0"
                        onKeyDown={(event) => {
                            if (event.key !== "Enter") {
                                return
                            }

                            event.preventDefault()

                            throw new ShouldNotified({
                                message: "Cannot create a new paragraph",
                                description:
                                    "The Curriculum Vitae content must be written as a single paragraph.",
                            })
                        }}
                        onInput={handleInput}
                    />
                </div>
            </Paper>
        </>
    )
}