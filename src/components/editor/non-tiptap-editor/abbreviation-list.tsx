
import { Paper } from "@/components/paper"
import { Button } from "@/components/ui/button"
import { Document } from "@/editor/document"
import { HighTexDB } from "@/editor/storage/hightex-db"
import { X } from "lucide-react"
import React, { useEffect, useState } from "react"

type Abbrevation = Omit<Alias, "documentId">

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

            <div className="relative mt-6">
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: "6.5cm .5cm 7cm",
                        width: "14cm !important"
                    }}
                >
                    {abbrevations.map((item) => (
                        <React.Fragment key={item.key}>
                            <div className="text-elipsis">
                                {item.key}
                            </div>

                            <div>:</div>

                            <div className="relative">{item.value}
                                <Button
                                onClick={()=>{
                                    removeAbbrevation(item)
                                }}
                                    className="absolute -right-10 z-10 top-0 w-5 h-5 rounded-full"
                                    variant={'destructive'}
                                    ><X className="w-1" width={'16'} height={'16'}/></Button>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

            </div>

            <div className="mt-6 flex items-center gap-2">
                <input
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="API"
                    className="w-32 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />

                <span className="text-muted-foreground">
                    =
                </span>

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
