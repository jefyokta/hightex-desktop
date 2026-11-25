//safely accesing ipc anywhere
export const useIPC = ()=>{
    return window.parent === window ? window : window.parent
}