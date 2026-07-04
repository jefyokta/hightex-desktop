import { StrippedArg } from "@main/utilies/stripped-arg";
import { expect, test } from "bun:test";

test("Throw error if argument is not start with `--`",()=>{

    expect(()=>{
        new StrippedArg("bad")
    }).toThrow("Argument is not stripped")
})

test("Striped arg Store key and value",()=>{
    const strp = new StrippedArg("--key=value")
    expect(strp.key).toBe("key")
    expect(strp.value).toBe("value")
})
test("Striped arg flag",()=>{
    const strp = new StrippedArg("--flag")
    expect(strp.key).toBe("flag")
    expect(strp.value).toBe("")
})
test("Striped arg with multi word value",()=>{
    const strp = new StrippedArg('--key="a value"')
    expect(strp.key).toBe("key")
    expect(strp.value).toBe("a value")
})