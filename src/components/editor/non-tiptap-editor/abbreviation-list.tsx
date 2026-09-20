
import { Paper } from "@/components/paper"
import { Document } from "@/editor/document"
import { HighTexDB } from "@/editor/storage/hightex-db"
import React, { useEffect, useState } from "react"

type Abbrevation = {
    key: string
    value: string
}

export const AbbrevationList = () => {
    const [abbrevations, setAbbrevations] = useState<Abbrevation[]>([])
    const [key, setKey] = useState("")
    const [value, setValue] = useState("")

    useEffect(() => {
        const loadAbbrevations = async () => {
            if (!Document.instance) {
                return
            }

            const documentId = Document.instance.id

            const aliases = await HighTexDB
                .getInstance()
                .getAliases(documentId)

            setAbbrevations(
                aliases.map(({ key, value }) => ({
                    key,
                    value,
                })),
            )
        }

        void loadAbbrevations()
    }, [])

    const addAbbrevation = async () => {
        const normalizedKey = key.trim()
        const normalizedValue = value.trim()

        if (!normalizedKey || !normalizedValue || !Document.instance) {
            return
        }

        const documentId = Document.instance.id

        await HighTexDB.getInstance().aliases.put({
            documentId,
            key: `${documentId}.${normalizedKey}`,
            value: normalizedValue,
        })

        setAbbrevations((current) => [
            ...current,
            {
                key: normalizedKey,
                value: normalizedValue,
            },
        ])

        setKey("")
        setValue("")
    }

    const removeAbbrevation = async (item: Abbrevation) => {
        if (!Document.instance) {
            return
        }

        const documentId = Document.instance.id

        await HighTexDB
            .getInstance()
            .aliases
            .delete(`${documentId}.${item.key}`)

        setAbbrevations((current) =>
            current.filter(
                (abbrevation) => abbrevation.key !== item.key,
            ),
        )
    }

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key !== "Enter") {
            return
        }

        event.preventDefault()
        void addAbbrevation()
    }

    return (
        <Paper>
            <h1 className="text-xl font-semibold text-center">
                DAFTAR SINGKATAN
            </h1>

            <div 
                className="mt-6 space-y-2 grid"
                style={{
                    gridTemplateColumns: "6.5cm .5cm 7cm"
                }}
            >
                {abbrevations.map((item) => (
                    <React.Fragment key={item.key}>
                        <div className="text-elipsis ">{item.key}</div>
                        <div>:</div>
                        <div>{item.value}</div>

                    </React.Fragment>

                    // <div
                    //     key={item.key}
                    //     className="flex items-center gap-4 rounded-md border px-3 py-2"
                    // >
                    //     <span className="w-32 shrink-0 font-medium">
                    //         {item.key}
                    //     </span>

                    //     <span className="flex-1 text-sm text-muted-foreground">
                    //         {item.value}
                    //     </span>

                    //     <button
                    //         type="button"
                    //         onClick={() => void removeAbbrevation(item)}
                    //         className="text-sm text-muted-foreground hover:text-foreground"
                    //     >
                    //         ×
                    //     </button>
                    // </div>
                ))}
            </div>

            <div className="mt-6 flex items-center gap-2">
                <input
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="API"
                    className="w-32 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />

                <span className="text-muted-foreground">=</span>

                <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Application Programming Interface"
                    className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
            </div>
        </Paper>
    )
}

