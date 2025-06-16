import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import midi from "midi";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import axios from "axios";
import { Agent } from "undici";

const dispatcher = new Agent({
  family: 4,
});

const app = express();
const port = 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: 3002 });

// --- Loading and error state ---
let loading = true;
let error = false;

// --- MIDI Setup ---
let midiInput = new midi.Input();
let midiOutput = new midi.Output();

// --- WLED Serial Communication ---
let serialPort = null;
let wledParser = null;

let midiDevices = [];
let serialDevices = [];
let currentWledState = {
  on: false,
  bri: 255,
  ps: -1,
  seg: [{ col: [[255, 255, 255]] }],
};
let presetColors = {};

// --- APC Mini MK2 Pad Mapping ---
const APC_PAD_MAPPING = {
  // Column 1 -> Presets 1-8
  56: 1,
  48: 2,
  40: 3,
  32: 4,
  24: 5,
  16: 6,
  8: 7,
  0: 8,
  // Column 2 -> Presets 9-16
  57: 9,
  49: 10,
  41: 11,
  33: 12,
  25: 13,
  17: 14,
  9: 15,
  1: 16,
  // Column 3 -> Presets 17-24
  58: 17,
  50: 18,
  42: 19,
  34: 20,
  26: 21,
  18: 22,
  10: 23,
  2: 24,
};

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });
}

function getMidiDevices() {
  const devices = [];
  const inputPortCount = midiInput.getPortCount();
  const outputPortCount = midiOutput.getPortCount();
  for (let i = 0; i < inputPortCount; i++) {
    devices.push({ id: i, name: midiInput.getPortName(i), type: "input" });
  }
  for (let i = 0; i < outputPortCount; i++) {
    devices.push({ id: i, name: midiOutput.getPortName(i), type: "output" });
  }
  return devices;
}

async function getSerialDevices() {
  try {
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || "Unknown",
    }));
  } catch (error) {
    console.error("Error getting serial devices:", error);
    return [];
  }
}

function connectMidi(inputId, outputId) {
  return new Promise((resolve, reject) => {
    try {
      if (midiInput) midiInput.closePort();
      if (midiOutput) midiOutput.closePort();
      midiInput = new midi.Input();
      midiOutput = new midi.Output();
      const inputPortIndex = inputId !== undefined ? inputId : outputId;
      const outputPortIndex = outputId;
      if (
        inputPortIndex < 0 ||
        inputPortIndex >= midiInput.getPortCount() ||
        outputPortIndex < 0 ||
        outputPortIndex >= midiOutput.getPortCount()
      ) {
        return reject(new Error("Invalid MIDI port ID provided."));
      }
      midiInput.on("message", handleMidiInput);
      midiInput.on("error", (error) =>
        console.error("MIDI input error:", error)
      );
      midiInput.openPort(inputPortIndex);
      midiOutput.openPort(outputPortIndex);
      const inputName = midiInput.getPortName(inputPortIndex);
      const outputName = midiOutput.getPortName(outputPortIndex);
      console.log(`Connected MIDI input: ${inputName}, output: ${outputName}`);
      resolve({ input: inputName, output: outputName });
    } catch (error) {
      console.error("Error connecting to MIDI device:", error);
      reject(error);
    }
  });
}

async function requestWledPresets() {
  console.log("hoi");
  try {
    console.log(
      "Attempting to fetch presets from http://bankra.local/presets.json"
    );
    const result = await fetch("http://bankra.local/presets.json", {
      dispatcher: dispatcher,
      headers: {
        "User-Agent": "Node.js WLED Controller",
      },
    });

    if (!result.ok) {
      throw new Error(`HTTP error? ${result.status}: ${result.statusText}`);
    }

    const presets = await result.json();
    console.log("Successfully fetched presets:", presets);
    presetColors = {};

    Object.entries(presets).forEach(([presetId, preset]) => {
      const presetNum = parseInt(presetId);
      if (presetNum >= 1 && presetNum <= 24) {
        const seg = preset.seg.find((s) => s.col.find((c) => c));
        console.log("seg?", seg);
        presetColors[presetNum] = seg.col[0];
      }
    });
    loading = false;
    updateApcPads();
  } catch (e) {
    console.log("error while fetching..", e);
    console.log("Error details:", {
      message: e.message,
      code: e.code,
      cause: e.cause,
    });

    // Fallback: set all presets to red
    Array(24)
      .fill()
      .forEach((_, i) => {
        presetColors[i + 1] = [255, 0, 0];
      });
    loading = false;
    error = true;
    updateApcPads();
  }
}

