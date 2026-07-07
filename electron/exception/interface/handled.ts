export class Handled<T = void> extends Error {
    public name = this.constructor.name

    //@ts-ignore
    handle():T{ }
}