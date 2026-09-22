# confirm
confirm modal return `Promise<boolean>`
ex:
```ts
const confirmed = await confirm({title:"are u sure",desc:"will execute a danger action"});
if(confirmed){
    runDangerFunction()
}
```
for method u can also use decoration/annotation
```ts

class MyClass {

    @Confrim({
        title:"are u sure",
        desc:"will delete ..."
    })
    public myDangerAction(){
        deleteSomething();
    }
}

const myClass = new MyClass;
//automatically triger confrimation
myclass.myDangerAction()

```
# ask
ask modal, retrun `Promise<string>`, and throw error `ActionCanceled`.
```ts
const name = await ask("what is your name?");
console.log(name)
```
# truncate
slice string
ex:
```ts
truncate(
    "a dynamic text that we dont know how long is it",
     5 // max chars (optional)
) //a dyna...
```

# name
auto dotted name
ex:
```ts
name("jepi okta mipa") //jepi okta mipa.
name("jepi.") //jepi.
```

# italic parser
## `<ParseItalic text=""/>`
turn string like `"_italic_"` into *italic*. react component
