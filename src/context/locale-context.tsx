import { createContext, PropsWithChildren, useEffect, useState } from "react"

export const LocaleContext = createContext<{ locale: SupportedLanguage }>({ locale: "en" })

export const LocaleProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [locale, setLocale] = useState<SupportedLanguage>("en");

    useEffect(() => {
        return window.config?.onChange?.((c) => {

            setLocale(c.language)
        })

    })
    return <LocaleContext.Provider
        value={{ locale }}
    >
        {children}

    </LocaleContext.Provider>
}