// wled selector component

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, Zap } from "lucide-react";

interface Device {
  id?: number;
  path?: string;
  name?: string;
  type?: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
}

interface WLEDSelectorProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceSelect: (device: Device) => void;
  onRefresh: () => void;
  connected: boolean;
}

const WLEDSelector: React.FC<WLEDSelectorProps> = ({
  devices,
  selectedDevice,
  onDeviceSelect,
  onRefresh,
  connected,
}) => {
  const getDeviceDisplayName = (device: Device) => {
    return `${device.path} (${device.manufacturer || "Unknown"})`;
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Zap className="h-5 w-5 text-yellow-400" />
            WLED (Serial)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-gray-300 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Badge
              variant={connected ? "default" : "secondary"}
              className={
                connected ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"
              }
            >
              {connected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-2">
            Serial Devices
          </div>
          <div className="max-h-48 overflow-y-auto border border-white/10 rounded-md bg-black/20">
            {devices.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No serial devices found
              </div>
            ) : (
              devices.map((device) => (
                <div
                  key={device.path}
                  className={`p-3 cursor-pointer border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/10 ${
                    selectedDevice?.path === device.path
                      ? "bg-blue-500/20 border-l-4 border-blue-400"
                      : ""
                  }`}
                  onClick={() => onDeviceSelect(device)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">
                        {getDeviceDisplayName(device)}
                      </div>
                      {device.serialNumber && (
                        <div className="text-xs text-gray-400">
                          S/N: {device.serialNumber}
                        </div>
                      )}
                    </div>
                    {selectedDevice?.path === device.path && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-green-500 text-white"
                      >
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedDevice && (
          <div className="text-xs text-gray-400">
            <div>Selected: {selectedDevice.path}</div>
            <div>Manufacturer: {selectedDevice.manufacturer || "Unknown"}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WLEDSelector;
