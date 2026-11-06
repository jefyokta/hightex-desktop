import wifi from "node-wifi";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { LoggerService } from "../service/logger-service";

const execAsync = promisify(exec);

export class MacosWifi implements WifiInterface {
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

      if (!en0?.spairport_current_network_information?._name) return null;

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

export class NodeWifi implements WifiInterface {
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
