import { ApplicationError } from "@/exception/interfaces/application-error"
import { ShouldNotified } from "@/exception/interfaces/should-notified"
import { toast } from "sonner"

type InteractiveOptions<Args extends unknown[]> = {
    args?: Args
    successMessage?: string
}

export const executeInteractively = async <
    Args extends unknown[],
    T,
>(
    cb: (...args: Args) => T | Promise<T>,
    opt: InteractiveOptions<Args> = {},
): Promise<T> => {
    const {
        args = [] as unknown as Args,
        successMessage = "Success",
    } = opt

    try {
        const result = await cb(...args)

        toast.success(successMessage)

        return result
    } catch (error) {
        if(error instanceof ApplicationError) throw error
        throw new ShouldNotified(
            ApplicationError.normilize(error),
        )
    }
}