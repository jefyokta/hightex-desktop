import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { PDFService } from "./pdf-service";

export class CLIService {
  constructor(
    private readonly args: string[],
    //@ts-ignore
    private window:BrowserWindow|null
  ) {}

  async handle() {
    const [command, ...args] = this.args.filter((ar)=>ar !== '--no-sanbox');

    switch (command) {
      case "compile":
        await this.compile(args);
        break;

      case "version":
      case "-v":
      case "--version":
        console.log(app.getVersion());
        break;

      default:
        return;
    }
  }

  private async documents(){
    
  }

  private async compile([id, saveTo]: string[]) {
    if (!id) {
      throw new Error("Missing document id.");
    }

    const pdf = new PDFService();

    const buffer = await pdf.generate(id, (message, percent) => {
      console.log(`${percent}% ${message}`);
    });

    const output =
      saveTo ??
      join(app.getPath("downloads"), `${id}.pdf`);

    writeFileSync(output, buffer);

    console.log(`Saved to ${output}`);
  }
}