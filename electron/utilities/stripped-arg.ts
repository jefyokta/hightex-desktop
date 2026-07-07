export class StrippedArg {
    public readonly key: string;
    public readonly value: string;
    private arg: string;

    constructor(arg: string) {
        if (!arg.startsWith("--")) {
            throw new Error("Argument is not stripped");
        }
        
        this.arg = arg;

        const cleanArg = arg.slice(2); 
        const equalsIndex = cleanArg.indexOf('=');

        if (equalsIndex !== -1) {
            this.key = cleanArg.slice(0, equalsIndex);
            let rawValue = cleanArg.slice(equalsIndex + 1);
                        if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || 
                (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
                rawValue = rawValue.slice(1, -1);
            }
            
            this.value = rawValue;
        } else {
            this.key = cleanArg;
            this.value = ''; 
        }
    }

    public toString(): string {
        return this.arg;
    }
}
