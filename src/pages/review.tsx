import { ShouldNavigated } from "@/exception/interfaces/should-navigated"
import { useUser } from "@/hooks/use-user"
import { useState } from "react"

export const Review = () => {

    

    const [submissions] = useState([])
    const {user} = useUser()
    if(!user) throw new ShouldNavigated("Login required","/dashboard")
    return <>
    {submissions.length == 0 && <>no submssion to be reviwed</>}
    </>

}