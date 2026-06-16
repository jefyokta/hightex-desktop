import wifi from "node-wifi";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { LoggerService } from "./logger-service";
import { NetworkException } from "@main/exception/network-exception";

const execAsync = promisify(exec);

class MacosWifi implements WifiInterface {
  private sanitizeShellArg(arg: string): string {
    return arg.replace(/[^a-zA-Z0-9_\-\s./:=+@]/g, "");
  }

  private async runCommand(): Promise<SPAirportCommandResult | null> {
    try {
      const { stdout } = await execAsync(
        "system_profiler SPAirPortDataType -json",
      );
      return JSON.parse(stdout) as SPAirportCommandResult;
    } catch (error) {
      LoggerService.write(error, "MacosWifi.runCommand", "hightex-wifi.log");
      return null;
    }
  }

  private async getInterfaces(): Promise<SPAirportInterface[] | null> {
    try {
      const data = await this.runCommand();
      if (!data?.SPAirPortDataType?.[0]) return null;
      return data.SPAirPortDataType[0].spairport_airport_interfaces || null;
    } catch (error) {
      LoggerService.write(error, "MacosWifi.getInterfaces", "hightex-wifi.log");
      return null;
    }
  }

  async scan(): Promise<WifiInformation[]> {
    try {
      const interfaces = await this.getInterfaces();
      const en0 = interfaces?.find((iface) => iface._name === "en0");
      if (!en0?.spairport_airport_other_local_wireless_networks) return [];

      return en0.spairport_airport_other_local_wireless_networks.map(
        (network) =>
          this.normalizeValue({
            ssid: network._name,
            bssid: null,
            security: network.spairport_security_mode || null,
            signal: network.spairport_signal_noise || null,
            channel: network.spairport_network_channel || null,
          }),
      );
    } catch (error) {
      LoggerService.write(error, "MacosWifi.scan", "hightex-wifi.log");
      return [];
    }
  }
  normalizeValue(inf: WifiInformation): WifiInformation {
    return {
      ...inf,
      channel: inf.channel?.split(" ")[0] || null,
    };
  }
  async getCurrent(): Promise<WifiInformation | null> {
    try {
      const interfaces = await this.getInterfaces();
      const en0 = interfaces?.find((iface) => iface._name === "en0");

      if (!en0?.spairport_current_network_information?._name) {
        return null;
      }

      const current = en0.spairport_current_network_information;
      return this.normalizeValue({
        ssid: current._name,
        bssid: en0.spairport_wireless_mac_address || null,
        security: current.spairport_security_mode || null,
        signal: current.spairport_signal_noise || null,
        channel: current.spairport_network_channel || null,
      });
    } catch (error) {
      LoggerService.write(error, "MacosWifi.getCurrent", "hightex-wifi.log");
      return null;
    }
  }

  async connect(ssid: string, password = ""): Promise<WifiInformation | null> {
    try {
      const cleanSsid = this.sanitizeShellArg(ssid);
      const cleanPassword = this.sanitizeShellArg(password);
      console.log(cleanSsid);

      await execAsync(
        `networksetup -setairportnetwork en0 "${cleanSsid}" "${cleanPassword}"`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return this.getCurrent();
    } catch (error) {
      LoggerService.write(error, "MacosWifi.connect", "hightex-wifi.log");
      return null;
    }
  }
}

class NodeWifi implements WifiInterface {
  constructor() {
    wifi.init({ iface: null });
  }

  async scan(): Promise<WifiInformation[]> {
    try {
      const networks = await wifi.scan();
      return networks.map((n) => ({
        ssid: n.ssid,
        bssid: n.bssid,
        security: n.security,
        signal: n.signal_level,
        channel: String(n.channel),
      }));
    } catch (error) {
      LoggerService.write(error, "NodeWifi.scan", "hightex-wifi.log");
      return [];
    }
  }

  async getCurrent(): Promise<WifiInformation | null> {
    try {
      const connections = await wifi.getCurrentConnections();
      const current = connections[0];
      if (!current) return null;

      return {
        ssid: current.ssid,
        bssid: current.bssid,
        security: current.security || null,
        signal: current.signal_level || null,
        channel: String(current.channel),
      };
    } catch (error) {
      LoggerService.write(error, "NodeWifi.getCurrent", "hightex-wifi.log");
      return null;
    }
  }

  async connect(ssid: string, password = ""): Promise<WifiInformation | null> {
    try {
      await wifi.connect({ ssid, password });
      return this.getCurrent();
    } catch (error) {
      LoggerService.write(error, "NodeWifi.connect", "hightex-wifi.log");
      return null;
    }
  }
}

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
