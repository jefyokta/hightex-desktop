export {};

declare global {
  type CanExpose = {
    exposed: true;
    ip: string;
  };

  type CannotExpose = {
    exposed: false;
    reason: string;
  };

  type ExposeStatus = CanExpose | CannotExpose;

  interface WifiInformation {
    ssid: string;
    bssid?: string | null;
    security: string | null;
    signal: string | number | null;
    channel: string | null;
  }

  interface WifiInterface {
    scan(): Promise<WifiInformation[]>;
    getCurrent(): Promise<WifiInformation | null>;
    connect(ssid: string, password?: string): Promise<WifiInformation | null>;
  }

  interface SPAirportNetwork {
    _name: string;
    spairport_security_mode?: string;
    spairport_signal_noise?: string | number;
    spairport_network_channel?: string;
  }

  interface SPAirportInterface {
    _name: string;
    spairport_wireless_mac_address?: string;
    spairport_current_network_information?: SPAirportNetwork;
    spairport_airport_other_local_wireless_networks?: SPAirportNetwork[];
  }

  interface SPAirportCommandResult {
    SPAirPortDataType: Array<{
      spairport_airport_interfaces?: SPAirportInterface[];
    }>;
  }
}