async function connectWled(portPath) {
  error = false;
  if (serialPort && serialPort.isOpen) {
    await new Promise((resolve) => serialPort.close(resolve));
    serialPort = null;
  }
  return new Promise((resolve, reject) => {
    loading = true;
    serialPort = new SerialPort({ path: portPath, baudRate: 115200 });
    wledParser = serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    serialPort.on("open", () => {
      requestWledPresets();
      broadcast({ type: "wled_connected", data: { port: portPath } });

      wledParser.on("data", handleWledData);

      resolve(true);
    });
    serialPort.on("error", (err) => reject(err));
  });
}

// --- WLED and APC Control Logic ---

async function sendWledCommand(command) {
  console.log(serialPort.isOpen);
  if (!serialPort || !serialPort.isOpen) return false;
  console.log("SEND!", command);
  const commandStr = JSON.stringify(command);
  serialPort.write(commandStr, (err) => {
    if (err) console.error("Error sending command to WLED:", err);
  });

  return true;
}

function handleWledData(data) {
  try {
    const response = JSON.parse(data);
    if (!response.state) return;
    currentWledState = response.state;
    broadcast({ type: "wled_state_update", data: currentWledState });
    console.log("wled event received", data);

    // const presetId = response.state.ps;
    // if (presetId > 0) {
    //   const color = extractDominantColor(response.state);
    //   presetColors[presetId] = color;
    // }

    // updateApcPads();
  } catch (e) {
    console.error("error?", e);
  }
}

function extractDominantColor(wledState) {
  if (!wledState || !wledState.seg) return [0, 0, 0];
  let activeSegment =
    wledState.seg.find((s) => s.sel && s.on) || wledState.seg.find((s) => s.on);
  if (activeSegment && activeSegment.col && activeSegment.col[0]) {
    return activeSegment.col[0].slice(0, 3);
  }
  return [255, 255, 255];
}

function updateApcPads() {
  if (!midiOutput || !midiOutput.isPortOpen()) return;

  const activePresetId = currentWledState.ps;
  const BLINK_LOADING = 0x9a;
  const BLINK_SLOW_ON = 0x99;
  const BLINK_ERROR = 0x9c;
  const SOLID_ON = 0x96;

  Object.entries(APC_PAD_MAPPING).forEach(([padNoteStr, presetId]) => {
    const padNote = parseInt(padNoteStr);
    const color = presetColors[presetId];
    console.log("color", color);

    if (color) {
      const velocity = rgbToApcVelocity(color[0], color[1], color[2]);
      const command = error
        ? BLINK_ERROR
        : loading
          ? BLINK_LOADING
          : presetId === activePresetId
            ? BLINK_SLOW_ON
            : SOLID_ON;

      console.log("cmd", command);
      midiOutput.sendMessage([command, padNote, velocity]);
    } else {
      midiOutput.sendMessage([SOLID_ON, padNote, 0]);
    }
  });
}

