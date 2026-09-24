import { Manager } from "@/editor/manager";
import { AliasStorage } from "@/editor/storage/aliases";
import { useEffect } from "react";

export const AliasSlave = () => {


    useEffect(() => {
        return Manager.app.on("document:warmed", async () => {
            await AliasStorage.instance.prefetch()
        })

    }, []);

    useEffect(() => {
        return Manager.app.on("alias:deleted", ({ key }) => {
            AliasStorage.instance.del(key)
        })
    })


    return null;
}