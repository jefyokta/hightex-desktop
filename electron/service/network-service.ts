import os from "node:os";
import { NetworkException } from "@main/exception/network-exception";
import { MacosWifi, NodeWifi } from "../network/wifi-drivers";

export class NetworkService {
  private static driver: WifiInterface | null = null;

  private static getDriver(): WifiInterface {
    if (!this.driver) {
      this.tap();
    }
    return this.driver!;
  }

  private static async getCurrentNetwork(): Promise<WifiInformation | null> {
    return this.getDriver().getCurrent();
  }

  private static async scanNetworks(): Promise<WifiInformation[]> {
    return this.driver!.scan();
  }

  private static async connect(
    ssid: string,
    password = "",
  ): Promise<WifiInformation | null> {
    return this.getDriver().connect(ssid, password);
  }

  private static async isNetworkAvailable(ssid: string): Promise<boolean> {
    const networks = await this.scanNetworks();
    return networks.some((n) => n.ssid === ssid);
  }

  public static async isConnectedTo(ssid: string): Promise<boolean> {
    const current = await this.getCurrentNetwork();
    return current?.ssid === ssid;
  }

  public static getLocalIP(): string {
    const nets = os.networkInterfaces();

    for (const name of Object.keys(nets)) {
      const list = nets[name];
      if (!list) continue;

      for (const net of list) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
    return "127.0.0.1";
  }

  private static isPrivateIP(ip: string | null): boolean {
    if (!ip) return false;
    return (
      ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")
    );
  }

  public static async getCurrent(): Promise<WifiInformation | null> {
    return this.getCurrentNetwork();
  }

  public static async scan(): Promise<WifiInformation[]> {
    return this.scanNetworks();
  }

  public static async ensureConnection(ssid: string, password?: string) {
    const current = await this.getCurrentNetwork();

    if (current?.ssid === ssid) {
      return {
        changed: false,
        network: current,
      };
    }

    const available = await this.isNetworkAvailable(ssid);
    if (!available) {
      throw new NetworkException(`WiFi "${ssid}" is unreachable`);
    }

    const after = await this.connect(ssid, password);
    if (after?.ssid !== ssid) {
      console.log(after, ssid);
      throw new NetworkException("Failed connect to WiFi");
    }

    return {
      changed: true,
      network: after,
    };
  }

  public static async getLanStatus(): Promise<ExposeStatus> {
    const network = await this.getCurrentNetwork();
    const ip = this.getLocalIP();

    if (!network) {
      return {
        exposed: false,
        reason: "NO_WIFI_CONNECTION",
      };
    }

    if (!this.isPrivateIP(ip)) {
      return {
        exposed: false,
        reason: "NOT_PRIVATE_NETWORK",
      };
    }
    return {
      exposed: true,
      ip: ip!,
    };
  }

  public static tap(): void {
    if (this.driver) return;

    if (os.platform() === "darwin") {
      const releaseVersion = os.release();
      const majorVersion = parseInt(releaseVersion.split(".")[0], 10);
      if (majorVersion >= 23) {
        this.driver = new MacosWifi();
      } else {
        this.driver = new NodeWifi();
      }
    } else {
      this.driver = new NodeWifi();
    }
  }
}