function rgbToApcVelocity(r, g, b) {
  const apcColors = [
    [0, 0, 0],
    [30, 30, 30],
    [127, 127, 127],
    [255, 255, 255],
    [255, 76, 76],
    [255, 0, 0],
    [89, 0, 0],
    [25, 0, 0],
    [255, 189, 108],
    [255, 84, 0],
    [89, 29, 0],
    [39, 27, 0],
    [255, 255, 76],
    [255, 255, 0],
    [89, 89, 0],
    [25, 25, 0],
    [136, 255, 76],
    [84, 255, 0],
    [29, 89, 0],
    [20, 43, 0],
    [76, 255, 76],
    [0, 255, 0],
    [0, 89, 0],
    [0, 25, 0],
    [76, 255, 94],
    [0, 255, 25],
    [0, 89, 13],
    [0, 25, 2],
    [76, 255, 136],
    [0, 255, 85],
    [0, 89, 29],
    [0, 31, 18],
    [76, 255, 183],
    [76, 195, 255],
    [0, 169, 255],
    [0, 65, 82],
    [0, 16, 25],
    [76, 136, 255],
    [0, 85, 255],
    [0, 29, 89],
    [0, 8, 25],
    [76, 76, 255],
    [0, 0, 255],
    [0, 0, 89],
    [0, 0, 25],
    [135, 76, 255],
    [84, 0, 255],
    [25, 0, 100],
    [15, 0, 48],
    [255, 76, 255],
    [255, 0, 255],
    [89, 0, 89],
    [25, 0, 25],
    [255, 76, 135],
    [255, 0, 84],
    [89, 0, 29],
    [34, 0, 19],
    [255, 21, 0],
    [153, 53, 0],
    [121, 81, 0],
    [67, 100, 0],
    [3, 57, 0],
    [0, 87, 53],
    [0, 84, 127],
    [0, 0, 255],
    [0, 69, 79],
    [37, 0, 204],
    [127, 127, 127],
    [32, 32, 32],
    [255, 0, 0],
    [189, 255, 45],
    [175, 237, 6],
    [100, 255, 9],
    [16, 139, 0],
    [0, 255, 135],
    [0, 169, 255],
    [0, 42, 255],
    [63, 0, 255],
    [122, 0, 255],
    [178, 26, 125],
    [64, 33, 0],
    [255, 74, 0],
    [136, 225, 6],
    [114, 255, 21],
    [0, 255, 0],
    [59, 255, 38],
    [89, 255, 113],
    [56, 255, 204],
    [91, 138, 255],
    [49, 81, 198],
    [135, 127, 233],
    [211, 29, 255],
    [255, 0, 93],
    [255, 127, 0],
    [185, 176, 0],
    [144, 255, 0],
    [131, 93, 7],
    [57, 43, 0],
    [20, 76, 16],
    [13, 80, 56],
    [21, 21, 42],
    [22, 32, 90],
    [105, 60, 28],
    [168, 0, 10],
    [222, 81, 61],
    [216, 106, 28],
    [255, 225, 38],
    [158, 225, 47],
    [103, 181, 15],
    [30, 30, 48],
    [220, 255, 107],
    [128, 255, 189],
    [154, 153, 255],
    [142, 102, 255],
    [64, 64, 64],
    [117, 117, 117],
    [224, 255, 255],
    [160, 0, 0],
    [53, 0, 0],
    [26, 208, 0],
    [7, 66, 0],
    [185, 176, 0],
    [63, 49, 0],
    [179, 95, 0],
    [75, 21, 2],
  ];
  let minDistance = Infinity,
    closestVelocity = 0;
  for (let i = 0; i < apcColors.length; i++) {
    const [ar, ag, ab] = apcColors[i];
    const distance = Math.sqrt(
      Math.pow(r - ar, 2) + Math.pow(g - ag, 2) + Math.pow(b - ab, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestVelocity = i;
    }
  }
  return closestVelocity;
}

function mapRange(value, in_min, in_max, out_min, out_max) {
  return ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}

const throttle = (func, delay) => {
  let inProgress = false;
  return (...args) => {
    if (inProgress) {
      return;
    }
    inProgress = true;
    setTimeout(() => {
      func(...args);
      inProgress = false;
    }, delay);
  };
};

const throttledSendWledCommand = throttle(sendWledCommand, 100);

function handleMidiInput(deltaTime, message) {
  const [status, note, velocity] = message;
  const command = status >> 4;
  broadcast({ type: "midi_event", data: { command, note, velocity } });

  if (command === 9 && velocity > 0) {
    const presetId = APC_PAD_MAPPING[note];
    if (presetId) {
      console.log(`Pad ${note} pressed -> Set WLED Preset ${presetId}`);
      sendWledCommand({ v: true, ps: presetId });
      currentWledState.ps = presetId;
      updateApcPads();
    }
  }
  // Fader for brightness
  if (command === 11) {
    if (note === 48) {
      sendWledCommand({
        v: true,
        bri: velocity * 2,
      });
    }
    // Fader for Speed (sx)
    if (note === 49) {
      throttledSendWledCommand({
        v: true,
        seg: Array.from({ length: 5 }, (_, i) => ({
          id: i,
          sx: velocity * 2,
        })),
      });
    }
    // Fader for Intensity (ix)
    if (note === 50) {
      throttledSendWledCommand({
        v: true,
        seg: Array.from({ length: 5 }, (_, i) => ({
          id: i,
          ix: mapRange(velocity, 0, 127, 0, 255),
        })),
      });
    }
  }
}

wss.on("connection", (ws) => {
  console.log("Frontend connected");
  ws.on("close", () => console.log("Frontend disconnected"));
  ws.send(
    JSON.stringify({
      type: "initial_state",
      data: { midiDevices, serialDevices, wledState: currentWledState },
    })
  );
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      switch (data.type) {
        case "connect_midi":
          try {
            await connectMidi(data.inputId, data.outputId);
            ws.send(JSON.stringify({ type: "midi_connected" }));
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `MIDI Connection Failed: ${error.message}`,
              })
            );
          }
          break;
        case "connect_wled":
          try {
            await connectWled(data.portPath);
            Array(24)
              .fill()
              .forEach((_, i) => {
                presetColors[i + 1] = [255, 255, 255];
              });
            updateApcPads();
            ws.send(JSON.stringify({ type: "wled_connected" }));
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `WLED Connection Failed: ${error.message}`,
              })
            );
          }
          break;
        // ... other cases
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });
});

// --- API Routes ---
app.get("/api/devices/midi", (req, res) => res.json(getMidiDevices()));
app.get("/api/devices/serial", async (req, res) =>
  res.json(await getSerialDevices())
);

// --- Server Start ---
app.listen(port, "0.0.0.0", async () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket server running on ws://localhost:3002`);
  midiDevices = getMidiDevices();
  serialDevices = await getSerialDevices();
});
