// midi selector component

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, Music } from "lucide-react";

interface Device {
  id?: number;
  path?: string;
  name?: string;
  type?: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
}

interface MIDISelectorProps {
  devices: Device[];
  selectedInputDevice: Device | null;
  selectedOutputDevice: Device | null;
  onDeviceSelect: (inputDevice: Device, outputDevice?: Device) => void;
  onRefresh: () => void;
  connected: boolean;
}

const MIDISelector: React.FC<MIDISelectorProps> = ({
  devices,
  selectedInputDevice,
  selectedOutputDevice,
  onDeviceSelect,
  onRefresh,
  connected,
}) => {
  const inputDevices = devices.filter((device) => device.type === "input");
  const outputDevices = devices.filter((device) => device.type === "output");

  const handleInputDeviceSelect = (device: Device) => {
    // For MIDI, we need both input and output devices
    // Try to find a matching output device for APC mini mk2
    let outputDevice: Device | undefined = undefined;
    if (device.name?.includes("APC mini mk2 Control")) {
      outputDevice = outputDevices.find((d) =>
        d.name?.includes("APC mini mk2 Control")
      );
    }
    onDeviceSelect(device, outputDevice);
  };

  const handleOutputDeviceSelect = (device: Device) => {
    // For output device selection, keep the current input device
    if (selectedInputDevice) {
      onDeviceSelect(selectedInputDevice, device);
    } else {
      onDeviceSelect(device, device);
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Music className="h-5 w-5 text-blue-400" />
            MIDI Controller
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
      <CardContent className="space-y-4">
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-2">
            Input Devices
          </div>
          <div className="max-h-32 overflow-y-auto border border-white/10 rounded-md bg-black/20">
            {inputDevices.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No MIDI input devices found
              </div>
            ) : (
              inputDevices.map((device) => (
                <div
                  key={device.id}
                  className={`p-3 cursor-pointer border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/10 ${
                    selectedInputDevice?.id === device.id
                      ? "bg-blue-500/20 border-l-4 border-blue-400"
                      : ""
                  }`}
                  onClick={() => handleInputDeviceSelect(device)}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-white">
                      {device.name || `MIDI Input ${device.id}`}
                    </div>
                    {selectedInputDevice?.id === device.id && (
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

        <div>
          <div className="font-semibold text-xs text-gray-400 mb-2">
            Output Devices
          </div>
          <div className="max-h-32 overflow-y-auto border border-white/10 rounded-md bg-black/20">
            {outputDevices.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No MIDI output devices found
              </div>
            ) : (
              outputDevices.map((device) => (
                <div
                  key={device.id}
                  className={`p-3 cursor-pointer border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/10 ${
                    selectedOutputDevice?.id === device.id
                      ? "bg-blue-500/20 border-l-4 border-blue-400"
                      : ""
                  }`}
                  onClick={() => handleOutputDeviceSelect(device)}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-white">
                      {device.name || `MIDI Output ${device.id}`}
                    </div>
                    {selectedOutputDevice?.id === device.id && (
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

        {selectedInputDevice && (
          <div className="text-xs text-gray-400">
            <div>Selected Input: {selectedInputDevice.name}</div>
            {selectedOutputDevice && (
              <div>Selected Output: {selectedOutputDevice.name}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MIDISelector;
