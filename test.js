console.log("hello")

document.addEventListener("DOMContentLoaded",()=>{
    const div =document.createElement("div")
    document.body.append(div);
    let count =0;
    setInterval(()=>{
        div.textContent = count++

    },1000)
})