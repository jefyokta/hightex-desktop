import { Document } from "@/editor/document"
import { Storage } from "@/editor/storage"
import { ShouldNotified } from "@/exception/interfaces/should-notified"
import { ParsedItalic } from "@/utils/parse-italic"
import { useEffect, useState } from "react"

type KeywordLanguage = "indonesian" | "english"


const sortKeywords = (keywords: string[]): string[] => {
    return [...keywords].sort((a, b) =>
        a.localeCompare(b, undefined, {
            sensitivity: "base",
        }),
    )
}

const useKeywords = (language: KeywordLanguage) => {
    const [keywords, setKeywords] = useState<string[]>([])
    const [draft, setDraft] = useState("")

    useEffect(() => {
        const handle = async () => {
            if (!Document.instance) {
                throw new ShouldNotified("Document hasnt created")
            }

            const document = await Storage.instance.getDocument(Document.instance.id)
            const keywords = sortKeywords(document?.keywords[language] ?? [])

            setKeywords(keywords)
        }

        handle()
    }, [language])

    const update = async (keywords: string[]) => {
        if (!Document.instance) {
            throw new ShouldNotified("Document hasnt created")
        }

        const document = await Storage.instance.getDocument(Document.instance.id)

        if (!document) {
            throw new ShouldNotified("Document not found")
        }

        await Storage.instance.setDocument({
            ...document,
            keywords: {
                ...document.keywords,
                [language]: keywords,
            },
        })
    }

    const addKeyword = async (value: string) => {
        const keyword = value.trim()

        if (!keyword || keywords.includes(keyword)) {
            setDraft("")
            return
        }

        if (keywords.length >= 5) {
            throw new ShouldNotified(`Maximum ${5} keywords allowed`)
        }

        const nextKeywords = sortKeywords([...keywords, keyword])

        setKeywords(nextKeywords)
        setDraft("")

        await update(nextKeywords)
    }

    const removeKeyword = async (keyword: string) => {
        const nextKeywords = sortKeywords(
            keywords.filter((item) => item !== keyword),
        )

        setKeywords(nextKeywords)

        await update(nextKeywords)
    }

    const handleKeyDown = async (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key !== "Enter" && event.key !== ",") return

        event.preventDefault()

        await addKeyword(draft)
    }

    return {
        keywords,
        draft,
        setDraft,
        removeKeyword,
        handleKeyDown,
    }
}

const AbstractKeyword = ({
    language,
    label,
    placeholder,
}: {
    language: KeywordLanguage
    label: string
    placeholder: string
}) => {
    const {
        keywords,
        draft,
        setDraft,
        removeKeyword,
        handleKeyDown,
    } = useKeywords(language)

    return (
        <div>
            <b>{label}: </b>

            {keywords.map((keyword, i) => (
                <span key={keyword}>
                    {language === "indonesian" ? (
                        <ParsedItalic text={keyword} />
                    ) : (
                        keyword
                    )}
                    {" "}
                    <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                    >
                        ×
                    </button>
                    {i < keywords.length - 1 ? ", " : ""}
                </span>
            ))}

            {keywords.length < 5 && (
                <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="border-0 outline-0"
                    placeholder={placeholder}
                />
            )}
        </div>
    )
}

export const AbstractDecoratorID = () => (
    <AbstractKeyword
        language="indonesian"
        label="Kata Kunci"
        placeholder="Tambah kata kunci"
    />
)

export const AbstractDecoratorEN = () => (
    <AbstractKeyword
        language="english"
        label="Keyword"
        placeholder="Add keyword"
    />
)