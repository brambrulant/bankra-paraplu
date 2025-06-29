import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Music } from "lucide-react";
import MIDISelector from "./components/midi-selector";
import WLEDSelector from "./components/wled-selector";
import LEDVisualization from "./components/LEDVisualization";
import ConnectionStatus from "./components/ConnectionStatus";
import MIDIEventLog from "./components/MIDIEventLog";

interface Device {
  id?: number;
  name?: string;
  type?: string;
}

interface WLEDState {
  on: boolean;
  bri: number;
  preset: number;
  dominantColor: number[];
}

interface MIDIEvent {
  status: number;
  note: number;
  velocity: number;
  deltaTime: number;
  timestamp: number;
}

function App() {
  const [midiDevices, setMidiDevices] = useState<Device[]>([]);
  const [selectedMidiInputDevice, setSelectedMidiInputDevice] =
    useState<Device | null>(null);
  const [selectedMidiOutputDevice, setSelectedMidiOutputDevice] =
    useState<Device | null>(null);
  const [midiConnected, setMidiConnected] = useState(false);
  const [artnetConnected, setArtnetConnected] = useState(false);
  const [wledState, setWledState] = useState<WLEDState>({
    on: false,
    bri: 255,
    preset: 1,
    dominantColor: [255, 255, 255],
  });
  const [midiEvents, setMidiEvents] = useState<MIDIEvent[]>([]);
  const [connectionError, setConnectionError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket("ws://localhost:3002");
    wsRef.current = ws;

    ws.onopen = () => {
      // Request device refresh
      ws.send(JSON.stringify({ type: "refresh_devices" }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "initial_state":
            setMidiDevices(data.data.midiDevices || []);
            setWledState(data.data.wledState || wledState);
            break;

          case "devices_updated":
            setMidiDevices(data.data.midiDevices || []);
            break;

          case "midi_connected":
            setMidiConnected(true);
            if (data.inputDevice) setSelectedMidiInputDevice(data.inputDevice);
            if (data.outputDevice)
              setSelectedMidiOutputDevice(data.outputDevice);
            break;

          case "midi_disconnected":
            setMidiConnected(false);
            setSelectedMidiInputDevice(null);
            setSelectedMidiOutputDevice(null);
            break;
          case "midi_connection_result":
            setMidiConnected(data.success);
            if (!data.success) {
              setConnectionError("Failed to connect to MIDI device");
            } else {
              setConnectionError("");
            }
            break;

          case "artnet_connected":
            setArtnetConnected(true);
            setConnectionError("");
            break;

          case "wled_disconnected":
            setMidiConnected(false);
            break;

          case "wled_state_update":
            setWledState(data.data);
            break;

          case "midi_event": {
            const newEvent: MIDIEvent = {
              status: data.data.command << 4,
              note: data.data.note,
              velocity: data.data.velocity,
              deltaTime: 0,
              timestamp: Date.now(),
            };
            setMidiEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
            break;
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      setConnectionError("WebSocket connection error: " + error);
    };

    ws.onclose = () => {
      setConnectionError("WebSocket disconnected");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-connect logic for APC mini mk2
  const connectMidi = (inputDevice: Device, outputDevice?: Device) => {
    if (wsRef.current) {
      // If we have both input and output devices, use them
      if (
        inputDevice &&
        outputDevice &&
        inputDevice.id !== undefined &&
        outputDevice.id !== undefined
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "connect_midi",
            inputId: inputDevice.id,
            outputId: outputDevice.id,
          })
        );
        setSelectedMidiInputDevice(inputDevice);
        setSelectedMidiOutputDevice(outputDevice);
      } else if (inputDevice && inputDevice.id !== undefined) {
        // fallback: connect only the selected device as input
        wsRef.current.send(
          JSON.stringify({
            type: "connect_midi",
            deviceId: inputDevice.id,
          })
        );
        setSelectedMidiInputDevice(inputDevice);
        setSelectedMidiOutputDevice(null);
      }
    }
  };

  const connectArtnet = (host: string, universe: number) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "connect_artnet",
          host: host,
          universe: universe,
        })
      );
    }
  };

  const testArtnet = () => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "test_artnet",
        })
      );
    }
  };

  const refreshDevices = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "refresh_devices" }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              super bankra MIDI WLED controller
            </h1>
            <p className="mt-2 text-lg text-gray-300">
              checkt de verbindingen tussen de MIDI controller en
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Device Connections */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-blue-400" />
              Device Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MIDISelector
                devices={midiDevices}
                selectedInputDevice={selectedMidiInputDevice}
                selectedOutputDevice={selectedMidiOutputDevice}
                onDeviceSelect={connectMidi}
                onRefresh={refreshDevices}
                connected={midiConnected}
              />

              <WLEDSelector
                onRefresh={refreshDevices}
                connected={artnetConnected}
                onArtnetConnect={connectArtnet}
                artnetConnected={artnetConnected}
                onTestArtnet={testArtnet}
              />
            </div>

            <ConnectionStatus
              midiConnected={midiConnected}
              artnetConnected={artnetConnected}
              error={connectionError}
            />
          </CardContent>
        </Card>

        {/* LED Visualization */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
              LED Visualization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LEDVisualization wledState={wledState} connected={midiConnected} />
          </CardContent>
        </Card>

        {/* MIDI Events */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-6 w-6 text-green-400" />
              MIDI Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MIDIEventLog events={midiEvents} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
