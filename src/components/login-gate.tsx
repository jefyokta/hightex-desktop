import { Cloud } from "lucide-react"
import { Button } from "./ui/button"
import { useOnline } from "@/hooks/use-online"
import { useAuthModal } from "@/context/auth-modal-context"

export const LoginGate = () => {
    const online = useOnline()
    const { openLogin } = useAuthModal()
    return <section className="mx-auto max-w-xl rounded-2xl bg-neutral-50 p-8 text-center dark:bg-neutral-900">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Cloud className="size-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Dokumenmu, kapan saja</h1>
        <p className="mt-2 text-sm text-muted-foreground">
            Masuk untuk menyimpan dokumen ke cloud dan mengambilnya lagi nanti.
        </p>
        <Button className="mt-5" onClick={openLogin} disabled={!online}>
            Masuk
        </Button>
        {!online && (
            <p className="mt-3 text-xs text-muted-foreground">
                Sambungkan ke internet untuk masuk.
            </p>
        )}
    </section>
}