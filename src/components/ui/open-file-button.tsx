import { Button } from "./button"

export const OpenFileButton = ({ title = 'open', filePath = '' }) => {


    return <Button
        onClick={async () => {
            await window.file.openPath(filePath)
        }}
    >{title}</Button>
}